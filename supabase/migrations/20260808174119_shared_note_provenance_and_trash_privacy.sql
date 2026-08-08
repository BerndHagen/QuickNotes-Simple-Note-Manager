-- Keep collaboration useful without disclosing account email addresses, and
-- pause every collaborator grant while an owner has a note in Trash.

drop policy if exists notes_select_accessible on public.notes;
create policy notes_select_accessible
on public.notes
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    not deleted
    and exists (
      select 1
      from public.accepted_shares as accepted
      where accepted.note_id = notes.id
        and accepted.user_id = (select auth.uid())
    )
  )
);

create or replace function private.ensure_active_share_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.notes as note
    where note.id = new.note_id
      and note.user_id = new.shared_by
      and not note.deleted
  ) then
    raise exception 'Only an active note owned by the sender can be shared'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists ensure_active_share_note on public.shared_notes;
create trigger ensure_active_share_note
before insert or update of note_id, shared_by on public.shared_notes
for each row execute function private.ensure_active_share_note();

create or replace function private.ensure_active_accepted_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.notes as note
    where note.id = new.note_id
      and not note.deleted
  ) then
    raise exception 'This share is unavailable while the note is in Trash'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists ensure_active_accepted_note on public.accepted_shares;
create trigger ensure_active_accepted_note
before insert or update of note_id on public.accepted_shares
for each row execute function private.ensure_active_accepted_note();

create or replace function private.update_shared_note(
  p_note_id uuid,
  p_patch jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'A JSON object patch is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as patch_key
    where patch_key not in ('title', 'content', 'note_type', 'note_data')
  ) then
    raise exception 'The shared-note patch contains unsupported fields'
      using errcode = '22023';
  end if;

  if p_patch ? 'title'
     and (
       p_patch ->> 'title' is null
       or char_length(p_patch ->> 'title') > 500
     ) then
    raise exception 'The note title is invalid' using errcode = '22023';
  end if;

  if p_patch ? 'note_type'
     and (p_patch ->> 'note_type') not in (
       'standard',
       'todo',
       'project',
       'meeting',
       'journal',
       'brainstorm',
       'shopping',
       'weekly'
     ) then
    raise exception 'The note type is invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.accepted_shares as accepted
    join public.notes as note on note.id = accepted.note_id
    where accepted.note_id = p_note_id
      and accepted.user_id = current_user_id
      and accepted.permission = 'edit'
      and not note.deleted
  ) then
    raise exception 'Edit permission is required for an active shared note'
      using errcode = '42501';
  end if;

  update public.notes
  set title = case
        when p_patch ? 'title' then p_patch ->> 'title'
        else title
      end,
      content = case
        when p_patch ? 'content' then coalesce(p_patch ->> 'content', '')
        else content
      end,
      note_type = case
        when p_patch ? 'note_type' then p_patch ->> 'note_type'
        else note_type
      end,
      note_data = case
        when p_patch ? 'note_data'
          then nullif(p_patch -> 'note_data', 'null'::jsonb)
        else note_data
      end,
      updated_at = now()
  where id = p_note_id
    and not deleted;

  return found;
end;
$function$;

create or replace function private.get_pending_share_invitations()
returns table (
  id uuid,
  note_id uuid,
  permission text,
  status text,
  created_at timestamptz,
  note_title text,
  owner_name text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    share.id,
    share.note_id,
    share.permission,
    share.status,
    share.created_at,
    note.title as note_title,
    coalesce(
      nullif(trim(concat_ws(
        ' ',
        owner.raw_user_meta_data ->> 'first_name',
        owner.raw_user_meta_data ->> 'last_name'
      )), ''),
      nullif(trim(owner.raw_user_meta_data ->> 'full_name'), ''),
      'Another QuickNotes user'
    ) as owner_name
  from public.shared_notes as share
  join public.notes as note
    on note.id = share.note_id
    and not note.deleted
  join auth.users as owner
    on owner.id = share.shared_by
  where auth.uid() is not null
    and share.status = 'pending'
    and (
      share.shared_with = auth.uid()
      or lower(share.email) = lower((
        select current_user_record.email
        from auth.users as current_user_record
        where current_user_record.id = auth.uid()
      ))
    )
  order by share.created_at desc;
$function$;

create or replace function private.get_shared_notes()
returns table (
  id uuid,
  note_id uuid,
  permission text,
  created_at timestamptz,
  owner_id uuid,
  owner_name text,
  note_title text,
  note_content text,
  note_folder_id uuid,
  note_tags text[],
  note_starred boolean,
  note_pinned boolean,
  note_archived boolean,
  note_type text,
  note_data jsonb,
  note_created_at timestamptz,
  note_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    accepted.id,
    accepted.note_id,
    accepted.permission,
    accepted.created_at,
    note.user_id as owner_id,
    coalesce(
      nullif(trim(concat_ws(
        ' ',
        owner.raw_user_meta_data ->> 'first_name',
        owner.raw_user_meta_data ->> 'last_name'
      )), ''),
      nullif(trim(owner.raw_user_meta_data ->> 'full_name'), ''),
      'Another QuickNotes user'
    ) as owner_name,
    note.title,
    note.content,
    note.folder_id,
    note.tags,
    note.starred,
    note.pinned,
    note.archived,
    note.note_type,
    note.note_data,
    note.created_at,
    note.updated_at
  from public.accepted_shares as accepted
  join public.notes as note
    on note.id = accepted.note_id
    and not note.deleted
  join auth.users as owner
    on owner.id = note.user_id
  where auth.uid() is not null
    and accepted.user_id = auth.uid()
  order by note.updated_at desc;
$function$;

create or replace function public.get_shared_notes()
returns table (
  id uuid,
  note_id uuid,
  permission text,
  created_at timestamptz,
  owner_id uuid,
  owner_name text,
  note_title text,
  note_content text,
  note_folder_id uuid,
  note_tags text[],
  note_starred boolean,
  note_pinned boolean,
  note_archived boolean,
  note_type text,
  note_data jsonb,
  note_created_at timestamptz,
  note_updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_shared_notes();
$function$;

revoke all on function private.ensure_active_share_note() from public, anon, authenticated;
revoke all on function private.ensure_active_accepted_note() from public, anon, authenticated;
revoke all on function private.get_shared_notes() from public, anon, authenticated;
revoke all on function public.get_shared_notes() from public, anon;

grant execute on function private.get_shared_notes() to authenticated, service_role;
grant execute on function public.get_shared_notes() to authenticated;
