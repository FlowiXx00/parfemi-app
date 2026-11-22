-- Perfume liquid color (for the pipette in the quick view), entered by the admin. NULL = the site
-- estimates it from the bottle image.
-- Applied as Supabase migration "perfume_liquid_color".

alter table public.perfumes
  add column if not exists liquid_color text;

alter table public.perfumes
  add constraint perfumes_liquid_color_hex check (liquid_color is null or liquid_color ~ '^#[0-9a-fA-F]{6}$');

comment on column public.perfumes.liquid_color is 'Boja tečnosti za pipetu u izlogu (#rrggbb). NULL = automatski iz slike.';
