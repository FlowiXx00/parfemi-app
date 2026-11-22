-- Missing profiles + a policy for creating your own profile.
-- Applied as Supabase migration "profiles_backfill".

-- Accounts created before the on_auth_user_created trigger existed.
insert into public.profiles (id, email, full_name, avatar_url)
select u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- saveProfile() in settings creates the profile if it's missing -> it needs INSERT on its own row.
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
