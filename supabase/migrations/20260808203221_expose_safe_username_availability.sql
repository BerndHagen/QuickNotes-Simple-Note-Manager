-- The public wrapper reveals only a boolean and executes with its owner's
-- access. Anonymous registration clients never receive access to the private
-- profile schema or its rows.

create or replace function public.username_is_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.username_is_available(p_username);
$function$;

revoke all on function public.username_is_available(text) from public;
grant execute on function public.username_is_available(text) to anon, authenticated;
