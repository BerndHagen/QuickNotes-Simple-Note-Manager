# Competitive capability review

Reviewed 2026-08-20 against current official product documentation. The goal is
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

- Word organizes commands into predictable ribbon tasks and lets users
  customize that hierarchy. QuickNotes now uses five substantial tabs (Home,
  Insert, Layout, Review and View): text formatting is in Home, paragraph/page
  geometry is in Layout, proofing is in Review, and source/display utilities
  are in View. Narrow panes scroll only the active flat command row.
- Word creates text boxes by dragging to the requested size and moves them from
  their border. QuickNotes now uses the same direct-manipulation contract for
  text boxes and twelve genuine SVG shapes: choose an object, drag on the page
  to create it at that size and position, then drag the surface/border to move
  it or any of eight handles to resize it. Objects are clamped to the page,
  expand its scrollable height, and retain exact geometry in note HTML.
- Text boxes now include free/in-flow/left-wrap/right-wrap layouts, exact X/Y/W/H
  fields, text alignment, transparent or custom background fills, and configurable
  border style, colour, and weight. Shapes additionally retain rotation,
  Shift-constrained 15-degree rotation, 90-degree commands, flips, editable
  text, and a visual change-shape gallery.
- Word's ruler spans the page, shades non-writing margins, and uses paragraph
  indent markers and typed tab stops; its list
  tools support custom bullet symbols. QuickNotes now persists repeatable
  40-pixel indent levels, left/right/first-line ruler geometry, draggable tab
  stops and real Tab-key advances. Checklists remain nested and can use square,
  rounded, or circular controls.
- Notion's board view confirms Kanban as a status-based workspace pattern.
  QuickNotes already had a full Project Board with columns, drag-and-drop,
  milestones, assignees and keyboard status movement; it was a discovery gap,
  not a missing capability. The rail now names **Workspaces** directly.
- Notion Forms is a response-collection system connected to databases, public
  links and permissions. That is a different product model from document
  shapes and would require a durable response schema, access policy and abuse
  controls, so a cosmetic in-note form builder was deliberately not added.
- Evernote concentrates many content types in an Insert menu and supports
  tasks, tables, links, a table of contents, attachments and audio. QuickNotes
  already covers the note-native core; generic attachments remain deferred
  until storage quotas, validation, offline caching and deletion are complete.

## Editor workbench follow-up

The second editor pass addressed the gap between feature presence and feature
control. These decisions were validated against the live QuickNotes document
model rather than implemented as visual imitations.

| Observed mature-editor pattern | QuickNotes decision in this pass |
| --- | --- |
| Office lets users show or collapse the ribbon and personalize tabs/groups; Evernote also offers note-width choices. | Added one visible **Customize editor** entry point plus persistent note width, ribbon density, default tab, group-label, ruler, typography, tab, and new-checklist defaults. |
| Word treats the ruler as a View choice, exposes before/after paragraph spacing alongside indents, and aligns its ruler to the full page with shaded margin areas. | View owns the ruler toggle; Layout owns paragraph geometry. The ruler spans the document page, marks both non-writing margins, and keeps tab/indent coordinates relative to the writing area. |
| Evernote distinguishes checkboxes from checklist behavior, and Notion exposes actions on the current block instead of requiring whole-list replacement. | The checklist menu now edits the current item: toggle completion, add above/below, remove only that checkbox, choose square/rounded/circle geometry, six tick colours, three sizes, and strike/fade/unchanged completed text. New-item defaults are separate from existing-item data. |
| Notion and Evernote expose searchable slash insertion; Notion includes callouts and block conversion. | Typing `/` on an otherwise empty line opens a keyboard-operable, searchable insert menu for text, headings, lists, checklist, callout, quote, code, divider, table, and date. Insert also contains semantic callouts and date/time commands. |
| Evernote offers selectable note width and keeps the document distinct from navigation chrome. | The editor now renders a centered document surface on a quiet workbench instead of an undifferentiated white debug area. Focused, standard, wide, and full-width modes are durable preferences. |

The browser test exposed and fixed an important integration defect: TipTap's
stock task-item node view only repaints its `checked` attribute. QuickNotes now
owns the node-view update path, so custom checkbox attributes update the live
DOM immediately as well as saved HTML. This prevents the misleading state where
settings appeared selected in a menu but did not visually affect the note until
reload.

### Capabilities deliberately not faked

- Arbitrary drag-reordering of every ProseMirror block remains deferred until
  pointer, keyboard, nested-list, table, object, undo, and collaborative
  transaction behavior can share one reliable model.
- Comments, suggestions, assignments, and track changes remain collaboration
  features requiring permissions, identity, notifications, and version-aware
  persistence—not toolbar buttons alone.
- Equations, generic attachments, PDF previews, audio transcription, drawing,
  and OCR remain separate lifecycle/privacy projects. A label that opens an
  incomplete dialog would reduce trust rather than increase editor maturity.

## 2026-08-20 reliability and visual-quality pass

