-- Accords, notes and "when to wear" for perfumes.
-- Applied as Supabase migration "perfume_accords_notes_wear".
--
-- accords: [{"name":"drvenast","strength":0-100}], strongest first
-- notes:   {"top":[...],"middle":[...],"base":[...]}
-- wear:    {"spring","summer","fall","winter","day","night"} (0-100)

alter table public.perfumes
  add column if not exists accords jsonb not null default '[]'::jsonb,
  add column if not exists notes jsonb not null default '{}'::jsonb,
  add column if not exists wear jsonb not null default '{}'::jsonb;

alter table public.perfumes
  add constraint perfumes_accords_is_array check (jsonb_typeof(accords) = 'array'),
  add constraint perfumes_notes_is_object check (jsonb_typeof(notes) = 'object'),
  add constraint perfumes_wear_is_object check (jsonb_typeof(wear) = 'object');

comment on column public.perfumes.accords is 'Akordi: [{"name":"drvenast","strength":0-100}], najjači prvi.';
comment on column public.perfumes.notes is 'Note: {"top":[...],"middle":[...],"base":[...]}.';
comment on column public.perfumes.wear is 'Kada nositi (0-100): {"spring","summer","fall","winter","day","night"}.';
