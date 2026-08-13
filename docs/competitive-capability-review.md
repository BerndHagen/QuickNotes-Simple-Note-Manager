# Competitive capability review

Reviewed 2026-08-13 against current official product documentation. The goal is
not to combine every specialist feature from every notes product. It is to keep
QuickNotes complete for its core job without adding shallow, unsafe, or
unfinished parity features.

## Current competitive core

QuickNotes already covers the capabilities that matter most to its product
identity:

- Offline-first browser storage, optional cloud sync, an explicit sync queue,
  and conflict reconciliation.
- Rich documents with images, tables, code blocks, task lists, translation,
  voice input, find/replace, and 39 bundled cross-platform font families.
- Folders, nested folders, tags, pinning, favorites, archive, trash, duplicate
  detection, full-text search, sorting, and multi-selection.
- Internal note links with backlinks and exact in-app navigation.
- Version history with restoration.
- User-bound invitations, view/edit permissions, live shared-note updates, and
  one case-preserving username for owner provenance.
- Reusable starters plus dedicated task, project, meeting, journal, idea,
  shopping, and weekly-planning workspaces.
- Reminders, keyboard customization, focus mode, import, multi-format export,
  responsive mobile editing, accessibility coverage, and installable PWA
  behavior.

This compares well with the shared foundation documented by Google Keep
(notes, lists, labels, reminders, archive, sharing and grid/list views), Notion
(structured databases, collaboration and selective offline use), and Apple
Notes (formatting, tables, links, tags, folders, sharing, import/export and
attachments).

## Evaluated gaps and decisions

| Capability | User value and fit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Generic file and PDF attachments | High for research and project reference material. OneNote, Apple Notes and Evernote all treat files as first-class note content. | Requires Supabase Storage policy design, quotas, offline caching, deletion consistency, file validation, mobile preview/download behavior and abuse controls. | Strong future candidate; not selected until the entire storage lifecycle can be production-ready. |
| Saved views / smart folders | High for repeated compound filters and large workspaces. | Needs a persisted filter model, editing UI, empty/error states, migration and mobile navigation integration. | Accepted for future product discovery; current folders, tags, search, sorting and dedicated views already cover ordinary organization. |
| Comments, mentions and assignments | Valuable for teams collaborating around a note. | Requires new permission-aware persistence, notifications, identity lookup, moderation/deletion rules and realtime behavior. | Defer. QuickNotes currently supports shared editing but is not positioned as a full team communication suite. |
| Browser web clipper | Valuable for research capture; Evernote provides article, simplified article, selection, screenshot and annotation capture. | A separate browser extension adds store distribution, broad page permissions, sanitization, cross-browser maintenance and support burden. | Defer until research capture is a validated primary workflow. |
| Locked notes / end-to-end encryption | High privacy value. Apple Notes supports locked notes. | Real encryption affects recovery, search, previews, sync, sharing, version history and key management. A cosmetic password dialog would be unsafe. | Keep as a security-design candidate; reject partial implementation. |
| Drawing, handwriting and OCR | Strong for stylus users, scans and classrooms; OneNote, Keep and Evernote provide variants of these workflows. | Canvas input, stroke persistence, accessibility, handwriting recognition and OCR are separate specialist systems; OCR may add external processing and privacy cost. | Not selected for the current simple-note product scope. |
| Graph view and infinite canvas | Useful for visual knowledge mapping; Obsidian provides backlinks, graph view and Canvas. | Adds a second navigation and editing model. QuickNotes already has backlinks and a structured idea board. | Reject for now: limited incremental value relative to complexity. |
| Semantic / generative AI and meeting transcription | Can accelerate search, summaries and meeting capture; current Notion, Evernote, OneNote and Apple Notes documentation describes AI or transcription features. | Ongoing service cost, privacy/consent requirements, data residency, reliability and vendor dependency. | Reject as a default dependency. Translation remains an explicit opt-in external action. |
| Native widgets and platform-only integrations | Faster capture on supported operating systems. | Requires separate native applications and creates platform inconsistency. | Retain the cross-platform PWA and quick-capture path instead. |

