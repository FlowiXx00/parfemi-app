-- A perfume can be "switched off" in the admin: it stays in the database (prices, images, notes) but
-- customers don't see it. The rule lives in RLS, so a hidden perfume isn't reachable with the public API
-- key either. Admins (service_role or a signed-in admin) still see everything.

alter table public.perfumes
  add column if not exists is_active boolean not null default true;

comment on column public.perfumes.is_active is
  'false = parfem je sakriven iz shopa (admin ga i dalje vidi i može ponovo da ga uključi).';

-- Anonymous visitors: active perfumes only (existing policy, previously "using (true)").
alter policy perfumes_select_all on public.perfumes
  to anon
  using (is_active);

-- Signed-in users: active perfumes; admins also see hidden ones.
create policy perfumes_select_authenticated on public.perfumes
  for select to authenticated
  using (is_active or (select private.is_admin()));
