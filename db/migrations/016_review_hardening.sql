-- Customer reviews on the product page: database-side rules on top of migration 011 (only a customer
-- whose order with that perfume was delivered can review it). The site works without this migration,
-- but with it the rules also hold for requests that don't come from the site:
--   1) The name shown with a review comes from the customer's profile ("Marko P."), never from the
--      request, so nobody can post under someone else's name.
--   2) updated_at is always current; an update can't change created_at, user_id or product_id.
--   3) The volume (ml) has to be one the customer actually received.
--   4) Comments are at most 1000 characters.
--   5) Deleting a perfume deletes its reviews.
-- Safe to run more than once.

create or replace function private.product_reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full text;
  v_parts text[];
  v_first text;
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.product_id := old.product_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  -- Public name: first name + initial of the last name (privacy: never the full name).
  select coalesce(
           nullif(trim(p.full_name), ''),
           nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(trim(u.raw_user_meta_data ->> 'name'), '')
         )
    into v_full
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = new.user_id;

  if v_full is null then
    new.full_name := null;
  else
    v_parts := regexp_split_to_array(v_full, '\s+');
    v_first := left(v_parts[1], 40);
    v_first := upper(left(v_first, 1)) || substr(v_first, 2);
    new.full_name := case
      when cardinality(v_parts) > 1
        then v_first || ' ' || upper(left(v_parts[cardinality(v_parts)], 1)) || '.'
      else v_first
    end;
  end if;

  -- Volume: only one the customer received. Requests without a signed-in user (service role, i.e. the
  -- server/admin) are trusted.
  if new.ml is not null
     and (select auth.uid()) is not null
     and not (new.ml = any (private.received_perfume_ml(new.product_id))) then
    raise exception 'Zapremina % ml nije u preuzetim porudžbinama.', new.ml using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.product_reviews_before_write() from public, anon, authenticated;

drop trigger if exists product_reviews_before_write on public.product_reviews;
create trigger product_reviews_before_write
  before insert or update on public.product_reviews
  for each row execute function private.product_reviews_before_write();

-- Comment length (the site allows 10–1000 characters). NOT VALID: existing rows aren't re-checked.
alter table public.product_reviews drop constraint if exists product_reviews_comment_max;
alter table public.product_reviews
  add constraint product_reviews_comment_max check (char_length(comment) <= 1000) not valid;

-- Reviews belong to a perfume: deleting the perfume deletes them. NOT VALID: existing rows aren't
-- re-checked (an old review of an already deleted perfume doesn't block the migration).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_reviews_product_id_fkey'
  ) then
    alter table public.product_reviews
      add constraint product_reviews_product_id_fkey
      foreign key (product_id) references public.perfumes (id) on delete cascade not valid;
  end if;
end;
$$;
