# QuickNotes flagship product audit

Date: 2026-08-24

This review supersedes the earlier conclusion that QuickNotes' existing feature
set was already a sufficiently complete competitive core. Feature presence is
not the same as a dependable daily workflow. The standard used here is: a user
can discover the capability, customize it, use it on phone and desktop, retain
the result through save/sync/export, recover from mistakes, and understand what
happened without guessing.

## Research baseline

The comparison used current first-party product documentation rather than
screenshots or visual imitation:

- OneNote treats broad retrieval as a core workflow: it searches typed text,
  handwriting, text in images, and spoken words in recordings. It also treats
  inserted files as durable note content.
- Evernote exposes tasks in a central Tasks view, with due dates, recurring
  dates, reminders, flags, and source-note context. Its clipper supports
  multiple capture formats rather than a single generic import action.
- Obsidian turns daily notes, templates, backlinks, and Canvas into connected
  workflows instead of isolated toolbar features.
- Joplin emphasizes offline operation, sync choice, encryption, note history,
  plugins, and OCR-backed attachment search.
- Notion combines typed properties with saved views, filters, and sorts, while
  making offline availability an explicit state.
- Google Keep optimizes immediate capture, reminders, labels, pinning, list
  conversion, and lightweight collaboration.
- Apple Notes combines Smart Folders, note-to-note links, document scanning,
  attachments, sharing, and platform-level capture.

Official references are listed at the end of this document.

## Product audit

| Product system | Current assessment | Evidence and decision |
| --- | --- | --- |
| Capture | Strong but fragmented | Rich notes, quick notes, seven focused workspace types, images, dictation, import, and starters exist. This pass adds a one-click Today entry point. A browser clipper, scan-to-note flow, and share-target capture remain absent. |
| Retrieval | Materially improved in this pass | Search already covered ordinary HTML, titles, and tags, but the global dialog skipped structured workspace data. It now uses the same structured search projection as the note list and adds type filters for documents, tasks, projects, meetings, journals, and weekly plans. OCR, attachment indexing, and saved compound searches remain absent. |
| Daily planning | Materially improved in this pass | Today creates or reopens exactly one local-date journal and preserves the journal's full structured workspace. Creation is explicitly workspace-level so browsing a folder cannot silently misfile the daily note. |
| Tasks | Materially improved in this pass | My Tasks now aggregates document checklists, task lists and subtasks, project tasks and milestones, meeting actions, journal goals, and weekly work. It supports source navigation, direct completion, search, due/overdue/upcoming/completed filters, priorities, and recurrence. Recurring completion preserves history and creates the next occurrence. Reminders are not yet connected to individual structured tasks. |
| Organization | Capable, not flagship-complete | Nested folders, tags, favorites, pinning, archive, Trash, duplicate detection, backlinks, note-type filtering, and sorting exist. Saved views / Smart Folders and user-defined properties are still missing, which becomes significant in large collections. |
| Editing | Broad and increasingly reliable | The document editor supports typography, semantic headings, lists, configurable checklists, links, images, callouts, tables, code, shapes, text boxes, dates, translation, page breaks, paper styles, paragraph geometry, rulers, tab stops, statistics, accessibility checks, history, dictation, focus mode, HTML source, and slash insertion. Pagination, page geometry, object clamping, and mobile header behavior have dedicated regression coverage. |
| Tables and objects | Broad, with remaining depth work | Tables support row/column operations, movement, merge/split, header cells, and cell/table colour controls. Shapes and text boxes support direct drawing, sizing, position, rotation, wrapping, fill, border, and text. Formula columns, reusable table styles, attachment embeds, captions, and cross-note object reuse remain absent. |
| Sharing | Useful but narrower than mature team products | View/edit sharing, invitations, provenance, live shared-note updates, and permission-aware backend policies exist. Comments, mentions, assignments, presence, suggestion mode, and activity history are not implemented. |
| Offline and sync | Architecturally strong, remotely unverified in this session | IndexedDB, an explicit sync queue, conflict reconciliation, local-save status, backups, and optional Supabase sync exist. The active tool environment did not expose the Supabase database connector, so live migration state, storage policy, multi-device conflict behavior, and real network recovery were not guessed or claimed as verified. |
| Files and scanning | Largest daily-use gap | Images are supported, but generic file/PDF attachments do not yet have a complete storage, offline-cache, quota, validation, deletion, preview, export, sharing, and recovery lifecycle. OCR and document scanning are also absent. This is a product system, not an Insert-menu label. |
| Privacy and recovery | Solid foundation, incomplete high-end privacy | Trash, archive, version history, backups, validation, sanitization, RLS migrations, and share hardening exist. Locked notes and end-to-end encryption remain absent and must include key recovery, search/index behavior, sharing restrictions, and version-history rules. |
| Extensibility | Limited | Workspace starters and extensive editor preferences exist, but user-authored templates, plugins, automation, an API, and importable theme packs do not. |
| Mobile | Core editor issues addressed; specialist workflows still need expansion | The note header now has one back control and editable title, the title is geometrically centered, tabs and actions are reachable, the task center fits the viewport, and the editor no longer globally suppresses native context menus. Rulers remain desktop-only by design. Scan, stylus, widgets, and platform share extensions remain absent. |

