-- Give every cloud account a stable, user-editable username without exposing
-- auth.users or profile rows through the Data API.

create table private.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_format check (
    char_length(username) between 3 and 32
    and username = lower(username)
    and username ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'
  )
);

alter table private.user_profiles enable row level security;
revoke all on table private.user_profiles from public, anon, authenticated;

create or replace function private.generate_username(
  p_user_id uuid,
  p_metadata jsonb,
  p_email text
)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
declare
  base_name text;
begin
  base_name := lower(coalesce(
    nullif(trim(p_metadata ->> 'username'), ''),
    nullif(trim(concat_ws(' ', p_metadata ->> 'first_name', p_metadata ->> 'last_name')), ''),
    nullif(trim(p_metadata ->> 'full_name'), ''),
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    'user'
  ));
  base_name := trim(both '-' from regexp_replace(base_name, '[^a-z0-9]+', '-', 'g'));
  if char_length(base_name) < 3 then
    base_name := 'user';
  end if;

  return left(base_name, 23) || '-' || left(replace(p_user_id::text, '-', ''), 8);
end;
$function$;

insert into private.user_profiles (user_id, username)
select
  auth_user.id,
  private.generate_username(
    auth_user.id,
    coalesce(auth_user.raw_user_meta_data, '{}'::jsonb),
    auth_user.email
  )
from auth.users as auth_user
on conflict (user_id) do nothing;

create or replace function private.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into private.user_profiles (user_id, username)
  values (
    new.id,
    private.generate_username(
      new.id,
      coalesce(new.raw_user_meta_data, '{}'::jsonb),
      new.email
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists quicknotes_create_user_profile on auth.users;
create trigger quicknotes_create_user_profile
after insert on auth.users
for each row execute function private.handle_auth_user_profile();

create or replace function private.get_my_username()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_username text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select profile.username
  into current_username
  from private.user_profiles as profile
  where profile.user_id = current_user_id;

  return current_username;
end;
$function$;

create or replace function private.update_my_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_username text := lower(trim(p_username));
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if normalized_username is null
     or char_length(normalized_username) not between 3 and 32
     or normalized_username !~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$' then
    raise exception 'Use 3-32 lowercase letters, numbers, dots, underscores, or hyphens'
      using errcode = '22023';
  end if;

  update private.user_profiles
  set username = normalized_username,
      updated_at = now()
  where user_id = current_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return normalized_username;
exception
  when unique_violation then
    raise exception 'That username is already in use' using errcode = '23505';
end;
$function$;

create or replace function public.get_my_username()
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_my_username();
$function$;

create or replace function public.update_my_username(p_username text)
returns text
language sql
security invoker
set search_path = ''
as $function$
  select private.update_my_username(p_username);
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
    owner_profile.username as owner_name
  from public.shared_notes as share
  join public.notes as note
    on note.id = share.note_id
    and not note.deleted
  join private.user_profiles as owner_profile
    on owner_profile.user_id = share.shared_by
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
    owner_profile.username as owner_name,
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
  join private.user_profiles as owner_profile
    on owner_profile.user_id = note.user_id
  where auth.uid() is not null
    and accepted.user_id = auth.uid()
  order by note.updated_at desc;
$function$;

revoke all on function private.generate_username(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function private.handle_auth_user_profile() from public, anon, authenticated;
revoke all on function private.get_my_username() from public, anon, authenticated;
revoke all on function private.update_my_username(text) from public, anon, authenticated;
revoke all on function public.get_my_username() from public, anon;
revoke all on function public.update_my_username(text) from public, anon;

grant usage on schema private to authenticated, service_role;
grant execute on function private.get_my_username() to authenticated, service_role;
grant execute on function private.update_my_username(text) to authenticated, service_role;
grant execute on function public.get_my_username() to authenticated;
grant execute on function public.update_my_username(text) to authenticated;
