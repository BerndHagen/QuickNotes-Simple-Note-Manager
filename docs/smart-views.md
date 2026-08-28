# Smart Views

Smart Views are named, saved, owner-scoped query definitions. They dynamically filter the canonical note catalog; they do not copy notes, create folders, or persist a result list.

## Criteria

A view stores a match mode (`all` or `any`), scope (`active`, `archive`, `trash`, or `all`), sort, and up to 12 typed rules. Supported fields are:

- full text and title;
- tag and folder;
- note type;
- starred and pinned state;
- task state and reminder state;
- created and updated dates.

Each field exposes only appropriate operators. Invalid imported criteria are normalized to bounded, safe defaults. Empty criteria receive one editable rule.

The text rule uses the active owner-scoped `SearchDocument.searchableText` when available. Consequently typed Paper/Canvas objects and structured workspaces participate exactly as they do in Global Search. During startup or index recovery it falls back to canonical Document/structured text so a derived-index failure does not make a view unusable.

## Dynamic updates

Views are evaluated from current notes whenever Zustand catalog state changes. Successful local persistence, spatial persistence, remote sync, Trash/restore, tag changes, and folder changes also refresh the derived knowledge projection. The saved view definition is stable; results are always recomputed and are never treated as canonical membership.

Creating a note while an `all`-matching view is active may derive safe defaults from equality rules: folder, type, tags, starred, or pinned. Negative, date, task, reminder, text, and `any` rules do not manufacture note data.

## Distinct organization roles

| Feature | Meaning |
| --- | --- |
| Folder/notebook | One catalog location; moving does not change identity |
| Tag | Reusable many-to-many label |
| Link | Explicit relationship between stable identities |
| Smart View | Dynamic saved criteria and sort over current notes |

This separation prevents Smart Views from becoming hidden folders or links from becoming tags. The Task 3 query/filter layer can add future canonical properties without changing these roles.