## Editor tool audit

This is the current command grouping and release assessment. The grouping uses
user intent, not implementation type.

| Tab / surface | Included tools | Assessment |
| --- | --- | --- |
| Home | Find/replace; font family and size; block style; bold, italic, underline, strike, colour, highlight, sub/superscript, inline code, clear formatting; alignment; bullets, numbering, checklist controls; cut/copy/paste, format painter; undo/redo | Correct grouping. Clipboard operations retain browser permission constraints and now coexist with the native context menu. Checklist customization clearly distinguishes the current selection from future-item defaults. |
| Insert | Quote, code block, divider, callout, table, image, link, text box, shape, translation, date, and time | Correct grouping. Table and object tools have real editing controls. Generic attachments, equations, drawings, audio, scanner capture, and reusable embeds are verified gaps, not placeholder buttons. |
| Layout | Indent, line height, letter spacing, drop cap, paragraph spacing, page break, and paper style | Correct grouping after moving page geometry out of formatting. Paper selection is persisted with the note and export. Pagination and page-break behavior have production-browser regression coverage. |
| Review | Spell check, accessibility checker, document statistics, version history, and dictation | Correct grouping. The accessibility checker tests heading order, missing image descriptions, missing table headers, and vague link text. Dictation depends on browser speech support; translation is opt-in and external. Comments and suggestion mode are product gaps. |
| View | Document outline, ruler, formatting marks, document width, focus mode, HTML source, and keyboard shortcuts | Correct grouping. The ruler is intentionally disabled on compact screens rather than exposing an unstable miniature control. The document outline navigates headings directly. |
| Note actions | Favorite, pin, folder, tags, reminder, internal links/backlinks, share, export, duplicate/archive/delete, and editor customization | Keeping document identity and durable actions in the single top application bar is appropriate. The ribbon tabs now sit on a neutral command surface, eliminating the former double-green header and preserving one strong brand anchor. |

## Delivered in this pass

1. Rebuilt the editor header into one dark-green application bar plus a neutral
   tab surface. The title is centered against the viewport, not the leftover
   space between unequal action groups, and mobile has one back control.
2. Added a workspace-wide task center with useful filters, counts, task search,
   source context, source navigation, and direct completion across every
   task-bearing note type.
3. Added durable recurring tasks with daily, weekday, weekly, monthly, and
   yearly schedules plus a configurable interval. Completing a recurring task
   retains the completed occurrence and creates the next one.
4. Added a local-date Today workflow that reopens the day's journal instead of
   creating duplicates.
5. Unified global search with the structured note index and added note-type
   filters.
