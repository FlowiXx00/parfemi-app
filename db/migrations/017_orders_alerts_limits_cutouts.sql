-- New features (all additive: new columns and tables, nothing existing changes):
--   1) Orders: Post Express tracking number, "payment received", review request email.
--   2) Guest orders join the customer's account once they sign in with the same (confirmed) email.
--   3) "Javi mi kad bude na stanju" (back-in-stock emails).
--   4) Consent to news and offers (settings page), with the time it was given.
--   5) Shared rate limits (the AI chat's daily cap holds across all server instances).
--   6) Bottle images processed once on the server (background removed + liquid color).
-- Safe to run more than once.

/* ------------------------------ 1) Orders --------------------------------- */
alter table public.orders
  add column if not exists tracking_number text,
  add column if not exists paid_at timestamptz,
  add column if not exists review_request_sent_at timestamptz;

alter table public.orders drop constraint if exists orders_tracking_number_check;
alter table public.orders
  add constraint orders_tracking_number_check
  check (tracking_number is null or char_length(tracking_number) between 4 and 40);

-- Review request email: delivered orders that haven't been asked yet.
create index if not exists orders_review_request_idx on public.orders (received_at)
  where status = 'received' and review_request_sent_at is null;

/* -------------------------- 2) Guest orders -------------------------------- */
create index if not exists orders_guest_email_idx on public.orders (lower(customer_email))
  where user_id is null;

-- Attaches guest orders placed with this email to the account. Only the server calls it, and only
-- for a signed-in user whose email is confirmed (so the email really belongs to them).
create or replace function public.claim_guest_orders(p_user_id uuid, p_email text)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_user_id is null or coalesce(trim(p_email), '') = '' then
    return 0;
  end if;

  update public.orders
     set user_id = p_user_id
   where user_id is null
     and lower(customer_email) = lower(trim(p_email));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_guest_orders(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_guest_orders(uuid, text) to service_role;

/* ---------------------------- 3) Stock alerts ------------------------------ */
create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  perfume_id text not null references public.perfumes (id) on delete cascade,
  -- null = any volume
  ml integer check (ml is null or ml > 0),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

comment on table public.stock_alerts is
  'Javi mi kad bude na stanju: kupac traži mejl kad parfem (ili zapremina) ponovo bude dostupan.';

-- One waiting alert per customer, perfume and volume.
create unique index if not exists stock_alerts_pending_unique
  on public.stock_alerts (user_id, perfume_id, coalesce(ml, 0))
  where notified_at is null;
create index if not exists stock_alerts_pending_perfume_idx
  on public.stock_alerts (perfume_id)
  where notified_at is null;
create index if not exists stock_alerts_user_id_idx on public.stock_alerts (user_id);

alter table public.stock_alerts enable row level security;

drop policy if exists stock_alerts_select_own on public.stock_alerts;
create policy stock_alerts_select_own on public.stock_alerts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists stock_alerts_insert_own on public.stock_alerts;
create policy stock_alerts_insert_own on public.stock_alerts for insert to authenticated
  with check ((select auth.uid()) = user_id and notified_at is null);

drop policy if exists stock_alerts_delete_own on public.stock_alerts;
create policy stock_alerts_delete_own on public.stock_alerts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Customers can't change an alert (only the server marks it as sent).
revoke all on public.stock_alerts from anon, authenticated;
grant select, insert, delete on public.stock_alerts to authenticated;

/* ------------------------ 4) News and offers consent ----------------------- */
alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz;

-- The consent time is set by the database, never by the request.
create or replace function private.profiles_marketing_consent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() else null end;
  elsif new.marketing_opt_in is distinct from old.marketing_opt_in then
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() else null end;
  else
    new.marketing_opt_in_at := old.marketing_opt_in_at;
  end if;
  return new;
end;
$$;

revoke all on function private.profiles_marketing_consent() from public, anon, authenticated;

drop trigger if exists profiles_marketing_consent on public.profiles;
create trigger profiles_marketing_consent
  before insert or update on public.profiles
  for each row execute function private.profiles_marketing_consent();

/* --------------------------- 5) Rate limits -------------------------------- */
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

comment on table public.rate_limits is
  'Zajednički brojači za ograničenja (AI čet, kuponi). Samo server; stari redovi se brišu svaki dan.';

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- One hit on a counter: true = still under the limit. A new window starts when the old one expires.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
                  when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
                  else r.count + 1
                end,
        window_start = case
                         when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
                         else r.window_start
                       end
  returning r.count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

/* ------------------------- 6) Processed bottle images ---------------------- */
-- {"source": original image URL, "key": file name part, "color": "#c98a3a" or null, "v": version}
-- Files: perfume-images/<perfume id>/cutout-384-<key>.webp and cutout-828-<key>.webp
alter table public.perfumes
  add column if not exists cutout jsonb;
