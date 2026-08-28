-- QuickNotes no longer stores profile avatars in Supabase Storage. These
-- legacy policies outlived the removed bucket and granted every authenticated
-- user write access to every object if a bucket named `avatars` were ever
-- recreated. Keep the current private capture bucket as the only application
-- Storage authorization surface.

drop policy if exists avatar_select on storage.objects;
drop policy if exists avatar_insert on storage.objects;
drop policy if exists avatar_update on storage.objects;
drop policy if exists avatar_delete on storage.objects;
