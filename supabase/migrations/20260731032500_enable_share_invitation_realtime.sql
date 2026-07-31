-- Invitation notifications subscribe to INSERT/UPDATE events on shared_notes.
-- Keep this idempotent so self-hosted deployments can apply it safely.
do $block$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shared_notes'
  ) then
    alter publication supabase_realtime add table public.shared_notes;
  end if;
end;
$block$;
