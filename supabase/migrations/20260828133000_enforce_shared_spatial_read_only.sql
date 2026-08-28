-- QuickNotes deliberately exposes shared Paper/Canvas and attachment graphs as
-- read-only until object-level concurrent editing has a safe conflict model.
-- Keep SELECT policies unchanged, but make the backend match that product
-- boundary so an edit-share recipient cannot bypass the client and mutate an
-- unsupported canonical graph.

drop policy if exists spatial_documents_insert_editable on public.spatial_documents;
drop policy if exists spatial_documents_update_editable on public.spatial_documents;
drop policy if exists spatial_documents_delete_editable on public.spatial_documents;

create policy spatial_documents_insert_owned on public.spatial_documents
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy spatial_documents_update_owned on public.spatial_documents
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy spatial_documents_delete_owned on public.spatial_documents
for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists spatial_pages_insert_editable on public.spatial_pages;
drop policy if exists spatial_pages_update_editable on public.spatial_pages;
drop policy if exists spatial_pages_delete_editable on public.spatial_pages;

create policy spatial_pages_insert_owned on public.spatial_pages
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy spatial_pages_update_owned on public.spatial_pages
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy spatial_pages_delete_owned on public.spatial_pages
for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists spatial_objects_insert_editable on public.spatial_objects;
drop policy if exists spatial_objects_update_editable on public.spatial_objects;
drop policy if exists spatial_objects_delete_editable on public.spatial_objects;

create policy spatial_objects_insert_owned on public.spatial_objects
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy spatial_objects_update_owned on public.spatial_objects
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy spatial_objects_delete_owned on public.spatial_objects
for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists note_resources_insert_editable on public.note_resources;
drop policy if exists note_resources_update_editable on public.note_resources;
drop policy if exists note_resources_delete_editable on public.note_resources;

create policy note_resources_insert_owned on public.note_resources
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and resource_user_id = (select auth.uid())
);

create policy note_resources_update_owned on public.note_resources
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy note_resources_delete_owned on public.note_resources
for delete to authenticated
using (user_id = (select auth.uid()));
