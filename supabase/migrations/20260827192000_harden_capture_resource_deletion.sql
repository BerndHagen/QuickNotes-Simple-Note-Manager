-- Replace the initial public cleanup RPC with a private trigger guard. The
-- authenticated client still deletes only its own row through RLS, while the
-- trigger prevents deletion until every canonical note/spatial reference is
-- gone. This removes an exposed SECURITY DEFINER API surface.

drop function if exists public.delete_orphaned_capture_resource(uuid);

create or replace function private.retain_referenced_resource()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if pg_trigger_depth() = 1 and (
    exists (select 1 from public.note_resources where resource_id = old.id)
    or exists (select 1 from public.recognized_content where source_resource_id = old.id)
    or exists (
      select 1 from public.spatial_objects where data ->> 'resourceId' = old.id::text
    )
  ) then
    return null;
  end if;
  return old;
end;
$function$;

drop trigger if exists retain_referenced_resource_before_delete on public.resources;
create trigger retain_referenced_resource_before_delete
before delete on public.resources
for each row execute function private.retain_referenced_resource();

revoke all on function private.retain_referenced_resource() from public, anon, authenticated;
