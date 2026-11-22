-- Demo role: read-only access to the admin panel (for a portfolio demo). The server rejects every change
-- for this role and customer data is masked.
-- Assigning the demo account (after registering an account, e.g. demo@atelierdekant.rs):
--   insert into public.user_roles (user_id, role_id)
--   select id, 3 from auth.users where email = 'demo@atelierdekant.rs';
insert into public.roles (id, name)
values (3, 'demo')
on conflict (id) do nothing;
