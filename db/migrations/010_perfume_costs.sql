-- Bottle cost and margin per perfume (admin price calculator only). The admin enters what the whole bottle
-- cost, the bottle size and the margin -> "Calculate prices"
-- postavi cene dekanata (features/admin/perfumes/lib/perfumes.lib.ts -> decantPrice).
--
-- Customers never see this: RLS without policies + no grants for anon/authenticated; only the server reads
-- and writes it with the service_role key (db/queries/perfumes.ts).

create table if not exists public.perfume_costs (
  perfume_id text primary key references public.perfumes(id) on delete cascade,
  bottle_price_rsd integer check (bottle_price_rsd is null or bottle_price_rsd >= 0),
  bottle_ml integer check (bottle_ml is null or bottle_ml > 0),
  margin_pct numeric(6,2) check (margin_pct is null or margin_pct >= 0),
  packaging_rsd integer not null default 0 check (packaging_rsd >= 0),
  round_step integer not null default 50 check (round_step in (1, 10, 50, 100)),
  updated_at timestamptz not null default now()
);

alter table public.perfume_costs enable row level security;

revoke all on table public.perfume_costs from anon, authenticated;
grant select, insert, update, delete on table public.perfume_costs to service_role;
