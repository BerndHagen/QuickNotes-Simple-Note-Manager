-- Persisted organization and template systems, version-history clarity, and
-- server-side trash retention for QuickNotes workspaces.

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    constraint saved_views_user_id_fkey references auth.users (id) on delete cascade,
  name text not null,
  icon text not null default 'ListFilter',
  color text not null default '#0f766e',
  criteria jsonb not null default '{"match":"all","rules":[]}'::jsonb,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_views_name_valid check (
    char_length(name) between 1 and 80
    and name = btrim(name)
  ),
  constraint saved_views_icon_valid check (char_length(icon) between 1 and 50),
  constraint saved_views_color_valid check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint saved_views_criteria_valid check (
    jsonb_typeof(criteria) = 'object'
    and jsonb_typeof(criteria -> 'rules') = 'array'
    and coalesce(criteria ->> 'match', '') in ('all', 'any')
    and jsonb_array_length(criteria -> 'rules') between 1 and 12
    and pg_column_size(criteria) <= 32768
  )
);

create unique index saved_views_user_name_lower_unique
  on public.saved_views (user_id, lower(name));
create index idx_saved_views_user_order
  on public.saved_views (user_id, sort_order nulls last, created_at);

create trigger update_saved_views_updated_at
before update on public.saved_views
for each row execute function public.update_updated_at_column();

alter table public.saved_views enable row level security;

create policy saved_views_access_own
on public.saved_views
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.saved_views from public, anon;
grant select, insert, update, delete on public.saved_views to authenticated;

create table public.note_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    constraint note_templates_user_id_fkey references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  note_type text not null default 'standard',
  title_template text not null default 'Untitled note',
  content text not null default '',
  note_data jsonb,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_templates_name_valid check (
    char_length(name) between 1 and 80
    and name = btrim(name)
  ),
  constraint note_templates_description_length check (char_length(description) <= 500),
  constraint note_templates_title_length check (char_length(title_template) <= 500),
  constraint note_templates_type_supported check (
    note_type in ('standard', 'todo', 'project', 'meeting', 'journal', 'brainstorm', 'shopping', 'weekly')
  ),
  constraint note_templates_data_size check (
    note_data is null or pg_column_size(note_data) <= 1048576
  ),
  constraint note_templates_tag_count check (cardinality(tags) <= 50)
);

create unique index note_templates_user_name_lower_unique
  on public.note_templates (user_id, lower(name));
create index idx_note_templates_user_favorite
  on public.note_templates (user_id, favorite desc, updated_at desc);

create trigger update_note_templates_updated_at
before update on public.note_templates
for each row execute function public.update_updated_at_column();

alter table public.note_templates enable row level security;

create policy note_templates_access_own
on public.note_templates
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.note_templates from public, anon;
grant select, insert, update, delete on public.note_templates to authenticated;

alter table public.note_versions
  add column change_kind text not null default 'edit',
  add column changed_fields text[] not null default '{}',
  add column snapshot_hash text;

update public.note_versions
set snapshot_hash = md5(
  jsonb_build_array(title, content, note_type, note_data)::text
)
where snapshot_hash is null;

alter table public.note_versions
  alter column snapshot_hash set not null,
  add constraint note_versions_change_kind_valid check (
    change_kind in ('edit', 'title', 'content', 'structured', 'mixed')
  ),
  add constraint note_versions_hash_valid check (snapshot_hash ~ '^[0-9a-f]{32}$');

create index idx_note_versions_note_hash
  on public.note_versions (note_id, snapshot_hash);

create or replace function private.create_note_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  changed text[] := array[]::text[];
  version_kind text := 'edit';
  version_hash text;
  latest_hash text;
begin
  if old.title is distinct from new.title then
    changed := array_append(changed, 'title');
  end if;
  if old.content is distinct from new.content then
    changed := array_append(changed, 'content');
  end if;
  if old.note_type is distinct from new.note_type
     or old.note_data is distinct from new.note_data then
    changed := array_append(changed, 'structured');
  end if;

  if cardinality(changed) = 0 then
    return new;
  end if;

  version_kind := case
    when cardinality(changed) > 1 then 'mixed'
    else changed[1]
  end;
  version_hash := md5(
    jsonb_build_array(old.title, old.content, old.note_type, old.note_data)::text
  );

  select version.snapshot_hash
  into latest_hash
  from public.note_versions as version
  where version.note_id = old.id
  order by version.created_at desc, version.id desc
  limit 1;

  -- Multiple sync retries can replay the same document state. Do not create
  -- an adjacent duplicate, but preserve a later return to an older state as
  -- a legitimate recovery point.
  if latest_hash is distinct from version_hash then
    insert into public.note_versions (
      note_id,
      title,
      content,
      note_type,
      note_data,
      change_kind,
      changed_fields,
      snapshot_hash
    )
    values (
      old.id,
      old.title,
      old.content,
      old.note_type,
      old.note_data,
      version_kind,
      changed,
      version_hash
    );
  end if;

  delete from public.note_versions
  where id in (
    select version.id
    from public.note_versions as version
    where version.note_id = old.id
    order by version.created_at desc, version.id desc
    offset 30
  );

  return new;
end;
$function$;

drop policy if exists note_versions_select_accessible on public.note_versions;
create policy note_versions_select_accessible
on public.note_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.notes as note
    where note.id = note_versions.note_id
      and (
        note.user_id = (select auth.uid())
        or (
          not note.deleted
          and exists (
            select 1
            from public.accepted_shares as accepted
            where accepted.note_id = note.id
              and accepted.user_id = (select auth.uid())
          )
        )
      )
  )
);

create index idx_notes_user_active_updated
  on public.notes (user_id, updated_at desc)
  where not deleted and not archived;
create index idx_notes_user_active_type
  on public.notes (user_id, note_type, updated_at desc)
  where not deleted and not archived;
create index idx_notes_user_active_starred
  on public.notes (user_id, updated_at desc)
  where starred and not deleted and not archived;
create index idx_notes_user_reminder
  on public.notes (user_id, reminder)
  where reminder is not null and not deleted;

create or replace function private.purge_my_expired_trash(p_retention_days integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  deleted_count bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_retention_days < 1 or p_retention_days > 365 then
    raise exception 'Retention must be between 1 and 365 days' using errcode = '22023';
  end if;

  delete from public.notes
  where user_id = (select auth.uid())
    and deleted
    and deleted_at is not null
    and deleted_at < now() - make_interval(days => p_retention_days);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke execute on function private.purge_my_expired_trash(integer)
from public, anon;
grant execute on function private.purge_my_expired_trash(integer)
to authenticated, service_role;

create or replace function public.purge_my_expired_trash(p_retention_days integer default 30)
returns bigint
language sql
set search_path = ''
as $function$
  select private.purge_my_expired_trash(p_retention_days);
$function$;

revoke execute on function public.purge_my_expired_trash(integer)
from public, anon;
grant execute on function public.purge_my_expired_trash(integer)
to authenticated;