This pass deliberately improved existing workflows instead of adding another
surface-level feature. The official references reinforced three useful product
contracts: a PDF export should create a portable file that keeps its appearance;
block controls should clearly act on the current selection or on future blocks;
and paper/width choices are document presentation, not disposable menu state.

| Area | Finding | Product decision |
| --- | --- | --- |
| Checklist controls | Shape and colour actions previously had no visible scope, silently did nothing outside a task item, and did not reliably affect a selection. | The menu now names its scope, shows selected state, edits the current item or every selected item, and otherwise changes persistent defaults used by the next checklist. |
| PDF export | The PDF command opened a browser print tab, making pop-up settings and the operating-system print dialog part of the workflow. It also rendered a separate generic document instead of the note surface. | PDF now downloads directly, starts with a valid PDF file signature, paginates at content boundaries where possible, sanitizes rich HTML, and renders the saved paper, title, metadata, tags, typography, tables, callouts, task items, and document objects. The rendering libraries are loaded only when export is requested. |
| Paper choice | Paper lived only in component state, so reloads and exports could not honor it. | Paper type is now stored in the note's standard `noteData`, which also brings it into existing sync, backup, and version-history behavior. |
| Editor hierarchy | The paper and surrounding workbench were too close in value; the toolbar also blended into the page. | The workbench is now a stronger neutral material close to Word's `#e6e6e6`, the toolbar uses a quieter near-`#f3f3f3` surface, and the paper has a clearer edge without looking boxed in. |
| Title area | The full-width green replacement did not match the requested recent editor banner. | Restored the exact `027ca7e` document header: a neutral surface with two restrained elliptical contours confined to the far-right edge, plus the original neutral title, metadata, action, and hover colours. The startup miniature reuses this same header class instead of duplicating it. |
| Left rail | The deep-green radial/linear gradient remains legible and gives the application a stable visual anchor. | Retained it. Replacing it with another flat grey would weaken navigation hierarchy without solving a usability defect. |

No attachment system, comments layer, handwriting canvas, OCR, or AI surface was
added. Those remain valuable only when their permissions, storage, recovery,
privacy, offline, and mobile behavior can be delivered end to end.

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
- Microsoft Word: [customize the ribbon](https://support.microsoft.com/en-us/word/customize-the-ribbon-in-word), [use the full-page ruler and typed tab stops](https://support.microsoft.com/en-us/word/using-the-ruler-in-word), [change document layout](https://support.microsoft.com/en-us/word/training/change-document-layout), [display page white space and formatting marks](https://support.microsoft.com/en-us/word/word-options-display), [add and move text boxes](https://support.microsoft.com/en-us/office/add-copy-or-remove-a-text-box-in-word-57e099ac-0525-46ae-8109-8a1d844f5834), [custom bullets](https://support.microsoft.com/en-us/office/create-custom-bullets-with-pictures-or-symbols-9e01908a-8ab1-4d0b-82c2-d83b9c5dc722), and [rotate or flip objects](https://support.microsoft.com/en-us/office/rotate-or-flip-a-text-box-shape-wordart-or-picture-in-word-8e55a7a0-274b-455b-a8aa-4aacd437c527)
- Microsoft OneNote: [drawing and shapes](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/draw-and-sketch-notes-in-onenote)
- Notion: [board views](https://www.notion.com/help/boards) and [forms](https://www.notion.com/en-gb/help/forms)
- Evernote: [editor and insert options](https://help.evernote.com/hc/en-us/articles/360022954093-Note-editor-and-editing-toolbar-overview)
- Evernote: [editor width, floating formatting, slash commands, draggable blocks and collapsible sections](https://help.evernote.com/hc/en-us/articles/360022954093-Note-editor-and-editing-toolbar-overview)
- Evernote: [sidebar and navbar customization](https://help.evernote.com/hc/en-us/articles/221189627-Sidebar-and-Navbar-Overview)
- Notion: [writing, block actions, slash commands, callouts and toggle lists](https://www.notion.com/help/writing-and-editing-basics)
- Microsoft Word: [wrap text and move objects](https://support.microsoft.com/en-us/word/wrap-text-and-move-pictures-in-word)
- Microsoft Word: [paragraph indentation and before/after spacing](https://support.microsoft.com/en-US/Word/adjust-indents-and-spacing-in-word)
- Microsoft Office: [save or convert documents to PDF](https://support.microsoft.com/en-US/Office/collab-files/save-or-convert-to-pdf-or-xps-in-office-desktop-apps)
- Microsoft Office: [ribbon visibility and customization](https://support.microsoft.com/en-US/Office/foundations-experiences/customize-the-ribbon-in-office)
- Microsoft OneNote: [free-positioned notes, formatting, search and follow-up tags](https://support.microsoft.com/en-us/onenote/take-and-format-notes)
- Apple Notes: [editable tables, text conversion and row/column movement](https://support.apple.com/guide/notes/add-a-table-apd0a136b9cc/mac)
