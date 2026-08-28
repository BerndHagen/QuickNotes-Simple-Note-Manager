-- Cover Task-4 composite foreign keys in their declared column order.
create index idx_note_resources_note_owner
  on public.note_resources (note_id, user_id);
create index idx_note_resources_resource_owner
  on public.note_resources (resource_id, resource_user_id);
create index idx_recognized_content_note_owner
  on public.recognized_content (note_id, user_id);
create index idx_recognized_content_resource_owner
  on public.recognized_content (source_resource_id, source_resource_user_id);
