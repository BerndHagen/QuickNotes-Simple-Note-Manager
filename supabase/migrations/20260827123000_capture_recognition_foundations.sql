-- Task 4 capture/recognition persistence. Canonical binary payloads use a
-- private Storage bucket; Postgres stores bounded metadata, note links, and
-- attributable recognition output. Local background jobs and privacy settings
-- deliberately remain device-local.

alter table public.resources drop constraint if exists resources_kind_check;
alter table public.resources drop constraint if exists resources_mime_type_check;
alter table public.resources drop constraint if exists resources_byte_size_check;
alter table public.resources drop constraint if exists resources_data_check;

alter table public.resources
  alter column byte_size type bigint,
  alter column data drop not null,
  add column schema_version integer not null default 1,
  add column file_name text,
  add column checksum text not null default '',
  add column source text,
  add column duration_ms bigint,
  add column page_count integer,
  add column storage_path text;

update public.resources set file_name = coalesce(nullif(name, ''), 'Image') where file_name is null;

alter table public.resources
  alter column file_name set not null,
  add constraint resources_identity_owner_unique unique (id, user_id),
  add constraint resources_schema_version_check check (schema_version between 1 and 1000),
  add constraint resources_kind_check check (kind in ('image', 'pdf', 'audio')),
  add constraint resources_mime_type_check check (mime_type in (
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
    'audio/x-wav', 'audio/aac', 'audio/flac'
  )),
  add constraint resources_byte_size_check check (
    (kind = 'image' and byte_size between 1 and 26214400)
    or (kind = 'pdf' and byte_size between 1 and 157286400)
    or (kind = 'audio' and byte_size between 1 and 524288000)
  ),
  add constraint resources_payload_location_check check (
    (kind = 'image' and data is not null and octet_length(data) <= 34952536)
    or (kind in ('pdf', 'audio') and data is null and storage_path is not null)
  ),
  add constraint resources_file_name_check check (char_length(file_name) between 1 and 240),
  add constraint resources_checksum_check check (
    checksum = '' or checksum ~ '^(sha256:[0-9a-f]{64}|fnv1a32:[0-9a-f]{8})$'
  ),
  add constraint resources_duration_check check (
    (kind = 'audio' and (duration_ms is null or duration_ms between 0 and 604800000))
    or (kind <> 'audio' and duration_ms is null)
  ),
  add constraint resources_page_count_check check (
    (kind = 'pdf' and (page_count is null or page_count between 1 and 10000))
    or (kind <> 'pdf' and page_count is null)
  ),
  add constraint resources_storage_path_check check (
    storage_path is null or (char_length(storage_path) between 3 and 1024 and storage_path !~ '(^|/)\.\.(/|$)')
  );

create table public.note_resources (
  id uuid primary key,
  note_id uuid not null,
  user_id uuid not null,
  resource_id uuid not null,
  resource_user_id uuid not null,
  role text not null check (role in ('attachment', 'recording')),
  label text check (label is null or char_length(label) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_resources_note_owner_fkey foreign key (note_id, user_id)
    references public.notes (id, user_id) on delete cascade,
  constraint note_resources_resource_owner_fkey foreign key (resource_id, resource_user_id)
    references public.resources (id, user_id) on delete cascade,
  constraint note_resources_note_resource_unique unique (note_id, resource_id)
);

create index idx_note_resources_note on public.note_resources (note_id, created_at);
create index idx_note_resources_resource on public.note_resources (resource_id);
create index idx_note_resources_owner on public.note_resources (user_id, updated_at desc);

create table public.recognized_content (
  id uuid primary key,
  user_id uuid not null,
  note_id uuid not null,
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  source_kind text not null check (source_kind in ('ink', 'image', 'pdf', 'audio')),
  source_resource_id uuid,
  source_resource_user_id uuid,
  source_object_ids uuid[] not null default '{}',
  source_page_id uuid,
  source_page_number integer check (source_page_number is null or source_page_number between 1 and 10000),
  source_region jsonb check (
    source_region is null or (jsonb_typeof(source_region) = 'object' and pg_column_size(source_region) <= 4096)
  ),
  source_time_range jsonb check (
    source_time_range is null or (jsonb_typeof(source_time_range) = 'object' and pg_column_size(source_time_range) <= 1024)
  ),
  recognition_type text not null check (recognition_type in ('handwriting', 'ocr', 'pdfText', 'transcript')),
  machine_text text not null check (char_length(machine_text) between 1 and 200000),
  text text not null check (char_length(text) between 1 and 200000),
  confidence double precision check (confidence is null or confidence between 0 and 1),
  provider_id text not null check (char_length(provider_id) between 1 and 160),
  model_id text not null default 'unspecified' check (char_length(model_id) <= 160),
  model_version text not null default 'unspecified' check (char_length(model_version) <= 160),
  processing_location text not null check (processing_location in ('local', 'browserManaged', 'external')),
  language text check (language is null or char_length(language) <= 35),
  source_fingerprint text not null check (char_length(source_fingerprint) between 1 and 512),
  status text not null default 'current' check (status in ('current', 'stale', 'superseded')),
  user_edited boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recognized_content_note_owner_fkey foreign key (note_id, user_id)
    references public.notes (id, user_id) on delete cascade,
  constraint recognized_content_resource_owner_fkey foreign key (source_resource_id, source_resource_user_id)
    references public.resources (id, user_id) on delete cascade,
  constraint recognized_content_source_resource_check check (
    cardinality(source_object_ids) <= 5000
    and (
      (source_kind = 'ink' and source_resource_id is null and source_resource_user_id is null and cardinality(source_object_ids) >= 1)
      or (source_kind in ('image', 'pdf', 'audio') and source_resource_id is not null and source_resource_user_id is not null)
    )
  ),
  constraint recognized_content_type_source_check check (
    (recognition_type = 'handwriting' and source_kind = 'ink')
    or (recognition_type = 'ocr' and source_kind in ('image', 'pdf'))
    or (recognition_type = 'pdfText' and source_kind = 'pdf')
    or (recognition_type = 'transcript' and source_kind = 'audio')
  ),
  constraint recognized_content_correction_check check (
    (user_edited and edited_at is not null) or (not user_edited and edited_at is null)
  )
);

create index idx_recognized_content_note on public.recognized_content (user_id, note_id, updated_at desc);
create index idx_recognized_content_resource on public.recognized_content (source_resource_id);
create index idx_recognized_content_status on public.recognized_content (user_id, status, updated_at desc);

alter table public.note_resources enable row level security;
alter table public.recognized_content enable row level security;

create policy note_resources_select_accessible on public.note_resources
for select to authenticated using (
  exists (
    select 1 from public.notes as note
    where note.id = note_resources.note_id
      and note.user_id = note_resources.user_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = (select auth.uid())
        )
      )
  )
);

