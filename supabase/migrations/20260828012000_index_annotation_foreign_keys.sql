-- Cover every annotation foreign key used by cascades, revocation, and
-- reference-aware source collection. These are deliberately separate from
-- the read-path z-order indexes.

create index idx_spatial_annotations_resource_owner
  on public.spatial_annotations (resource_id, resource_user_id);

create index idx_spatial_annotation_pages_owner
  on public.spatial_annotation_pages (user_id);
create index idx_spatial_annotation_pages_note
  on public.spatial_annotation_pages (note_id);
create index idx_spatial_annotation_pages_resource
  on public.spatial_annotation_pages (resource_id);
create index idx_spatial_annotation_pages_parent_identity
  on public.spatial_annotation_pages (annotation_id, user_id, note_id, resource_id);

create index idx_spatial_annotation_objects_owner
  on public.spatial_annotation_objects (user_id);
create index idx_spatial_annotation_objects_note
  on public.spatial_annotation_objects (note_id);
create index idx_spatial_annotation_objects_resource
  on public.spatial_annotation_objects (resource_id);
create index idx_spatial_annotation_objects_parent_identity
  on public.spatial_annotation_objects (annotation_id, user_id, note_id, resource_id);
create index idx_spatial_annotation_objects_page_identity
  on public.spatial_annotation_objects (page_id, annotation_id, user_id, note_id, resource_id);
