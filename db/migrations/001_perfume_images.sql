-- Perfume images via URL + a few missing indexes.
-- Applied as Supabase migration "perfume_images_and_indexes".
--
-- images = list of objects { "url": "...", "label": "..." }, the first image is the main one.
-- The URL can be https://... (any site / CDN / Supabase Storage) or a local path from the public/ folder
-- (e.g. /perfumes/creed-aventus/parfem.png).

alter table public.perfumes
  add column if not exists images jsonb not null default '[]'::jsonb;

alter table public.perfumes
  drop constraint if exists perfumes_images_is_array;

alter table public.perfumes
  add constraint perfumes_images_is_array check (jsonb_typeof(images) = 'array');

-- Existing perfumes: move the current local images into the column so the site looks the same as before.
-- They can be replaced with URLs in the admin later.
update public.perfumes
set images = jsonb_build_array(
  jsonb_build_object('url', '/perfumes/' || id || '/parfem.png', 'label', 'Parfem'),
  jsonb_build_object('url', '/perfumes/' || id || '/note.png',   'label', 'Note'),
  jsonb_build_object('url', '/perfumes/' || id || '/nositi.png', 'label', 'Kada nositi'),
  jsonb_build_object('url', '/perfumes/' || id || '/akordi.png', 'label', 'Akordi')
)
where images = '[]'::jsonb;

-- "My orders": filter by user, sorted by date.
create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

-- Duplicate: wishlist_items_user_id_product_id_key and wishlist_items_user_product_unique
-- are the same unique index. Keep one.
drop index if exists public.wishlist_items_user_product_unique;