## 2026-08-13 focused follow-up

The editor and workspace changes in this pass were selected against current
official product guidance:

- Word for the web makes its simplified, single-line ribbon the default and
  expands to the classic ribbon when the user needs less-common commands.
  QuickNotes now keeps everyday writing, lists, tables, links, images, text
  boxes and shapes visible, with specialist typography, alignment, source and
  page controls behind an explicit **More / Simplify** switch.
- Word exposes direct drag sizing, exact width and height, free rotation,
  Shift-constrained 15-degree rotation, 90-degree commands and horizontal or
  vertical flips. OneNote also treats shapes as useful note objects. QuickNotes
  now persists that practical subset directly in note HTML for rectangles,
  rounded rectangles, ellipses, diamonds and arrows with editable text,
  alignment and restrained colour presets.
- Notion's board view confirms Kanban as a status-based workspace pattern.
  QuickNotes already had a full Project Board with columns, drag-and-drop,
  milestones, assignees and keyboard status movement; it was a discovery gap,
  not a missing capability. The rail now names **Workspaces & Kanban** directly.
- Notion Forms is a response-collection system connected to databases, public
  links and permissions. That is a different product model from document
  shapes and would require a durable response schema, access policy and abuse
  controls, so a cosmetic in-note form builder was deliberately not added.
- Evernote concentrates many content types in an Insert menu and supports
  tasks, tables, links, a table of contents, attachments and audio. QuickNotes
  already covers the note-native core; generic attachments remain deferred
  until storage quotas, validation, offline caching and deletion are complete.

## Product conclusion

QuickNotes should not claim to contain “everything” from every competitor; no
professional product can make that claim without becoming incoherent. It does
cover the polished core expected from a modern cross-platform notes manager.
The most credible next expansion is generic attachments, followed by saved
views, but only after their complete persistence, privacy, recovery, mobile and
backend flows are designed and tested.

## Official sources reviewed

- Notion: [offline pages](https://www.notion.com/help/use-pages-offline) and [databases](https://www.notion.com/help/intro-to-databases)
- Evernote: [tasks](https://help.evernote.com/hc/en-us/articles/1500003792141-Tasks-Overview), [search and OCR](https://help.evernote.com/hc/en-us/articles/360040282613-Search-overview), and [Web Clipper](https://help.evernote.com/hc/en-us/articles/209125877-Evernote-Web-Clipper-Quick-Start-Guide)
- Microsoft OneNote: [note content](https://support.microsoft.com/en-us/onenote/take-and-format-notes) and [product overview](https://support.microsoft.com/en-US/OneNote/onenote-help-and-learning/introducing-onenote)
- Obsidian: [backlinks](https://obsidian.md/help/plugins/backlinks), [graph view](https://obsidian.md/help/plugins/graph), and [Canvas](https://obsidian.md/help/plugins/canvas)
- Apple Notes: [macOS Notes guide](https://support.apple.com/guide/notes/welcome/mac)
- Google Keep: [product workflow](https://support.google.com/keep/answer/2888240) and [sharing](https://support.google.com/keep/answer/6101196)
- Microsoft Word: [simplified ribbon](https://support.microsoft.com/en-US/Word/using-the-simplified-ribbon-in-word-for-the-web), [drawing and sizing](https://support.microsoft.com/en-US/Word/add-a-drawing-to-a-document), and [rotate or flip objects](https://support.microsoft.com/en-us/office/rotate-or-flip-a-text-box-shape-wordart-or-picture-in-word-8e55a7a0-274b-455b-a8aa-4aacd437c527)
- Microsoft OneNote: [drawing and shapes](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/draw-and-sketch-notes-in-onenote)
- Notion: [board views](https://www.notion.com/help/boards) and [forms](https://www.notion.com/en-gb/help/forms)
- Evernote: [editor and insert options](https://help.evernote.com/hc/en-us/articles/360022954093-Note-editor-and-editing-toolbar-overview)
