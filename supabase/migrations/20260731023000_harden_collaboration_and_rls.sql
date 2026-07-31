-- QuickNotes collaboration, history, and tenant-isolation hardening.
-- This migration intentionally moves all sharing mutations behind audited RPCs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- Normalize existing collaboration records before adding stronger constraints.
alter table public.shared_notes
  drop constraint if exists email_or_user;

update public.shared_notes as share
set email = lower(trim(auth_user.email))
from auth.users as auth_user
where share.shared_with = auth_user.id
  and share.email is null;

update public.shared_notes
set email = lower(trim(email))
where email is not null
  and email is distinct from lower(trim(email));

alter table public.shared_notes
  alter column email set not null;

alter table public.shared_notes
  add constraint shared_notes_email_present
  check (char_length(email) between 3 and 320);

update public.shared_notes
set share_link = replace(gen_random_uuid()::text, '-', '')
where share_link is null;

alter table public.shared_notes
  alter column share_link set default replace(gen_random_uuid()::text, '-', ''),
  alter column share_link set not null;

create unique index if not exists shared_notes_active_email_unique
  on public.shared_notes (note_id, lower(email))
  where status in ('pending', 'accepted');

create unique index if not exists shared_notes_active_user_unique
  on public.shared_notes (note_id, shared_with)
  where shared_with is not null and status = 'accepted';

create index if not exists idx_folders_parent_id
  on public.folders (parent_id);

create index if not exists idx_shared_notes_shared_by
  on public.shared_notes (shared_by);

create index if not exists idx_note_versions_note_created
  on public.note_versions (note_id, created_at desc);

-- Prevent cross-account folder references even when a UUID is known.
alter table public.folders
  add constraint folders_id_user_id_unique unique (id, user_id);

alter table public.notes
  add constraint notes_id_user_id_unique unique (id, user_id);

alter table public.folders
  drop constraint if exists folders_parent_id_fkey;

alter table public.folders
  add constraint folders_parent_owner_fkey
  foreign key (parent_id, user_id)
  references public.folders (id, user_id)
  on delete set null (parent_id);

alter table public.notes
  drop constraint if exists notes_folder_id_fkey;

alter table public.notes
  add constraint notes_folder_owner_fkey
  foreign key (folder_id, user_id)
  references public.folders (id, user_id)
  on delete set null (folder_id);

alter table public.shared_notes
  drop constraint if exists shared_notes_note_id_fkey;

alter table public.shared_notes
  add constraint shared_notes_note_owner_fkey
  foreign key (note_id, shared_by)
  references public.notes (id, user_id)
  on delete cascade;

-- Tie accepted access to one concrete invitation so revocation cascades.
alter table public.accepted_shares
  add column if not exists share_id uuid;

update public.accepted_shares as accepted
set share_id = (
  select share.id
  from public.shared_notes as share
  left join auth.users as auth_user
    on auth_user.id = accepted.user_id
  where share.note_id = accepted.note_id
    and share.status = 'accepted'
    and (
      share.shared_with = accepted.user_id
      or (
        share.email is not null
        and auth_user.email is not null
        and lower(share.email) = lower(auth_user.email)
      )
  )
  order by share.updated_at desc nulls last, share.created_at desc
  limit 1
)
where accepted.share_id is null;

-- Rows without an accepted invitation are stale authorization grants.
delete from public.accepted_shares
where share_id is null;

alter table public.accepted_shares
  alter column share_id set not null;

alter table public.accepted_shares
  add constraint accepted_shares_share_id_fkey
  foreign key (share_id)
  references public.shared_notes (id)
  on delete cascade;

alter table public.accepted_shares
  add constraint accepted_shares_share_id_key unique (share_id);

-- Structured note versions must capture the data users actually edit.
alter table public.note_versions
  add column if not exists note_type text,
  add column if not exists note_data jsonb;

update public.notes
set content = ''
where content is null;

alter table public.notes
  alter column content set not null;

create or replace function private.create_note_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.title is distinct from new.title
     or old.content is distinct from new.content
     or old.note_type is distinct from new.note_type
     or old.note_data is distinct from new.note_data then
    insert into public.note_versions (
      note_id,
      title,
      content,
      note_type,
      note_data
    )
    values (
      old.id,
      old.title,
      old.content,
      old.note_type,
      old.note_data
    );

    delete from public.note_versions
    where id in (
      select version.id
      from public.note_versions as version
      where version.note_id = old.id
      order by version.created_at desc, version.id desc
      offset 30
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists create_note_version_on_update on public.notes;
create trigger create_note_version_on_update
before update on public.notes
for each row
execute function private.create_note_version();

drop function if exists public.create_note_version();

-- Drop every existing policy on these tables so the set below is exhaustive:
-- one policy per table and operation, and nothing else.
do $block$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'notes',
        'folders',
        'tags',
        'note_versions',
        'shared_notes',
        'accepted_shares'
      )
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$block$;

