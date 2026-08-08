-- Use clean public usernames by default. A short numeric discriminator is
-- added only when two accounts genuinely request the same base username.

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

  return left(base_name, 32);
end;
$function$;

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

  return new;
end;
$function$;

do $block$
declare
  profile_record record;
  candidate_username text;
  suffix_number integer;
begin
  for profile_record in
    select
      profile.user_id,
      regexp_replace(profile.username, '-[0-9a-f]{8}$', '') as base_username
    from private.user_profiles as profile
    where profile.username ~ '-[0-9a-f]{8}$'
    order by profile.updated_at, profile.user_id
  loop
    candidate_username := left(profile_record.base_username, 32);
    suffix_number := 1;

    while exists (
      select 1
      from private.user_profiles as existing
      where existing.username = candidate_username
        and existing.user_id <> profile_record.user_id
    ) loop
      suffix_number := suffix_number + 1;
      candidate_username :=
        left(profile_record.base_username, 32 - char_length('-' || suffix_number::text))
        || '-' || suffix_number::text;
    end loop;

    update private.user_profiles
    set username = candidate_username,
        updated_at = now()
    where user_id = profile_record.user_id;
  end loop;
end;
$block$;

revoke all on function private.generate_username(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function private.handle_auth_user_profile() from public, anon, authenticated;
