-- Task-4 client sync lifecycle. Capture tables publish bounded row changes,
-- and binary cleanup uses one owner-scoped, reference-aware database decision
-- before the client removes the corresponding private Storage object.

alter table public.resources replica identity full;
alter table public.note_resources replica identity full;
alter table public.recognized_content replica identity full;

do $migration$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resources'
  ) then
    alter publication supabase_realtime add table public.resources;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_resources'
  ) then
    alter publication supabase_realtime add table public.note_resources;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recognized_content'
  ) then
    alter publication supabase_realtime add table public.recognized_content;
  end if;
end;
$migration$;

create or replace function private.retain_referenced_resource()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Cascading account/note cleanup and the existing trusted orphan collector
  -- already control their dependency order. Guard direct client deletes.
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

create trigger retain_referenced_resource_before_delete
before delete on public.resources
for each row execute function private.retain_referenced_resource();

revoke all on function private.retain_referenced_resource() from public, anon, authenticated;
