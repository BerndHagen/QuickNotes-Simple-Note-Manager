-- Keep privilege-bearing comment implementations outside the exposed API
-- schema. Public RPCs are security-invoker wrappers, matching the existing
-- private-profile and sharing boundary.

alter function public.get_note_participants(uuid) set schema private;
alter function public.get_note_comments(uuid) set schema private;
alter function public.create_note_comment(uuid, text, uuid[], text, text) set schema private;
alter function public.delete_note_comment(uuid) set schema private;

create or replace function public.get_note_participants(p_note_id uuid)
returns table (
  user_id uuid,
  username text,
  participant_role text,
  permission text
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_note_participants(p_note_id);
$function$;

create or replace function public.get_note_comments(p_note_id uuid)
returns table (
  id uuid,
  note_id uuid,
  author_id uuid,
  author_username text,
  anchor_id text,
  object_id text,
  body text,
  mentioned_user_ids uuid[],
  mentioned_usernames text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_note_comments(p_note_id);
$function$;

create or replace function public.create_note_comment(
  p_note_id uuid,
  p_body text,
  p_mentioned_user_ids uuid[] default '{}'::uuid[],
  p_anchor_id text default null,
  p_object_id text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.create_note_comment(
    p_note_id,
    p_body,
    p_mentioned_user_ids,
    p_anchor_id,
    p_object_id
  );
$function$;

create or replace function public.delete_note_comment(p_comment_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.delete_note_comment(p_comment_id);
$function$;

revoke all on function private.get_note_participants(uuid) from public, anon;
revoke all on function private.get_note_comments(uuid) from public, anon;
revoke all on function private.create_note_comment(uuid, text, uuid[], text, text) from public, anon;
revoke all on function private.delete_note_comment(uuid) from public, anon;
grant execute on function private.get_note_participants(uuid) to authenticated, service_role;
grant execute on function private.get_note_comments(uuid) to authenticated, service_role;
grant execute on function private.create_note_comment(uuid, text, uuid[], text, text) to authenticated, service_role;
grant execute on function private.delete_note_comment(uuid) to authenticated, service_role;

revoke all on function public.get_note_participants(uuid) from public, anon;
revoke all on function public.get_note_comments(uuid) from public, anon;
revoke all on function public.create_note_comment(uuid, text, uuid[], text, text) from public, anon;
revoke all on function public.delete_note_comment(uuid) from public, anon;
grant execute on function public.get_note_participants(uuid) to authenticated;
grant execute on function public.get_note_comments(uuid) to authenticated;
grant execute on function public.create_note_comment(uuid, text, uuid[], text, text) to authenticated;
grant execute on function public.delete_note_comment(uuid) to authenticated;

create index idx_note_comments_note_owner
  on public.note_comments (note_id, note_owner_id);