alter table public.notes enable row level security;
alter table public.folders enable row level security;
alter table public.tags enable row level security;
alter table public.note_versions enable row level security;
alter table public.shared_notes enable row level security;
alter table public.accepted_shares enable row level security;

create policy notes_select_accessible
on public.notes
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.accepted_shares as accepted
    where accepted.note_id = notes.id
      and accepted.user_id = (select auth.uid())
  )
);

create policy notes_insert_own
on public.notes
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy notes_update_own
on public.notes
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notes_delete_own
on public.notes
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy folders_access_own
on public.folders
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy tags_access_own
on public.tags
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy note_versions_select_accessible
on public.note_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.notes as note
    where note.id = note_versions.note_id
  )
);

create policy note_versions_delete_own
on public.note_versions
for delete
to authenticated
using (
  exists (
    select 1
    from public.notes as note
    where note.id = note_versions.note_id
      and note.user_id = (select auth.uid())
  )
);

create policy shared_notes_select_involved
on public.shared_notes
for select
to authenticated
using (
  shared_by = (select auth.uid())
  or shared_with = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
);

create policy accepted_shares_select_own
on public.accepted_shares
for select
to authenticated
using (user_id = (select auth.uid()));

-- An unauthenticated browser never needs direct database access.
revoke all on all tables in schema public from anon;
revoke all on public.notes,
  public.folders,
  public.tags,
  public.note_versions,
  public.shared_notes,
  public.accepted_shares
from authenticated;

grant select, insert, update, delete
on public.notes, public.folders, public.tags
to authenticated;

grant select
on public.note_versions, public.shared_notes, public.accepted_shares
to authenticated;

-- Private implementations validate the authenticated principal and expose only
-- the fields each collaboration action is allowed to change.
create or replace function private.create_share_invitation(
  p_note_id uuid,
  p_email text,
  p_permission text default 'view'
)
returns public.shared_notes
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(trim(p_email));
  current_user_email text;
  created_share public.shared_notes;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_permission not in ('view', 'edit') then
    raise exception 'Permission must be view or edit' using errcode = '22023';
  end if;

  if normalized_email is null
     or char_length(normalized_email) > 320
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.notes as note
    where note.id = p_note_id
      and note.user_id = current_user_id
  ) then
    raise exception 'Note not found or not owned by the current user'
      using errcode = '42501';
  end if;

  select lower(auth_user.email)
  into current_user_email
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  if normalized_email = current_user_email then
    raise exception 'You cannot share a note with yourself'
      using errcode = '22023';
  end if;

  begin
    insert into public.shared_notes (
      note_id,
      shared_by,
      email,
      permission,
      status,
      share_link
    )
    values (
      p_note_id,
      current_user_id,
      normalized_email,
      p_permission,
      'pending',
      replace(gen_random_uuid()::text, '-', '')
    )
    returning * into created_share;
  exception
    when unique_violation then
      raise exception 'This note already has an active share for that email'
        using errcode = '23505';
  end;

  return created_share;
end;
$function$;

