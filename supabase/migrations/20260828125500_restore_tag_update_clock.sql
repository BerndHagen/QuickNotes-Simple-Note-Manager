-- The live production tags table predates the repository's updated_at column.
-- Without a server clock, two devices cannot distinguish a stale tag update
-- from an in-flight edit and the refreshed collection can discard local work.

alter table public.tags
  add column if not exists updated_at timestamptz not null default now();

do $block$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.tags'::regclass
      and tgname = 'set_tags_updated_at'
      and not tgisinternal
  ) then
    create trigger set_tags_updated_at
    before update on public.tags
    for each row execute function public.update_updated_at_column();
  end if;
end;
$block$;
