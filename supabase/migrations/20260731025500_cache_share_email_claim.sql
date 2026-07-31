drop policy if exists shared_notes_select_involved
on public.shared_notes;

create policy shared_notes_select_involved
on public.shared_notes
for select
to authenticated
using (
  shared_by = (select auth.uid())
  or shared_with = (select auth.uid())
  or lower(email) = lower(((select auth.jwt()) ->> 'email'))
);
