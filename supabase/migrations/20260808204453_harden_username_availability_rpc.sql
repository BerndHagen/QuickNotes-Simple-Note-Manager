-- Let the anonymous registration screen resolve only the safe boolean helper.
-- The public RPC remains SECURITY INVOKER; profile rows and every other
-- private function stay inaccessible.

revoke execute on all functions in schema private from anon;
grant usage on schema private to anon;
grant execute on function private.username_is_available(text) to anon;

create or replace function public.username_is_available(p_username text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.username_is_available(p_username);
$function$;

revoke all on function public.username_is_available(text) from public;
grant execute on function public.username_is_available(text) to anon, authenticated;