create or replace function private.accept_share_invitation(p_share_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  invitation public.shared_notes;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select lower(auth_user.email)
  into current_user_email
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  select share.*
  into invitation
  from public.shared_notes as share
  where share.id = p_share_id
    and share.status = 'pending'
    and (
      share.shared_with = current_user_id
      or lower(share.email) = current_user_email
    )
  for update;

  if not found then
    return false;
  end if;

  update public.shared_notes
  set status = 'accepted',
      shared_with = current_user_id,
      updated_at = now()
  where id = invitation.id;

  insert into public.accepted_shares (
    share_id,
    note_id,
    user_id,
    permission
  )
  values (
    invitation.id,
    invitation.note_id,
    current_user_id,
    invitation.permission
  )
  on conflict (note_id, user_id) do update
  set share_id = excluded.share_id,
      permission = excluded.permission;

  return true;
end;
$function$;

create or replace function private.decline_share_invitation(p_share_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select lower(auth_user.email)
  into current_user_email
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  update public.shared_notes
  set status = 'declined',
      shared_with = current_user_id,
      updated_at = now()
  where id = p_share_id
    and status = 'pending'
    and (
      shared_with = current_user_id
      or lower(email) = current_user_email
    );

  return found;
end;
$function$;

create or replace function private.revoke_share_invitation(p_share_id uuid)
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

  delete from public.shared_notes
  where id = p_share_id
    and shared_by = current_user_id;

  return found;
end;
$function$;

create or replace function private.leave_shared_note(p_note_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  affected_share_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select accepted.share_id
  into affected_share_id
  from public.accepted_shares as accepted
  where accepted.note_id = p_note_id
    and accepted.user_id = current_user_id
  for update;

  if not found then
    return false;
  end if;

  delete from public.accepted_shares
  where share_id = affected_share_id
    and user_id = current_user_id;

  update public.shared_notes
  set status = 'declined',
      updated_at = now()
  where id = affected_share_id
    and shared_with = current_user_id;

  return true;
end;
$function$;

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
    where accepted.note_id = p_note_id
      and accepted.user_id = current_user_id
      and accepted.permission = 'edit'
  ) then
    raise exception 'Edit permission is required' using errcode = '42501';
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
  where id = p_note_id;

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
      nullif(
        trim(
          concat_ws(
            ' ',
            owner.raw_user_meta_data ->> 'first_name',
            owner.raw_user_meta_data ->> 'last_name'
          )
        ),
        ''
      ),
      'Another QuickNotes user'
    ) as owner_name
  from public.shared_notes as share
  join public.notes as note
    on note.id = share.note_id
  join auth.users as owner
    on owner.id = share.shared_by
  where auth.uid() is not null
    and share.status = 'pending'
    and (
      share.shared_with = auth.uid()
      or lower(share.email) = lower(
        (
          select current_user_record.email
          from auth.users as current_user_record
          where current_user_record.id = auth.uid()
        )
      )
    )
  order by share.created_at desc;
$function$;

create or replace function private.delete_user_account()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select lower(auth_user.email)
  into current_user_email
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  -- Remove email-only invitations as well as rows linked by foreign keys.
  delete from public.shared_notes
  where lower(email) = current_user_email;

  delete from auth.users
  where id = current_user_id;

  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
end;
$function$;

-- Public API wrappers remain SECURITY INVOKER. The privileged implementation is
-- kept outside the exposed API schema.
create or replace function public.create_share_invitation(
  p_note_id uuid,
  p_email text,
  p_permission text default 'view'
)
returns public.shared_notes
language sql
security invoker
set search_path = ''
as $function$
  select private.create_share_invitation(p_note_id, p_email, p_permission);
$function$;

create or replace function public.accept_share_invitation(p_share_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.accept_share_invitation(p_share_id);
$function$;

create or replace function public.decline_share_invitation(p_share_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.decline_share_invitation(p_share_id);
$function$;

create or replace function public.revoke_share_invitation(p_share_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.revoke_share_invitation(p_share_id);
$function$;

create or replace function public.leave_shared_note(p_note_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.leave_shared_note(p_note_id);
$function$;

create or replace function public.update_shared_note(
  p_note_id uuid,
  p_patch jsonb
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.update_shared_note(p_note_id, p_patch);
$function$;

create or replace function public.get_pending_share_invitations()
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
security invoker
set search_path = ''
as $function$
  select * from private.get_pending_share_invitations();
$function$;

create or replace function public.delete_user_account()
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.delete_user_account();
$function$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.create_share_invitation(uuid, text, text) from public, anon;
revoke all on function public.accept_share_invitation(uuid) from public, anon;
revoke all on function public.decline_share_invitation(uuid) from public, anon;
revoke all on function public.revoke_share_invitation(uuid) from public, anon;
revoke all on function public.leave_shared_note(uuid) from public, anon;
revoke all on function public.update_shared_note(uuid, jsonb) from public, anon;
revoke all on function public.get_pending_share_invitations() from public, anon;
revoke all on function public.delete_user_account() from public, anon;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;

grant execute on function private.create_share_invitation(uuid, text, text) to authenticated, service_role;
grant execute on function private.accept_share_invitation(uuid) to authenticated, service_role;
grant execute on function private.decline_share_invitation(uuid) to authenticated, service_role;
grant execute on function private.revoke_share_invitation(uuid) to authenticated, service_role;
grant execute on function private.leave_shared_note(uuid) to authenticated, service_role;
grant execute on function private.update_shared_note(uuid, jsonb) to authenticated, service_role;
grant execute on function private.get_pending_share_invitations() to authenticated, service_role;
grant execute on function private.delete_user_account() to authenticated, service_role;
grant execute on function public.create_share_invitation(uuid, text, text) to authenticated;
grant execute on function public.accept_share_invitation(uuid) to authenticated;
grant execute on function public.decline_share_invitation(uuid) to authenticated;
grant execute on function public.revoke_share_invitation(uuid) to authenticated;
grant execute on function public.leave_shared_note(uuid) to authenticated;
grant execute on function public.update_shared_note(uuid, jsonb) to authenticated;
grant execute on function public.get_pending_share_invitations() to authenticated;
grant execute on function public.delete_user_account() to authenticated;
