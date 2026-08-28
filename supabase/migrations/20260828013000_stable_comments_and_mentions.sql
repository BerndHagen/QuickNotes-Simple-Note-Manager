-- Lightweight Task-4 comments and real recipient-backed mentions. Comments
-- attach only to stable note/anchor/object identities; no character offsets
-- or client-only notification identities are stored.

create table public.note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null,
  note_owner_id uuid not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  anchor_id text check (anchor_id is null or char_length(anchor_id) between 1 and 128),
  object_id text check (object_id is null or char_length(object_id) between 1 and 128),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_comments_note_owner_fkey
    foreign key (note_id, note_owner_id)
    references public.notes (id, user_id) on delete cascade
);

create index idx_note_comments_note_created
  on public.note_comments (note_id, created_at);
create index idx_note_comments_owner
  on public.note_comments (note_owner_id);
create index idx_note_comments_author
  on public.note_comments (author_id);

create table public.note_comment_mentions (
  comment_id uuid not null references public.note_comments (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, recipient_id)
);

create index idx_note_comment_mentions_recipient_created
  on public.note_comment_mentions (recipient_id, created_at desc);
create index idx_note_comment_mentions_note
  on public.note_comment_mentions (note_id);

alter table public.note_comments enable row level security;
alter table public.note_comment_mentions enable row level security;

create policy note_comments_select_accessible on public.note_comments
for select to authenticated using (
  exists (
    select 1 from public.notes as note
    where note.id = note_comments.note_id
      and note.user_id = note_comments.note_owner_id
      and not note.deleted
      and (
        note.user_id = (select auth.uid())
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = (select auth.uid())
        )
      )
  )
);

create policy note_comment_mentions_select_recipient on public.note_comment_mentions
for select to authenticated using (recipient_id = (select auth.uid()));

revoke all privileges on table public.note_comments, public.note_comment_mentions
from public, anon, authenticated;
grant select on table public.note_comments, public.note_comment_mentions to authenticated;

create or replace function public.get_note_participants(p_note_id uuid)
returns table (
  user_id uuid,
  username text,
  participant_role text,
  permission text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not exists (
    select 1 from public.notes as note
    where note.id = p_note_id
      and not note.deleted
      and (
        note.user_id = caller_id
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = caller_id
        )
      )
  ) then
    raise exception 'This note is no longer accessible' using errcode = '42501';
  end if;

  return query
  select note.user_id, profile.username, 'owner'::text, 'edit'::text
  from public.notes as note
  join private.user_profiles as profile on profile.user_id = note.user_id
  where note.id = p_note_id
  union all
  select accepted.user_id, profile.username, 'collaborator'::text, accepted.permission
  from public.accepted_shares as accepted
  join private.user_profiles as profile on profile.user_id = accepted.user_id
  where accepted.note_id = p_note_id
  order by 3 desc, 2;
end;
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
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not exists (
    select 1 from public.notes as note
    where note.id = p_note_id
      and not note.deleted
      and (
        note.user_id = caller_id
        or exists (
          select 1 from public.accepted_shares as accepted
          where accepted.note_id = note.id and accepted.user_id = caller_id
        )
      )
  ) then
    raise exception 'This note is no longer accessible' using errcode = '42501';
  end if;

  return query
  select
    comment.id,
    comment.note_id,
    comment.author_id,
    author.username,
    comment.anchor_id,
    comment.object_id,
    comment.body,
    coalesce(mentions.user_ids, '{}'::uuid[]),
    coalesce(mentions.usernames, '{}'::text[]),
    comment.created_at,
    comment.updated_at
  from public.note_comments as comment
  join private.user_profiles as author on author.user_id = comment.author_id
  left join lateral (
    select
      array_agg(mention.recipient_id order by profile.username) as user_ids,
      array_agg(profile.username order by profile.username) as usernames
    from public.note_comment_mentions as mention
    join private.user_profiles as profile on profile.user_id = mention.recipient_id
    where mention.comment_id = comment.id
  ) as mentions on true
  where comment.note_id = p_note_id
  order by comment.created_at, comment.id;
end;
$function$;

create or replace function public.create_note_comment(
  p_note_id uuid,
  p_body text,
  p_mentioned_user_ids uuid[] default '{}'::uuid[],
  p_anchor_id text default null,
  p_object_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  note_owner uuid;
  normalized_body text := trim(p_body);
  mentioned_ids uuid[];
  new_comment_id uuid := gen_random_uuid();
begin
  if caller_id is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if char_length(normalized_body) not between 1 and 4000 then
    raise exception 'A comment must contain between 1 and 4000 characters' using errcode = '22023';
  end if;
  if p_anchor_id is not null and char_length(p_anchor_id) not between 1 and 128 then
    raise exception 'The comment anchor is invalid' using errcode = '22023';
  end if;
  if p_object_id is not null and char_length(p_object_id) not between 1 and 128 then
    raise exception 'The comment object is invalid' using errcode = '22023';
  end if;

  select note.user_id into note_owner
  from public.notes as note
  where note.id = p_note_id
    and not note.deleted
    and (
      note.user_id = caller_id
      or exists (
        select 1 from public.accepted_shares as accepted
        where accepted.note_id = note.id and accepted.user_id = caller_id
      )
    );
  if note_owner is null then raise exception 'This note is no longer accessible' using errcode = '42501'; end if;

  select coalesce(array_agg(distinct candidate), '{}'::uuid[])
  into mentioned_ids
  from unnest(coalesce(p_mentioned_user_ids, '{}'::uuid[])) as candidate;
  if cardinality(mentioned_ids) > 20 then
    raise exception 'A comment cannot mention more than 20 people' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(mentioned_ids) as candidate
    where candidate <> note_owner
      and not exists (
        select 1 from public.accepted_shares as accepted
        where accepted.note_id = p_note_id and accepted.user_id = candidate
      )
  ) then
    raise exception 'A mention recipient is not a current note participant' using errcode = '42501';
  end if;

  insert into public.note_comments (
    id, note_id, note_owner_id, author_id, anchor_id, object_id, body
  ) values (
    new_comment_id, p_note_id, note_owner, caller_id,
    nullif(p_anchor_id, ''), nullif(p_object_id, ''), normalized_body
  );
  insert into public.note_comment_mentions (comment_id, recipient_id, note_id)
  select new_comment_id, recipient_id, p_note_id
  from unnest(mentioned_ids) as recipient_id
  where recipient_id <> caller_id;
  return new_comment_id;
end;
$function$;

create or replace function public.delete_note_comment(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then return false; end if;
  delete from public.note_comments as comment
  using public.notes as note
  where comment.id = p_comment_id
    and note.id = comment.note_id
    and (comment.author_id = caller_id or note.user_id = caller_id);
  return found;
end;
$function$;

revoke all on function public.get_note_participants(uuid) from public, anon;
revoke all on function public.get_note_comments(uuid) from public, anon;
revoke all on function public.create_note_comment(uuid, text, uuid[], text, text) from public, anon;
revoke all on function public.delete_note_comment(uuid) from public, anon;
grant execute on function public.get_note_participants(uuid) to authenticated;
grant execute on function public.get_note_comments(uuid) to authenticated;
grant execute on function public.create_note_comment(uuid, text, uuid[], text, text) to authenticated;
grant execute on function public.delete_note_comment(uuid) to authenticated;

alter table public.note_comments replica identity full;
alter table public.note_comment_mentions replica identity full;

do $migration$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_comments'
  ) then
    alter publication supabase_realtime add table public.note_comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_comment_mentions'
  ) then
    alter publication supabase_realtime add table public.note_comment_mentions;
  end if;
end;
$migration$;
