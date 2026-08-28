-- Recognition retains the immutable source that produced it, even after an
-- image placement is removed and the recognition becomes stale. Collection
-- becomes legal only after note links, spatial placements, and recognition
-- provenance have all released the resource.

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

create or replace function private.delete_orphaned_spatial_resource()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  deleted_resource_id uuid;
begin
  if old.kind <> 'image' or old.data ->> 'resourceId' is null then
    return old;
  end if;
  begin
    deleted_resource_id := (old.data ->> 'resourceId')::uuid;
  exception when invalid_text_representation then
    return old;
  end;
  delete from public.resources as resource
  where resource.id = deleted_resource_id
    and not exists (
      select 1 from public.spatial_objects as object
      where object.data ->> 'resourceId' = deleted_resource_id::text
    )
    and not exists (
      select 1 from public.note_resources as link
      where link.resource_id = deleted_resource_id
    )
    and not exists (
      select 1 from public.recognized_content as recognition
      where recognition.source_resource_id = deleted_resource_id
    );
  return old;
end;
$function$;

revoke all on function private.retain_referenced_resource() from public, anon, authenticated;
revoke all on function private.delete_orphaned_spatial_resource() from public, anon, authenticated;
