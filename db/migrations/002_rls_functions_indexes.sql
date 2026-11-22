-- Optimizacija baze: is_admin petlja, RLS politike, funkcije, indeksi.
-- Applied as two Supabase migrations:
--   "private_is_admin_and_fk_indexes" i "rls_policies_initplan_fix".
--
-- 1) is_admin() went into infinite recursion for every signed-in user
--    (is_admin -> user_roles -> politika -> is_admin ...) => "stack depth limit exceeded".
-- Result: signed-in users couldn't read profiles and perfumes from the browser.
-- The new version lives in a private schema (not exposed to the API), SECURITY DEFINER,
-- so it reads roles without re-triggering RLS.
-- 2) auth.uid() / is_admin() in policies are wrapped in (select ...) -> evaluated
-- once per query instead of once per row.
-- 3) Functions: fixed search_path; trigger functions can't be called via /rpc.
-- 4) Indexes for foreign keys.

-- ---------------------------------------------------------------------------
-- Deo 1: private_is_admin_and_fk_indexes
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.revoked_at is null
      and r.name = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

alter function public.set_updated_at() set search_path = '';
alter function public.set_user_addresses_updated_at() set search_path = '';
-- Triggers keep working: the privilege is only checked on a direct /rpc call.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists product_reviews_user_id_idx on public.product_reviews (user_id);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);
create index if not exists user_roles_assigned_by_idx on public.user_roles (assigned_by);

-- ---------------------------------------------------------------------------
-- Deo 2: rls_policies_initplan_fix
-- ---------------------------------------------------------------------------
-- The old public.is_admin() stays as a safe wrapper (no recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$ select private.is_admin(); $$;

alter policy "admin write perfumes" on public.perfumes using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "admin write variants" on public.perfume_variants using ((select private.is_admin())) with check ((select private.is_admin()));

alter policy "profiles admin read all" on public.profiles using ((select private.is_admin()));
alter policy "profiles read own" on public.profiles using ((select auth.uid()) = id);
alter policy "profiles update own" on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter policy "user_roles admin delete" on public.user_roles using ((select private.is_admin()));
alter policy "user_roles admin insert" on public.user_roles with check ((select private.is_admin()));
alter policy "user_roles admin read all" on public.user_roles using ((select private.is_admin()));
alter policy "user_roles admin update" on public.user_roles using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "user_roles read own" on public.user_roles using ((select auth.uid()) = user_id);

alter policy "Users can delete own reviews" on public.product_reviews using ((select auth.uid()) = user_id);
alter policy "Users can insert own reviews" on public.product_reviews with check ((select auth.uid()) = user_id);
alter policy "Users can update own reviews" on public.product_reviews using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy reviews_delete_own on public.product_reviews using ((select auth.uid()) = user_id);
alter policy reviews_insert_own on public.product_reviews with check ((select auth.uid()) = user_id);
alter policy reviews_update_own on public.product_reviews using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy user_addresses_delete_own on public.user_addresses using ((select auth.uid()) = user_id);
alter policy user_addresses_insert_own on public.user_addresses with check ((select auth.uid()) = user_id);
alter policy user_addresses_select_own on public.user_addresses using ((select auth.uid()) = user_id);
alter policy user_addresses_update_own on public.user_addresses using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy wishlist_items_delete_own on public.wishlist_items to authenticated using ((select auth.uid()) = user_id);
alter policy wishlist_items_insert_own on public.wishlist_items to authenticated with check ((select auth.uid()) = user_id);
alter policy wishlist_items_select_own on public.wishlist_items to authenticated using ((select auth.uid()) = user_id);
alter policy wishlist_items_update_own on public.wishlist_items to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
