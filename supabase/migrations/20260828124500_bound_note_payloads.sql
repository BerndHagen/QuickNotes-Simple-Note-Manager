-- Canonical rich text remains in notes.content and structured workspaces in
-- notes.note_data. Bound both at the database boundary so a malformed client
-- or editable share cannot create rows that exhaust browser restore/search
-- memory. Binary attachments belong in the private resource bucket instead.

alter table public.notes
  add constraint notes_content_size
    check (octet_length(content) <= 10485760) not valid,
  add constraint notes_data_size
    check (note_data is null or pg_column_size(note_data) <= 1048576) not valid,
  add constraint notes_tag_count
    check (cardinality(tags) <= 50) not valid;

alter table public.notes validate constraint notes_content_size;
alter table public.notes validate constraint notes_data_size;
alter table public.notes validate constraint notes_tag_count;

alter table public.note_templates
  add constraint note_templates_content_size
    check (octet_length(content) <= 10485760) not valid;

alter table public.note_templates validate constraint note_templates_content_size;

alter table public.note_versions
  add constraint note_versions_content_size
    check (octet_length(content) <= 10485760) not valid,
  add constraint note_versions_data_size
    check (note_data is null or pg_column_size(note_data) <= 1048576) not valid;

alter table public.note_versions validate constraint note_versions_content_size;
alter table public.note_versions validate constraint note_versions_data_size;
