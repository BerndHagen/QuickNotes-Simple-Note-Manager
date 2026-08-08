-- An explicitly chosen username is never mutated. Numeric suffixes are used
-- only as a defensive fallback for accounts created outside the QuickNotes
-- registration flow without a username.

create or replace function private.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
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
        if requested_username is not null then
          raise exception 'That username is already in use' using errcode = '23505';
        end if;

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

create or replace function private.username_is_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    trim(p_username) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$'
    and not exists (
      select 1
      from private.user_profiles as profile
      where lower(profile.username) = lower(trim(p_username))
    );
$function$;

create or replace function public.username_is_available(p_username text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.username_is_available(p_username);
$function$;

revoke all on function private.handle_auth_user_profile() from public, anon, authenticated;
revoke all on function private.username_is_available(text) from public, anon, authenticated;
revoke all on function public.username_is_available(text) from public;

grant execute on function private.username_is_available(text) to anon, authenticated, service_role;
grant execute on function public.username_is_available(text) to anon, authenticated;