create policy note_resources_insert_editable on public.note_resources
for insert to authenticated with check (
  exists (
    select 1 from public.notes as note
    where note.id = note_resources.note_id
      and note.user_id = note_resources.user_id
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
  and exists (
    select 1 from public.resources as resource
    where resource.id = note_resources.resource_id
      and resource.user_id = note_resources.resource_user_id
      and resource.user_id = (select auth.uid())
  )
);

create policy note_resources_update_editable on public.note_resources
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = note_resources.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
)
with check (
  exists (
    select 1 from public.notes as note
    where note.id = note_resources.note_id
      and note.user_id = note_resources.user_id
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
  and exists (
    select 1 from public.resources as resource
    where resource.id = note_resources.resource_id
      and resource.user_id = note_resources.resource_user_id
  )
);

create policy note_resources_delete_editable on public.note_resources
for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = note_resources.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
);

create policy recognized_content_select_accessible on public.recognized_content
for select to authenticated using (
  exists (
    select 1 from public.notes as note
    where note.id = recognized_content.note_id
      and note.user_id = recognized_content.user_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = (select auth.uid())
        )
      )
  )
);

create policy recognized_content_insert_editable on public.recognized_content
for insert to authenticated with check (
  exists (
    select 1 from public.notes as note
    where note.id = recognized_content.note_id
      and note.user_id = recognized_content.user_id
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

create policy recognized_content_update_editable on public.recognized_content
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = recognized_content.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
)
with check (
  exists (
    select 1 from public.notes as note
    where note.id = recognized_content.note_id
      and note.user_id = recognized_content.user_id
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

create policy recognized_content_delete_editable on public.recognized_content
for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.accepted_shares as accepted
    where accepted.note_id = recognized_content.note_id
      and accepted.user_id = (select auth.uid())
      and accepted.permission = 'edit'
  )
);

drop policy resources_select_accessible on public.resources;
create policy resources_select_accessible on public.resources
for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.spatial_objects as object
    where object.data ->> 'resourceId' = resources.id::text
  )
  or exists (
    select 1
    from public.note_resources as link
    join public.notes as note on note.id = link.note_id and note.user_id = link.user_id
    where link.resource_id = resources.id
      and link.resource_user_id = resources.user_id
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = (select auth.uid())
        )
      )
  )
);

-- The Task-2 cleanup trigger must respect canonical note attachments too.
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
    );
  return old;
end;
$function$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quicknotes-resources',
  'quicknotes-resources',
  false,
  524288000,
  array[
    'application/pdf', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
    'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/flac'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy quicknotes_resources_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'quicknotes-resources'
  and exists (
    select 1 from public.resources as resource
    where resource.storage_path = storage.objects.name
  )
);

create policy quicknotes_resources_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'quicknotes-resources'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy quicknotes_resources_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'quicknotes-resources'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'quicknotes-resources'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy quicknotes_resources_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'quicknotes-resources'
  and owner_id = (select auth.uid())::text
);

revoke all privileges on table public.note_resources, public.recognized_content from public, anon, authenticated;
grant select, insert, update, delete on table public.note_resources, public.recognized_content to authenticated;
revoke all on function private.delete_orphaned_spatial_resource() from public, anon, authenticated;
