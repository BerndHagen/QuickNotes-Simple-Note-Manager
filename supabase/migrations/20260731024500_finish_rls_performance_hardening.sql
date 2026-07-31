-- Cover composite foreign keys and ensure every auth helper in RLS is planned
-- once per statement.

create index if not exists idx_folders_parent_owner
  on public.folders (parent_id, user_id);

create index if not exists idx_notes_folder_owner
  on public.notes (folder_id, user_id);

create index if not exists idx_shared_notes_note_owner
  on public.shared_notes (note_id, shared_by);

drop policy if exists shared_notes_select_involved
on public.shared_notes;

create policy shared_notes_select_involved
on public.shared_notes
for select
to authenticated
using (
  shared_by = (select auth.uid())
  or shared_with = (select auth.uid())
  or lower(email) = (select lower(auth.jwt() ->> 'email'))
);
