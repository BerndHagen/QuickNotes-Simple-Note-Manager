-- Enforce the same invariants that the client presents to users.
update public.notes
set note_type = 'standard'
where note_type is null;

alter table public.notes
  alter column note_type set not null,
  alter column starred set default false,
  alter column starred set not null,
  alter column pinned set default false,
  alter column pinned set not null,
  alter column deleted set default false,
  alter column deleted set not null,
  alter column archived set default false,
  alter column archived set not null,
  add constraint notes_title_length
    check (char_length(title) <= 500),
  add constraint notes_type_supported
    check (
      note_type in (
        'standard',
        'todo',
        'project',
        'meeting',
        'journal',
        'brainstorm',
        'shopping',
        'weekly'
      )
    );

update public.folders
set name = trim(name);

alter table public.folders
  add constraint folders_name_valid
    check (char_length(name) between 1 and 60 and name = trim(name));

create unique index if not exists folders_user_name_lower_unique
  on public.folders (user_id, lower(name));

update public.tags
set name = lower(trim(name));

alter table public.tags
  drop constraint if exists tags_user_id_name_key;

alter table public.tags
  add constraint tags_name_valid
    check (
      char_length(name) between 1 and 60
      and name = lower(trim(name))
    );

create unique index if not exists tags_user_name_lower_unique
  on public.tags (user_id, lower(name));

update public.shared_notes
set share_link = replace(share_link, '-', '')
where share_link ~ '^[a-f0-9-]{36}$';

alter table public.shared_notes
  add constraint shared_notes_link_valid
    check (share_link ~ '^[a-f0-9]{32}$');
