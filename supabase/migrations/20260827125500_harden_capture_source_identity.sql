-- Keep canonical source identity immutable and avoid an RLS dependency cycle
-- between note_resources and resources. Foreign keys validate existence;
-- authenticated clients may update labels/roles, not re-point a link.

create or replace function private.preserve_note_resource_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id <> old.id
    or new.note_id <> old.note_id
    or new.user_id <> old.user_id
    or new.resource_id <> old.resource_id
    or new.resource_user_id <> old.resource_user_id then
    raise exception 'A note resource link cannot be reassigned' using errcode = '22023';
  end if;
  return new;
end;
$function$;

create trigger preserve_note_resource_identity_before_update
before update on public.note_resources
for each row execute function private.preserve_note_resource_identity();

create or replace function private.preserve_recognition_source_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id <> old.id
    or new.note_id <> old.note_id
    or new.user_id <> old.user_id
    or new.source_kind <> old.source_kind
    or new.recognition_type <> old.recognition_type
    or new.source_resource_id is distinct from old.source_resource_id
    or new.source_resource_user_id is distinct from old.source_resource_user_id
    or new.source_object_ids is distinct from old.source_object_ids
    or new.source_page_id is distinct from old.source_page_id
    or new.source_page_number is distinct from old.source_page_number then
    raise exception 'A recognition row cannot be reassigned to another source' using errcode = '22023';
  end if;
  return new;
end;
$function$;

create trigger preserve_recognition_source_identity_before_update
before update on public.recognized_content
for each row execute function private.preserve_recognition_source_identity();

drop policy note_resources_insert_editable on public.note_resources;
create policy note_resources_insert_editable on public.note_resources
for insert to authenticated with check (
  resource_user_id = (select auth.uid())
  and exists (
    select 1 from public.notes as note
    where note.id = note_resources.note_id
      and note.user_id = note_resources.user_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id
            and accepted.user_id = (select auth.uid())
            and accepted.permission = 'edit'
        )
      )
  )
);

drop policy note_resources_update_editable on public.note_resources;
create policy note_resources_update_editable on public.note_resources
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = note_resources.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
)
with check (
  exists (
    select 1 from public.notes as note
    where note.id = note_resources.note_id
      and note.user_id = note_resources.user_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id
            and accepted.user_id = (select auth.uid())
            and accepted.permission = 'edit'
        )
      )
  )
);

revoke all on function private.preserve_note_resource_identity() from public, anon, authenticated;
revoke all on function private.preserve_recognition_source_identity() from public, anon, authenticated;
