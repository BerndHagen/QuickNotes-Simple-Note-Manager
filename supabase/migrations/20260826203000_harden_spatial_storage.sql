-- Tighten the Task-2 spatial schema after validating its production grants,
-- foreign keys, and policies. Keep authenticated clients on row-level DML;
-- TRUNCATE and schema-level capabilities must never bypass RLS.

revoke all privileges on table
  public.spatial_documents,
  public.spatial_pages,
  public.spatial_objects,
  public.resources
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.spatial_documents,
  public.spatial_pages,
  public.spatial_objects,
  public.resources
to authenticated;

-- Cover owner foreign keys and the composite relationships added below.
create index idx_spatial_pages_user_id
  on public.spatial_pages (user_id);
create index idx_spatial_pages_note_owner
  on public.spatial_pages (note_id, user_id);
create index idx_spatial_objects_user_id
  on public.spatial_objects (user_id);
create index idx_spatial_objects_note_owner
  on public.spatial_objects (note_id, user_id);
create index idx_spatial_objects_page_note_owner
  on public.spatial_objects (page_id, note_id, user_id);

-- Preserve owner identity at the database boundary, including writes made by
-- privileged sync jobs that bypass row-level security.
alter table public.spatial_documents
  drop constraint spatial_documents_owner_matches_note,
  add constraint spatial_documents_note_owner_unique unique (note_id, user_id),
  add constraint spatial_documents_note_owner_fkey
    foreign key (note_id, user_id)
    references public.notes (id, user_id)
    on delete cascade;

alter table public.spatial_pages
  add constraint spatial_pages_identity_owner_unique unique (id, note_id, user_id),
  add constraint spatial_pages_note_owner_fkey
    foreign key (note_id, user_id)
    references public.spatial_documents (note_id, user_id)
    on delete cascade;

alter table public.spatial_objects
  add constraint spatial_objects_note_owner_fkey
    foreign key (note_id, user_id)
    references public.spatial_documents (note_id, user_id)
    on delete cascade,
  add constraint spatial_objects_page_note_owner_fkey
    foreign key (page_id, note_id, user_id)
    references public.spatial_pages (id, note_id, user_id)
    on delete cascade;

-- The composite keys supersede the looser single-column relationships.
alter table public.spatial_documents
  drop constraint spatial_documents_note_id_fkey;
alter table public.spatial_pages
  drop constraint spatial_pages_note_id_fkey;
alter table public.spatial_objects
  drop constraint spatial_objects_note_id_fkey,
  drop constraint spatial_objects_page_id_fkey;

-- Re-check edit access against the new target row. This prevents an editor of
-- one shared note from reassigning spatial rows to another unshared note that
-- happens to have the same owner.
drop policy spatial_documents_update_editable on public.spatial_documents;
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

drop policy spatial_pages_update_editable on public.spatial_pages;
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

drop policy spatial_objects_update_editable on public.spatial_objects;
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
