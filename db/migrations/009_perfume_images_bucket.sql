-- Copies of perfume images are kept in our own Supabase Storage so we don't depend on other sites. The
-- admin pastes an image link -> on save the server downloads the image and stores it here
-- (features/admin/perfumes/server/mirror-images.ts).
--
-- The bucket is public: images are read through the public URL. Only the server writes, with the
-- service_role key (bypasses RLS), so no extra policies are needed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'perfume-images',
  'perfume-images',
  true,
  10485760, -- 10 MB po slici
  array['image/avif','image/webp','image/png','image/jpeg','image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
