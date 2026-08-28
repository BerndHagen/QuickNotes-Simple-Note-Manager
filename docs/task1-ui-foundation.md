# Task 1 UI foundation

## Existing product map

QuickNotes is a local-first React/Vite application backed by Zustand, IndexedDB/Dexie, and optional Supabase synchronization. The shell currently hosts a navigation rail, a collection pane, and either a TipTap document editor or one of seven structured workspace editors. UI preferences are persisted separately from note content.

Reusable foundations worth preserving:

- `App` session, shortcut, responsive-history, and deferred-surface orchestration
- `Sidebar`, `NotesList`, `NoteEditor`, and the structured editor registry
- the TipTap ribbon, editor commands, paper styles, status bar, and focus mode
- semantic tokens in `styles/tokens.css` and the primitives in `components/ui`
- shared modal, menu, focus-trap, and escape-key behavior
- local/cloud status derivation in `SyncStatus`
- compact/medium/wide layout semantics in `useBreakpoint`
- keyboard list navigation, global search, note context menus, and real workspace starters

## Weak or legacy presentation

- Green application chrome starts above the document editor only; structured workspaces have no equivalent chrome.
- At 1024px all three panes remain in-flow, leaving the document surface too narrow.
- The note list uses individually elevated rounded cards, reducing professional density.
- The light navigation rail uses a decorative multi-layer gradient and blurred ornament.
- `notesListWidth` is persisted but not applied, and there is no reusable inspector pane.
- Ribbon note chrome doubles as application chrome, coupling product identity to one editor implementation.
- Structured workspace headers share many CSS rules but sit outside a named shell grammar.

## Design rules for this migration

- One full-width forest-green top chrome owns product identity and global actions.
- Navigation, collection, workspace, and optional inspector are separate flat panes divided by borders.
- Warm paper belongs inside a neutral workbench; utility panes stay neutral.
- Ordinary controls use modest radii; dialogs may use a slightly larger radius.
- List view uses compact rows and a clear inset selected marker, not floating cards.
- At 1024px navigation is a drawer; at mobile widths the list and editor remain one-at-a-time.
- UI layout state remains in the UI store and never enters note persistence.
- Only functioning commands are exposed. Existing editor, sync, import/export, history, sharing, and workspace behavior remain in place.

## Migration plan

1. Add a shell-owned `TopChrome` and move product identity/global actions there.
2. Add reusable resizable collection/inspector pane primitives and persisted visibility/width state.
3. Restyle the existing ribbon's note bar as a workspace header on desktop.
4. Flatten and densify list rows and navigation while keeping current actions and keyboard behavior.
5. Validate document and structured workspaces at desktop, tablet, mobile, light, and dark sizes.

## Feature-parity checklist

- [x] Note creation, editing, deletion, favourites, pinning
- [x] Tags, folders, archive, trash, smart views
- [x] Collection search and global search (`Ctrl/Cmd+K`)
- [x] Rich text, tables, images, links, code, checklists, shapes
- [x] Task, project, meeting, journal, idea, shopping, and weekly workspaces
- [x] Settings, dark mode, keyboard shortcuts, focus mode
- [x] Local IndexedDB storage and optional cloud synchronization/sharing
- [x] Import/export, version history, reminders, templates
- [x] Responsive list/editor navigation and mobile browser history
- [x] Re-verify all parity items after the shell migration
