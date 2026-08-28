-- Canonical Task-2 Paper/Canvas storage. Spatial payloads are kept in
-- bounded per-record rows instead of notes.note_data so individual edits can
-- sync without rewriting an entire document.

alter table public.notes drop constraint if exists notes_type_supported;
alter table public.notes add constraint notes_type_supported check (
  note_type in (
    'standard', 'todo', 'project', 'meeting', 'journal', 'brainstorm',
    'shopping', 'weekly', 'paper', 'canvas'
  )
);

alter table public.note_templates drop constraint if exists note_templates_type_supported;
alter table public.note_templates add constraint note_templates_type_supported check (
  note_type in (
    'standard', 'todo', 'project', 'meeting', 'journal', 'brainstorm',
    'shopping', 'weekly', 'paper', 'canvas'
  )
);

create table public.spatial_documents (
  note_id uuid primary key references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('paper', 'canvas')),
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
  constraint spatial_documents_owner_matches_note check (
    user_id is not null
  )
);

create index idx_spatial_documents_user_updated
  on public.spatial_documents (user_id, updated_at desc);

create table public.spatial_pages (
  id uuid primary key,
  note_id uuid not null references public.spatial_documents (note_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  name text not null default '' check (char_length(name) <= 120),
  size text not null check (size in ('free', 'a4', 'a5', 'letter')),
  width double precision not null check (width between 320 and 4096),
  height double precision not null check (height between 320 and 4096),
  pattern text not null check (pattern in ('blank', 'ruled', 'dot', 'square', 'graph')),
  surface text not null check (surface in ('white', 'warm', 'cream', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_spatial_pages_note_order on public.spatial_pages (note_id, sort_order);

create table public.resources (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('image')),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  name text not null default '' check (char_length(name) <= 255),
  byte_size integer not null check (byte_size between 1 and 26214400),
  data text not null check (octet_length(data) <= 34952536),
  thumbnail_data text check (thumbnail_data is null or octet_length(thumbnail_data) <= 10485760),
  pixel_width integer check (pixel_width is null or pixel_width between 1 and 100000),
  pixel_height integer check (pixel_height is null or pixel_height between 1 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_resources_user_updated on public.resources (user_id, updated_at desc);

create table public.spatial_objects (
  id uuid primary key,
  note_id uuid not null references public.spatial_documents (note_id) on delete cascade,
  page_id uuid references public.spatial_pages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  kind text not null check (kind in ('stroke', 'shape', 'text', 'sticky', 'indexCard', 'noteLink', 'image')),
  z_index integer not null default 0 check (z_index between -1000000 and 1000000),
  bounds jsonb not null check (jsonb_typeof(bounds) = 'object' and pg_column_size(bounds) <= 4096),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 2097152),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_spatial_objects_note_z on public.spatial_objects (note_id, z_index);
create index idx_spatial_objects_page_z on public.spatial_objects (page_id, z_index) where page_id is not null;

alter table public.spatial_documents enable row level security;
alter table public.spatial_pages enable row level security;
alter table public.spatial_objects enable row level security;
alter table public.resources enable row level security;

create policy spatial_documents_select_accessible on public.spatial_documents
for select to authenticated using (
  exists (
    select 1 from public.notes as note
    where note.id = spatial_documents.note_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = (select auth.uid())
        )
      )
  )
);

create policy spatial_documents_insert_editable on public.spatial_documents
for insert to authenticated with check (
  exists (
    select 1 from public.notes as note
    where note.id = spatial_documents.note_id
      and note.user_id = spatial_documents.user_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id
            and accepted.user_id = (select auth.uid())
            and accepted.permission = 'edit'
        )
      )
  )
);

create policy spatial_documents_update_editable on public.spatial_documents
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = spatial_documents.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
)
with check (
  exists (
    select 1 from public.notes as note
    where note.id = spatial_documents.note_id and note.user_id = spatial_documents.user_id
  )
);

create policy spatial_documents_delete_editable on public.spatial_documents
for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = spatial_documents.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
);

