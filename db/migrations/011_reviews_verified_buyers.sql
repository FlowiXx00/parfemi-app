-- Only a customer whose order containing that perfume was DELIVERED (orders.status = 'received') can leave
-- a review. The rule lives in RLS, so it holds outside the site too. Through rpc('my_received_perfume_ml')
-- the site knows whether to show the form and which volumes the customer received.

-- Volumes (ml) of that perfume the current user has received; empty = not purchased.
create or replace function private.received_perfume_ml(p_product_id text)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct i.ml order by i.ml), '{}')
  from public.orders o
  join public.order_items i on i.order_id = o.id
  where o.user_id = (select auth.uid())
    and o.status = 'received'
    and i.perfume_id = p_product_id;
$$;

revoke all on function private.received_perfume_ml(text) from public, anon;
grant execute on function private.received_perfume_ml(text) to authenticated;

-- For the site (PostgREST rpc): what the signed-in user has received of this perfume.
create or replace function public.my_received_perfume_ml(p_product_id text)
returns integer[]
language sql
stable
security invoker
set search_path = ''
as $$
  select private.received_perfume_ml(p_product_id);
$$;

revoke all on function public.my_received_perfume_ml(text) from public, anon;
grant execute on function public.my_received_perfume_ml(text) to authenticated;

-- RLS: inserting and editing reviews only for verified buyers.
alter policy reviews_insert_own on public.product_reviews
  with check (
    (select auth.uid()) = user_id
    and cardinality(private.received_perfume_ml(product_id)) > 0
  );

alter policy reviews_update_own on public.product_reviews
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and cardinality(private.received_perfume_ml(product_id)) > 0
  );
