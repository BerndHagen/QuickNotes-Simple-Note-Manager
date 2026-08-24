-- Keep the legacy function signature stable for existing trigger callers while
-- making the intentionally reserved account id explicit to PL/pgSQL's linter.
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
  perform p_user_id;

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

revoke all on function private.generate_username(uuid, jsonb, text)
from public, anon, authenticated;