6. Restored native context-menu behavior for text selection, copy/paste,
   spelling, password managers, and accessibility tools.

## Flagship delivery sequence

The remaining work should be delivered as complete vertical systems in this
order. These are commitments in the product backlog, not reasons to hide the
gaps.

### P0: daily trust and organization

- Saved views / Smart Folders with persisted compound rules, counts, editing,
  empty states, mobile navigation, backup/export, and migration coverage.
- Per-task reminders and recurrence exceptions connected to the task center.
- User-defined reusable templates for documents and structured workspaces.
- Scale work: cached indexing, result totals, and server pagination where a
  synced collection exceeds the client-side operating envelope.

### P1: research and reference

- Generic attachments and PDF preview, including Supabase Storage policies,
  owner quotas, MIME/signature validation, malware strategy, offline caching,
  deletion/restore consistency, sharing, export, and mobile download behavior.
- Scan-to-note and OCR indexing with explicit privacy and processing states.
- Web capture through a browser extension or share target with sanitization,
  source attribution, duplicate handling, and permission minimization.

### P1: collaboration and privacy

- Threaded comments, mentions, assignments, notifications, resolution state,
  and permission-aware deletion.
- Note locking / end-to-end encryption with recovery and explicit limitations
  for search, sharing, previews, and history.

### P2: knowledge and extensibility

- Saved property schemas and database-like views where they improve repeated
  workflows rather than turning every note into a database.
- User-authorized plugins or automations with a bounded permission model.
- A canvas/graph mode only after its navigation, keyboard, mobile, export, and
  sync contracts can match the rest of the application.

## Verification boundary

The release gate for this pass includes lint, unit/integration tests, production
build, production-bundle browser workflows, mobile viewport checks, axe WCAG
A/AA scans, deployment validation, and diff hygiene. A compiling build alone is
not treated as completion. Remote Supabase behavior is reported separately and
must not be marked verified until a connector or staging environment is
available.

## Official sources reviewed

- Microsoft OneNote: [search notes](https://support.microsoft.com/en-us/OneNote/onenote-help-and-learning/search-notes-in-onenote), [take and format notes](https://support.microsoft.com/en-us/onenote/take-and-format-notes), and [insert or attach files](https://support.microsoft.com/en-US/OneNote/onenote-help-and-learning/insert-or-attach-files-to-notes)
- Evernote: [Tasks overview](https://help.evernote.com/hc/en-us/articles/1500003792141-Tasks-Overview), [search](https://help.evernote.com/hc/en-us/articles/209005647-Find-what-you-need), and [clip formats](https://help.evernote.com/hc/en-us/articles/209125827-Clip-formats)
- Obsidian: [Daily notes](https://obsidian.md/help/plugins/daily-notes), [Templates](https://obsidian.md/help/plugins/templates), [Backlinks](https://obsidian.md/help/plugins/backlinks), and [Canvas](https://obsidian.md/help/plugins/canvas)
- Joplin: [product help](https://joplinapp.org/help/), [note history](https://joplinapp.org/help/apps/note_history/), and [OCR](https://joplinapp.org/help/apps/ocr/)
- Notion: [database properties](https://www.notion.com/help/database-properties), [views, filters, and sorts](https://www.notion.com/help/views-filters-and-sorts), and [offline pages](https://www.notion.com/en-gb/help/use-pages-offline)
- Google Keep: [create and edit notes](https://support.google.com/keep/answer/2888240?co=GENIE.Platform%3DDesktop&hl=en) and [share notes](https://support.google.com/keep/answer/6101196?co=GENIE.Platform%3DAndroid&hl=en)
- Apple Notes: [Smart Folders](https://support.apple.com/guide/notes/use-smart-folders-apd58edc7964/mac), [links between notes](https://support.apple.com/en-gb/guide/notes/apde615d29c2/mac), and [scan documents](https://support.apple.com/en-gb/108963)
