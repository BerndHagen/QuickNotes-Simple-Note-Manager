# QuickNotes knowledge system

QuickNotes presents Document, structured workspaces, Paper, and Canvas as one connected catalog while preserving their purpose-built editors. A user can find a note from any machine-readable surface, follow a stable reference, inspect incoming and outgoing relationships, and return through session navigation history.

## What participates

| Canonical surface | Searchable now | Addressable target |
| --- | --- | --- |
| Document | Title, text, headings, tags, metadata | Note and stable heading |
| Structured workspace | Title and bounded user-authored `noteData` values | Note |
| Paper | Title, typed objects, reference labels, resource metadata | Note and stable object |
| Canvas | Title, typed objects, reference labels, resource metadata | Note and stable object |

Stroke geometry, object IDs, sync fields, and other implementation metadata are excluded from search text. A handwritten Paper note can be found by its title, tags, typed objects, links, or resource metadata, but its unrecognized ink is not described as searchable.

## Everyday behavior

- `Ctrl/Cmd+K` opens Global Search. An empty search shows recent notes.
- Search results say where the match came from and carry a precise heading/object target when available.
- The note-link picker searches the same cross-surface catalog and can target a note, heading, or spatial object.
- The Inspector lists forward links and backlinks with source context. Missing and trashed targets remain safe diagnostics rather than broken navigation actions.
- Previous/next note controls traverse knowledge navigation history. History is session-local and is reset when the workspace owner changes.
- Find Duplicates and text Smart Views use projected cross-surface text when it is available and retain canonical fallbacks while the index starts or rebuilds.

## Organization semantics

- A folder/notebook is the note's single catalog location. Moving it does not alter `NoteId` or links.
- Tags are reusable many-to-many labels. Renaming and assignment remain catalog operations, not textual rewrites.
- Links are explicit relationships between stable identities.
- Smart Views are saved dynamic criteria. They do not copy notes into another collection.

The relationship list in the Inspector is the accessible graph representation. No visual graph is required to search, link, or navigate.

## Recovery and privacy

Search and link rows are local, owner-scoped, derived projections. Clearing them cannot remove canonical content. QuickNotes rebuilds them from the accessible note catalog and spatial stores. These rows are intentionally excluded from cloud sync and backup because they are reproducible and can contain a searchable text projection.

For storage, query, and linking details, see [Search index](./search-index.md), [Internal links](./internal-links.md), and [Smart Views](./smart-views.md).

