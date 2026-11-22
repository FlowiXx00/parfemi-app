-- Applied manually in the Supabase SQL Editor (2026-11-15) and verified.
--
-- Grants reduced to what the site actually uses. RLS still decides WHICH rows; this decides WHICH
-- operations exist at all for guests (anon) and signed-in users (authenticated). Previously guests even
-- had TRUNCATE/DELETE on every table, and TRUNCATE bypasses RLS. Only the operations the site performs
-- through the anon/authenticated client are allowed. After applying, verify each operation as guest / user
-- / admin.

begin;

revoke all on all tables in schema public from anon, authenticated;

-- Catalog and reviews: readable by everyone.
grant select on public.perfumes, public.perfume_variants, public.product_reviews to anon, authenticated;

-- Catalog writes: RLS allows only admins (the site does this through the server; this is a safety net).
grant insert, update, delete on public.perfumes, public.perfume_variants to authenticated;

-- Reviews: RLS allows only your own.
grant insert, update, delete on public.product_reviews to authenticated;

-- Profile: your own (admins read all).
grant select, insert, update on public.profiles to authenticated;

-- Roles: users see their own, admins manage them.
grant select on public.roles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;

-- Addresses and wishlist: your own only.
grant select, insert, update, delete on public.user_addresses, public.wishlist_items to authenticated;

-- orders / order_items: NOTHING for anon/authenticated. Orders go exclusively through
-- the server (service_role) in /api/orders*, where prices, stock and ownership are checked.

-- public.is_admin() is just a wrapper; guests don't need to call it.
revoke execute on function public.is_admin() from public, anon;

commit;
