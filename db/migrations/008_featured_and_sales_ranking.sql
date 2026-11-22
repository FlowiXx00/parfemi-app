-- "Featured" (admin highlights a perfume) and sales rank for the "Best seller" badge.
-- Applied as Supabase migration "perfume_featured_and_sales_ranking".
--
-- perfume_sales_ranking: how many units of each perfume were sold in the last N days (cancelled orders
-- don't count). Only the server may call it (service_role); the public site only gets the order, never the
-- sales numbers.

alter table public.perfumes
  add column if not exists is_featured boolean not null default false;

comment on column public.perfumes.is_featured is 'Preporuka: admin ističe parfem (oznaka na kartici, prvi u "Preporučeno").';

create or replace function public.perfume_sales_ranking(days integer default 90)
returns table (perfume_id text, sold bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select oi.perfume_id, sum(oi.qty)::bigint as sold
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status <> 'cancelled'
    and o.created_at > now() - make_interval(days => days)
  group by oi.perfume_id
  order by sold desc;
$$;

revoke all on function public.perfume_sales_ranking(integer) from public, anon, authenticated;
grant execute on function public.perfume_sales_ranking(integer) to service_role;
