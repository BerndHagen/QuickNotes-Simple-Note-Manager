-- Remove indexes that are exact prefixes of stronger indexes/constraints.
drop index if exists public.idx_accepted_shares_note_id;
drop index if exists public.idx_folders_parent_id;
drop index if exists public.idx_note_versions_note_id;
drop index if exists public.idx_notes_folder_id;
drop index if exists public.idx_shared_notes_note_id;
drop index if exists public.idx_shared_notes_share_link;

-- Search runs against the local IndexedDB copy, so the server-side
-- full-text index is never queried.
drop index if exists public.idx_notes_search;

-- RLS and pending-invitation lookups compare normalized addresses.
drop index if exists public.idx_shared_notes_email;
create index if not exists idx_shared_notes_email_lower
  on public.shared_notes (lower(email));
