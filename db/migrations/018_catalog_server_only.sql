-- Shop data is read only by the site's own server (service role, cached by Next.js).
--
-- Until now the public "anon" key, which every page carries because sign-in needs it, could read
-- whole tables straight from the Supabase API: all active perfumes with descriptions and notes, every
-- price, the bundles, the shop settings and all reviews (with the reviewers' user IDs). One request
-- copied the whole catalog and bypassed the site and any bot protection in front of it.
--
-- After this migration:
--   * perfumes, perfume_variants, bundles, shop_settings: no access at all for anon/authenticated.
--     The admin panel already writes through the server (service role), so the old admin policies go too.
--   * product_reviews: the public list comes from the server (without user IDs); a signed-in customer
--     can read, write and delete only their own review (the review form needs that).
-- RLS stays enabled with no policies, so even an accidental future grant exposes nothing.
-- Safe to run more than once.

begin;

/* ------------------------- Catalog: server only --------------------------- */
drop policy if exists perfumes_select_public on public.perfumes;
drop policy if exists perfumes_select_authenticated on public.perfumes;
drop policy if exists perfumes_insert_admin on public.perfumes;
drop policy if exists perfumes_update_admin on public.perfumes;
drop policy if exists perfumes_delete_admin on public.perfumes;

drop policy if exists perfume_variants_select_all on public.perfume_variants;
drop policy if exists perfume_variants_insert_admin on public.perfume_variants;
drop policy if exists perfume_variants_update_admin on public.perfume_variants;
drop policy if exists perfume_variants_delete_admin on public.perfume_variants;

drop policy if exists bundles_select_active on public.bundles;
drop policy if exists shop_settings_select_all on public.shop_settings;

revoke all on table public.perfumes, public.perfume_variants, public.bundles, public.shop_settings
  from anon, authenticated;

/* -------- Reviews: public list from the server, own review through RLS -------- */
drop policy if exists reviews_select_all on public.product_reviews;
drop policy if exists reviews_select_own on public.product_reviews;
create policy reviews_select_own on public.product_reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.product_reviews from anon;

commit;
