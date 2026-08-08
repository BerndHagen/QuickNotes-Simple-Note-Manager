-- QuickNotes has one public identity: a case-preserving username. It is used
-- in the account UI and as sharing provenance. Uniqueness remains
-- case-insensitive so VampyrusNoctis and vampyrusnoctis cannot be different
-- accounts.

alter table private.user_profiles
  drop constraint if exists user_profiles_username_key;

alter table private.user_profiles
  drop constraint if exists user_profiles_username_format;

drop index if exists private.user_profiles_username_lower_unique;

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
  base_name := coalesce(
    nullif(trim(p_metadata ->> 'username'), ''),
    nullif(trim(p_metadata ->> 'first_name'), ''),
    nullif(trim(p_metadata ->> 'full_name'), ''),
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    'User'
  );
  base_name := trim(both '-' from regexp_replace(base_name, '[^A-Za-z0-9._-]+', '-', 'g'));
  if char_length(base_name) < 3 then
    base_name := 'User';
  end if;

  return left(base_name, 32);
end;
$function$;

do $block$
declare
  profile_record record;
  base_username text;
  candidate_username text;
  suffix_number integer;
begin
  for profile_record in
    select
      profile.user_id,
      coalesce(auth_user.raw_user_meta_data, '{}'::jsonb) as metadata,
      auth_user.email
    from private.user_profiles as profile
    join auth.users as auth_user on auth_user.id = profile.user_id
    order by profile.updated_at, profile.user_id
  loop
    base_username := private.generate_username(
      profile_record.user_id,
      profile_record.metadata,
      profile_record.email
    );
    candidate_username := base_username;
    suffix_number := 1;

    while exists (
      select 1
      from private.user_profiles as existing
      where lower(existing.username) = lower(candidate_username)
        and existing.user_id <> profile_record.user_id
    ) loop
      suffix_number := suffix_number + 1;
      candidate_username :=
        left(base_username, 32 - char_length('-' || suffix_number::text))
        || '-' || suffix_number::text;
    end loop;

    update private.user_profiles
    set username = candidate_username,
        updated_at = now()
    where user_id = profile_record.user_id;
  end loop;
end;
$block$;

alter table private.user_profiles
  add constraint user_profiles_username_format check (
    char_length(username) between 3 and 32
    and username = trim(username)
    and username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$'
  );

create unique index user_profiles_username_lower_unique
  on private.user_profiles (lower(username));

create or replace function private.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  base_username text;
  candidate_username text;
  suffix_number integer := 1;
begin
  if exists (
    select 1
    from private.user_profiles as profile
    where profile.user_id = new.id
  ) then
    return new;
  end if;

  base_username := private.generate_username(
    new.id,
    coalesce(new.raw_user_meta_data, '{}'::jsonb),
    new.email
  );
  candidate_username := base_username;

  loop
    begin
      insert into private.user_profiles (user_id, username)
      values (new.id, candidate_username);
      exit;
    exception
      when unique_violation then
        suffix_number := suffix_number + 1;
        if suffix_number > 9999 then
          raise exception 'Unable to allocate a unique username';
        end if;
        candidate_username :=
          left(base_username, 32 - char_length('-' || suffix_number::text))
          || '-' || suffix_number::text;
    end;
  end loop;

  update auth.users as account
  set raw_user_meta_data =
    (coalesce(account.raw_user_meta_data, '{}'::jsonb)
      - 'first_name' - 'last_name' - 'full_name')
    || jsonb_build_object('username', candidate_username)
  where account.id = new.id;

  return new;
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
  requested_username text := trim(p_username);
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if requested_username is null
     or char_length(requested_username) not between 3 and 32
     or requested_username !~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$' then
    raise exception 'Use 3-32 letters, numbers, dots, underscores, or hyphens'
      using errcode = '22023';
  end if;

  update private.user_profiles
  set username = requested_username,
      updated_at = now()
  where user_id = current_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  update auth.users as account
  set raw_user_meta_data =
    (coalesce(account.raw_user_meta_data, '{}'::jsonb)
      - 'first_name' - 'last_name' - 'full_name')
    || jsonb_build_object('username', requested_username)
  where account.id = current_user_id;

  return requested_username;
exception
  when unique_violation then
    raise exception 'That username is already in use' using errcode = '23505';
end;
$function$;

update auth.users as account
set raw_user_meta_data =
  (coalesce(account.raw_user_meta_data, '{}'::jsonb)
    - 'first_name' - 'last_name' - 'full_name')
  || jsonb_build_object('username', profile.username)
from private.user_profiles as profile
where profile.user_id = account.id;

revoke all on function private.generate_username(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function private.handle_auth_user_profile() from public, anon, authenticated;
revoke all on function private.update_my_username(text) from public, anon, authenticated;
revoke all on function public.update_my_username(text) from public, anon;

grant execute on function private.update_my_username(text) to authenticated, service_role;
grant execute on function public.update_my_username(text) to authenticated;
