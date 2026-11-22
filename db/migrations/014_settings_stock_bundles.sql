-- 1) Shop settings (shipping): edited by the admin, readable by everyone.
-- 2) Stock: how many ml are left in the bottle (server only). A volume is available while there are enough
-- ml.
-- 3) Discovery bundles: several perfumes of the same volume at a discount.

/* ----------------------------- 1) Settings --------------------------------- */
create table if not exists public.shop_settings (
  id integer primary key default 1 check (id = 1),
  shipping_rsd integer not null default 580 check (shipping_rsd >= 0),
  -- null = free shipping disabled
  free_shipping_from_rsd integer check (free_shipping_from_rsd is null or free_shipping_from_rsd > 0),
  updated_at timestamptz not null default now()
);

insert into public.shop_settings (id, shipping_rsd, free_shipping_from_rsd)
values (1, 580, 5000)
on conflict (id) do nothing;

alter table public.shop_settings enable row level security;
create policy shop_settings_select_all on public.shop_settings
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.shop_settings from anon, authenticated;

/* -------------------------------- 2) Stock --------------------------------- */
-- A row exists only for perfumes whose stock is tracked; no row = manual "in stock".
create table if not exists public.perfume_stock (
  perfume_id text primary key references public.perfumes(id) on delete cascade,
  stock_ml integer not null check (stock_ml >= 0),
  updated_at timestamptz not null default now()
);

alter table public.perfume_stock enable row level security;
revoke all on public.perfume_stock from anon, authenticated;

-- Whether the order deducted ml from stock and whether they were returned (cancellation).
alter table public.orders
  add column if not exists stock_state text not null default 'none'
  check (stock_state in ('none', 'consumed', 'returned'));

-- Deducts ml for an order: all or nothing. p_items = [{"perfume_id": "...", "ml": 15}, ...]
-- If any perfume doesn't have enough, raises 'NEDOVOLJNO:<perfume_id>' and nothing changes.
create or replace function public.consume_perfume_stock(p_items jsonb)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  rec record;
  available integer;
begin
  for rec in
    select (item->>'perfume_id') as perfume_id, sum((item->>'ml')::int) as ml
      from jsonb_array_elements(p_items) as item
     group by 1
     order by 1
  loop
    select s.stock_ml into available
      from public.perfume_stock s
     where s.perfume_id = rec.perfume_id
       for update;

    if not found then
      continue; -- stock isn't tracked for this perfume
    end if;

    if available < rec.ml then
      raise exception 'NEDOVOLJNO:%', rec.perfume_id using errcode = 'P0001';
    end if;

    update public.perfume_stock
       set stock_ml = stock_ml - rec.ml, updated_at = now()
     where perfume_id = rec.perfume_id;
  end loop;
end;
$$;

-- Returns ml (the order wasn't written). Same format as consume.
create or replace function public.release_perfume_stock(p_items jsonb)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.perfume_stock s
     set stock_ml = s.stock_ml + x.ml, updated_at = now()
    from (
      select (item->>'perfume_id') as perfume_id, sum((item->>'ml')::int) as ml
        from jsonb_array_elements(p_items) as item
       group by 1
    ) x
   where s.perfume_id = x.perfume_id;
$$;

-- Top-up / correction: +delta ml (e.g. a new 100 ml bottle). Starts tracking if there's no row.
create or replace function public.add_perfume_stock(p_perfume_id text, p_delta integer)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.perfume_stock as s (perfume_id, stock_ml)
  values (p_perfume_id, greatest(0, p_delta))
  on conflict (perfume_id) do update
    set stock_ml = greatest(0, s.stock_ml + p_delta), updated_at = now()
  returning stock_ml;
$$;

-- Cancelled order: return the ml (only once, and only if the order deducted them).
create or replace function public.restore_order_stock(p_order_id bigint)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  update public.orders set stock_state = 'returned'
   where id = p_order_id and stock_state = 'consumed';

  if not found then
    return;
  end if;

  update public.perfume_stock s
     set stock_ml = s.stock_ml + x.ml, updated_at = now()
    from (
      select perfume_id, sum(ml * qty) as ml
        from public.order_items
       where order_id = p_order_id
       group by perfume_id
    ) x
   where s.perfume_id = x.perfume_id;
end;
$$;

revoke all on function public.consume_perfume_stock(jsonb) from public, anon, authenticated;
revoke all on function public.release_perfume_stock(jsonb) from public, anon, authenticated;
revoke all on function public.add_perfume_stock(text, integer) from public, anon, authenticated;
revoke all on function public.restore_order_stock(bigint) from public, anon, authenticated;
grant execute on function public.consume_perfume_stock(jsonb) to service_role;
grant execute on function public.release_perfume_stock(jsonb) to service_role;
grant execute on function public.add_perfume_stock(text, integer) to service_role;
grant execute on function public.restore_order_stock(bigint) to service_role;

/* -------------------------------- 3) Bundles -------------------------------- */
create table if not exists public.bundles (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(title) between 2 and 80),
  description text not null default '',
  ml integer not null check (ml between 1 and 50),
  discount_pct integer not null default 15 check (discount_pct between 0 and 60),
  perfume_ids text[] not null check (cardinality(perfume_ids) between 2 and 10),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bundles enable row level security;
create policy bundles_select_active on public.bundles
  for select to anon, authenticated using (is_active);
revoke insert, update, delete on public.bundles from anon, authenticated;
