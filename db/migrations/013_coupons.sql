-- Coupons are created, edited and disabled in the admin (they used to be hardcoded). ONLY the server
-- reads/writes the table (service_role): customers can't list codes, and they check a coupon via
-- /api/coupons/check (rate limited).

create table if not exists public.coupons (
  code text primary key
    check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  label text not null default '',
  type text not null check (type in ('percent', 'fixed')),
  value integer not null check (value > 0),
  min_subtotal_rsd integer check (min_subtotal_rsd is null or min_subtotal_rsd >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_max check (type <> 'percent' or value <= 100),
  constraint coupons_dates check (starts_at is null or expires_at is null or starts_at < expires_at)
);

comment on table public.coupons is
  'Kuponi za popust. Samo service_role (server). used_count se menja isključivo preko redeem_coupon/release_coupon.';

alter table public.coupons enable row level security;
-- Bez politika: anon/authenticated nemaju pristup.
revoke all on public.coupons from anon, authenticated;

-- Atomic "redeem coupon": succeeds only if the coupon is still valid and not used up. Two concurrent
-- orders can't both take the last use.
create or replace function public.redeem_coupon(p_code text)
returns setof public.coupons
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.coupons
     set used_count = used_count + 1,
         updated_at = now()
   where code = upper(p_code)
     and is_active
     and (starts_at is null or starts_at <= now())
     and (expires_at is null or expires_at > now())
     and (max_uses is null or used_count < max_uses)
  returning *;
$$;

-- Gives a use back if the order wasn't written after all.
create or replace function public.release_coupon(p_code text)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.coupons
     set used_count = greatest(used_count - 1, 0),
         updated_at = now()
   where code = upper(p_code);
$$;

revoke all on function public.redeem_coupon(text) from public, anon, authenticated;
revoke all on function public.release_coupon(text) from public, anon, authenticated;
grant execute on function public.redeem_coupon(text) to service_role;
grant execute on function public.release_coupon(text) to service_role;

-- Coupons that used to be in the code (so they keep working); the admin can disable them.
insert into public.coupons (code, label, type, value, min_subtotal_rsd) values
  ('WELCOME5', 'Dobrodošli popust', 'percent', 5, null),
  ('DEKANT10', 'Popust na celu kupovinu', 'percent', 10, 3000),
  ('FLOW15', 'Jači promo popust', 'percent', 15, 5000),
  ('LESS500', 'Fiksni popust', 'fixed', 500, 4000)
on conflict (code) do nothing;

-- Uses from existing orders.
update public.coupons c
   set used_count = sub.n
  from (select coupon_code, count(*)::int as n from public.orders where coupon_code is not null group by coupon_code) sub
 where sub.coupon_code = c.code;
