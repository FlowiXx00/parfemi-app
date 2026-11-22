-- NOT APPLIED automatically: run it manually in Supabase > SQL Editor. It doesn't change who can see or do
-- what, it only removes duplicates that Supabase reports as slower.
--
-- Before: perfumes had 3 policies, product_reviews 7, profiles 3, user_roles 5, etc. After: one policy per
-- role and action.

begin;

-- ---------------------------------------------------------------------------
-- Duplirani indeksi
-- ---------------------------------------------------------------------------
-- Dva ista UNIQUE (user_id, product_id) — ostaje wishlist_items_user_id_product_id_key.
alter table public.wishlist_items drop constraint if exists wishlist_items_user_product_unique;
-- Covered by existing UNIQUE indexes that start with the same column.
drop index if exists public.wishlist_items_user_id_idx;   -- UNIQUE (user_id, product_id)
drop index if exists public.orders_order_number_idx;      -- UNIQUE (order_number)
drop index if exists public.user_roles_user_id_idx;       -- UNIQUE (user_id, role_id, revoked_at)

-- ---------------------------------------------------------------------------
-- perfumes / perfume_variants: one read policy, admin separately per action ("admin write" was FOR ALL, so
-- it included SELECT too -> double check)
-- ---------------------------------------------------------------------------
drop policy if exists "public read perfumes" on public.perfumes;
drop policy if exists "read perfumes" on public.perfumes;
drop policy if exists "admin write perfumes" on public.perfumes;
create policy perfumes_select_all on public.perfumes for select to anon, authenticated using (true);
create policy perfumes_insert_admin on public.perfumes for insert to authenticated with check ((select private.is_admin()));
create policy perfumes_update_admin on public.perfumes for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy perfumes_delete_admin on public.perfumes for delete to authenticated using ((select private.is_admin()));

drop policy if exists "public read variants" on public.perfume_variants;
drop policy if exists "read variants" on public.perfume_variants;
drop policy if exists "admin write variants" on public.perfume_variants;
create policy perfume_variants_select_all on public.perfume_variants for select to anon, authenticated using (true);
create policy perfume_variants_insert_admin on public.perfume_variants for insert to authenticated with check ((select private.is_admin()));
create policy perfume_variants_update_admin on public.perfume_variants for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy perfume_variants_delete_admin on public.perfume_variants for delete to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- product_reviews: "Users can ..." were identical copies of reviews_*_own
-- ---------------------------------------------------------------------------
drop policy if exists "Users can delete own reviews" on public.product_reviews;
drop policy if exists "Users can insert own reviews" on public.product_reviews;
drop policy if exists "Users can update own reviews" on public.product_reviews;

-- ---------------------------------------------------------------------------
-- profiles / user_roles: "svoje ILI admin" u jednoj politici
-- ---------------------------------------------------------------------------
drop policy if exists "profiles admin read all" on public.profiles;
drop policy if exists "profiles read own" on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));

drop policy if exists "user_roles admin read all" on public.user_roles;
drop policy if exists "user_roles read own" on public.user_roles;
create policy user_roles_select_own_or_admin on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

commit;