create policy spatial_pages_accessible on public.spatial_pages
for select to authenticated using (
  exists (select 1 from public.spatial_documents as document where document.note_id = spatial_pages.note_id)
);
create policy spatial_pages_insert_editable on public.spatial_pages
for insert to authenticated with check (
  exists (
    select 1 from public.spatial_documents as document
    where document.note_id = spatial_pages.note_id
      and document.user_id = spatial_pages.user_id
      and (
        document.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = document.note_id
            and accepted.user_id = (select auth.uid())
            and accepted.permission = 'edit'
        )
      )
  )
);
create policy spatial_pages_update_editable on public.spatial_pages
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = spatial_pages.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
)
with check (
  exists (select 1 from public.spatial_documents as document where document.note_id = spatial_pages.note_id and document.user_id = spatial_pages.user_id)
);
create policy spatial_pages_delete_editable on public.spatial_pages
for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = spatial_pages.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
);

create policy spatial_objects_accessible on public.spatial_objects
for select to authenticated using (
  exists (select 1 from public.spatial_documents as document where document.note_id = spatial_objects.note_id)
);
create policy spatial_objects_insert_editable on public.spatial_objects
for insert to authenticated with check (
  exists (
    select 1 from public.spatial_documents as document
    where document.note_id = spatial_objects.note_id
      and document.user_id = spatial_objects.user_id
      and (
        document.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = document.note_id
            and accepted.user_id = (select auth.uid())
            and accepted.permission = 'edit'
        )
      )
  )
);
create policy spatial_objects_update_editable on public.spatial_objects
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = spatial_objects.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
)
with check (
  exists (select 1 from public.spatial_documents as document where document.note_id = spatial_objects.note_id and document.user_id = spatial_objects.user_id)
);
create policy spatial_objects_delete_editable on public.spatial_objects
for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = spatial_objects.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
);

create policy resources_select_accessible on public.resources
for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.spatial_objects as object
    where object.data ->> 'resourceId' = resources.id::text
  )
);
create policy resources_insert_owned on public.resources
for insert to authenticated with check (user_id = (select auth.uid()));
create policy resources_update_owned on public.resources
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy resources_delete_owned on public.resources
for delete to authenticated using (user_id = (select auth.uid()));

-- Remove image payloads after their final placement disappears, including
-- when a note deletion cascades through spatial_objects. A resource shared by
-- duplicated notes remains until its last referencing object is deleted.
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
    );
  return old;
end;
$function$;

create trigger delete_orphaned_spatial_resource_after_object
after delete on public.spatial_objects
for each row execute function private.delete_orphaned_spatial_resource();

create trigger delete_replaced_spatial_resource_after_object
after update of kind, data on public.spatial_objects
for each row execute function private.delete_orphaned_spatial_resource();

revoke all on function private.delete_orphaned_spatial_resource() from public, anon, authenticated;
revoke all on public.spatial_documents, public.spatial_pages, public.spatial_objects, public.resources from public, anon;
grant select, insert, update, delete on public.spatial_documents, public.spatial_pages, public.spatial_objects, public.resources to authenticated;

create or replace function private.update_shared_note(
  p_note_id uuid,
  p_patch jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'A JSON object patch is required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) as patch_key
    where patch_key not in ('title', 'content', 'note_type', 'note_data')
  ) then
    raise exception 'The shared-note patch contains unsupported fields' using errcode = '22023';
  end if;
  if p_patch ? 'title' and (p_patch ->> 'title' is null or char_length(p_patch ->> 'title') > 500) then
    raise exception 'The note title is invalid' using errcode = '22023';
  end if;
  if p_patch ? 'note_type' and (p_patch ->> 'note_type') not in (
    'standard', 'todo', 'project', 'meeting', 'journal', 'brainstorm',
    'shopping', 'weekly', 'paper', 'canvas'
  ) then
    raise exception 'The note type is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.accepted_shares as accepted
    join public.notes as note on note.id = accepted.note_id
    where accepted.note_id = p_note_id
      and accepted.user_id = current_user_id
      and accepted.permission = 'edit'
      and not note.deleted
  ) then
    raise exception 'Edit permission is required for an active shared note' using errcode = '42501';
  end if;
  update public.notes
  set title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
      content = case when p_patch ? 'content' then coalesce(p_patch ->> 'content', '') else content end,
      note_type = case when p_patch ? 'note_type' then p_patch ->> 'note_type' else note_type end,
      note_data = case when p_patch ? 'note_data' then nullif(p_patch -> 'note_data', 'null'::jsonb) else note_data end,
      updated_at = now()
  where id = p_note_id and not deleted;
  return found;
end;
$function$;
