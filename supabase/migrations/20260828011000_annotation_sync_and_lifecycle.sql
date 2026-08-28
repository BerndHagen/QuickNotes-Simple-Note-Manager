-- Task-4 attachment annotation overlays. These rows reuse the canonical
-- Task-2 geometry contract but remain a dedicated graph and client outbox.
-- The immutable image/PDF resource remains the source of truth.

create table public.spatial_annotations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  resource_id uuid not null,
  resource_user_id uuid not null,
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  revision bigint not null default 0 check (revision >= 0),
  settings jsonb not null default '{}'::jsonb check (
    jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 65536
  ),
  viewport jsonb not null default '{}'::jsonb check (
    jsonb_typeof(viewport) = 'object' and pg_column_size(viewport) <= 8192
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spatial_annotations_resource_owner_fkey
    foreign key (resource_id, resource_user_id)
    references public.resources (id, user_id) on delete restrict,
  constraint spatial_annotations_identity_unique
    unique (id, user_id, note_id, resource_id),
  constraint spatial_annotations_note_resource_unique unique (note_id, resource_id)
);

create index idx_spatial_annotations_owner_updated
  on public.spatial_annotations (user_id, updated_at desc);
create index idx_spatial_annotations_note_resource
  on public.spatial_annotations (note_id, resource_id);
create index idx_spatial_annotations_resource
  on public.spatial_annotations (resource_id);

create table public.spatial_annotation_pages (
  id uuid primary key,
  annotation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete restrict,
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  page_number integer not null check (page_number between 1 and 100000),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  name text not null default '' check (char_length(name) <= 120),
  size text not null check (size in ('free', 'a4', 'a5', 'letter')),
  width double precision not null check (width between 320 and 4096),
  height double precision not null check (height between 320 and 4096),
  pattern text not null check (pattern in ('blank', 'ruled', 'dot', 'square', 'graph')),
  surface text not null check (surface in ('white', 'warm', 'cream', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spatial_annotation_pages_parent_fkey
    foreign key (annotation_id, user_id, note_id, resource_id)
    references public.spatial_annotations (id, user_id, note_id, resource_id)
    on delete cascade,
  constraint spatial_annotation_pages_identity_unique
    unique (id, annotation_id, user_id, note_id, resource_id),
  constraint spatial_annotation_pages_source_page_unique
    unique (annotation_id, page_number)
);

create index idx_spatial_annotation_pages_annotation_page
  on public.spatial_annotation_pages (annotation_id, page_number);

create table public.spatial_annotation_objects (
  id uuid primary key,
  annotation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete restrict,
  page_id uuid not null,
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  kind text not null check (kind in ('stroke', 'shape', 'text')),
  z_index integer not null default 0 check (z_index between -1000000 and 1000000),
  bounds jsonb not null check (
    jsonb_typeof(bounds) = 'object' and pg_column_size(bounds) <= 4096
  ),
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and pg_column_size(data) <= 2097152
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spatial_annotation_objects_parent_fkey
    foreign key (annotation_id, user_id, note_id, resource_id)
    references public.spatial_annotations (id, user_id, note_id, resource_id)
    on delete cascade,
  constraint spatial_annotation_objects_page_fkey
    foreign key (page_id, annotation_id, user_id, note_id, resource_id)
    references public.spatial_annotation_pages (id, annotation_id, user_id, note_id, resource_id)
    on delete cascade
);

create index idx_spatial_annotation_objects_annotation_z
  on public.spatial_annotation_objects (annotation_id, z_index);
create index idx_spatial_annotation_objects_page_z
  on public.spatial_annotation_objects (page_id, z_index);

alter table public.spatial_annotations enable row level security;
alter table public.spatial_annotation_pages enable row level security;
alter table public.spatial_annotation_objects enable row level security;

create policy spatial_annotations_select_accessible on public.spatial_annotations
for select to authenticated using (
  exists (
    select 1 from public.notes as note
    where note.id = spatial_annotations.note_id
      and note.user_id = spatial_annotations.user_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = (select auth.uid())
        )
      )
  )
);
create policy spatial_annotations_insert_owned on public.spatial_annotations
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.notes as note
    where note.id = spatial_annotations.note_id
      and note.user_id = spatial_annotations.user_id
  )
);
create policy spatial_annotations_update_owned on public.spatial_annotations
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy spatial_annotations_delete_owned on public.spatial_annotations
for delete to authenticated using (user_id = (select auth.uid()));

create policy spatial_annotation_pages_select_accessible on public.spatial_annotation_pages
for select to authenticated using (
  exists (
    select 1 from public.spatial_annotations as annotation
    where annotation.id = spatial_annotation_pages.annotation_id
  )
);
create policy spatial_annotation_pages_insert_owned on public.spatial_annotation_pages
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.spatial_annotations as annotation
    where annotation.id = spatial_annotation_pages.annotation_id
      and annotation.user_id = (select auth.uid())
  )
);
create policy spatial_annotation_pages_update_owned on public.spatial_annotation_pages
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy spatial_annotation_pages_delete_owned on public.spatial_annotation_pages
for delete to authenticated using (user_id = (select auth.uid()));

create policy spatial_annotation_objects_select_accessible on public.spatial_annotation_objects
for select to authenticated using (
  exists (
    select 1 from public.spatial_annotations as annotation
    where annotation.id = spatial_annotation_objects.annotation_id
  )
);
create policy spatial_annotation_objects_insert_owned on public.spatial_annotation_objects
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.spatial_annotations as annotation
    where annotation.id = spatial_annotation_objects.annotation_id
      and annotation.user_id = (select auth.uid())
  )
);
create policy spatial_annotation_objects_update_owned on public.spatial_annotation_objects
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy spatial_annotation_objects_delete_owned on public.spatial_annotation_objects
for delete to authenticated using (user_id = (select auth.uid()));

revoke all privileges on table
  public.spatial_annotations,
  public.spatial_annotation_pages,
  public.spatial_annotation_objects
from public, anon, authenticated;
grant select, insert, update, delete on table
  public.spatial_annotations,
  public.spatial_annotation_pages,
  public.spatial_annotation_objects
to authenticated;

alter table public.spatial_annotations replica identity full;
alter table public.spatial_annotation_pages replica identity full;
alter table public.spatial_annotation_objects replica identity full;

do $migration$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spatial_annotations'
  ) then
    alter publication supabase_realtime add table public.spatial_annotations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spatial_annotation_pages'
  ) then
    alter publication supabase_realtime add table public.spatial_annotation_pages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spatial_annotation_objects'
  ) then
    alter publication supabase_realtime add table public.spatial_annotation_objects;
  end if;
end;
$migration$;

-- Annotation provenance retains its immutable source exactly like a note link,
-- spatial image placement, or recognition result.
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
    or exists (select 1 from public.spatial_annotations where resource_id = old.id)
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
      select 1 from public.note_resources as link where link.resource_id = deleted_resource_id
    )
    and not exists (
      select 1 from public.recognized_content as recognition
      where recognition.source_resource_id = deleted_resource_id
    )
    and not exists (
      select 1 from public.spatial_annotations as annotation
      where annotation.resource_id = deleted_resource_id
    );
  return old;
end;
$function$;

revoke all on function private.retain_referenced_resource() from public, anon, authenticated;
revoke all on function private.delete_orphaned_spatial_resource() from public, anon, authenticated;
