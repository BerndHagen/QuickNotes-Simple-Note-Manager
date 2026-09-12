# QuickNotes architecture stabilization

Last updated: 2026-09-12

## Purpose and status

This document is the working and final record for the architecture stabilization mandated by `Tasks/QuickNotes/EMERGENCY.md`. It is deliberately separate from the historical task-progress ledgers. The goal is not to add product scope; it is to make the existing product safer to change, easier to verify, and governed by explicit ownership boundaries.

Status: **complete and verified**

## Verified current architecture

### Application and workspace shell

- `src/App.jsx` owns the authenticated application frame, responsive pane visibility, mobile history integration, navigation overlay, note-list/editor switching, Inspector placement, and the shared top bar.
- `src/components/Sidebar.jsx`, `src/components/NotesList.jsx`, `src/components/NotesGrid.jsx`, `src/components/NoteEditor.jsx`, and `src/components/Inspector.jsx` are the principal panes.
- Responsive decisions originate in `src/hooks/useLayoutMode.js`; pane widths originate in the UI store and are applied through the shared resizable-pane boundary.
- Document, Paper, and Canvas intentionally keep different content engines. The seven structured workspaces share `StructuredWorkspaceShell`, `WorkspaceTabs`, and `WorkspaceSection`.

### Content engines

- Document content is sanitized TipTap/ProseMirror HTML in `notes.content`. `RichTextEditor.jsx` is now the orchestrator; extension construction, command definitions, toolbar presentation, document chrome, and page geometry live in bounded modules under `src/components/editor/`.
- Structured workspaces use versioned, normalized `notes.noteData`; `editors/noteTypes.js` owns defaults, normalization, and starter data.
- Paper and Canvas use canonical spatial documents/pages/objects in dedicated Dexie tables. They must not be collapsed into HTML or structured `noteData`.
- Attachments, recognition, annotations, lexical indexes, comments, and conflicts have separate repositories because their lifecycle and dependency ordering differ.

### Persistence, sync, and recovery

- `src/lib/db.js` owns the versioned Dexie schema and atomic local operations. Canonical local commits precede optional cloud synchronization.
- `src/store/index.js` remains the compatibility entry point for note/catalog state. Backend synchronization, collaboration state, and theme/UI stores are composed from `syncActions.js`, `collaborationState.js`, and `uiStores.js` without changing caller imports or persisted keys.
- Cloud work is intentionally separated into catalog, spatial, capture, and annotation synchronizers. Consolidation must remove accidental duplication without merging those different dependency graphs into one payload.
- Backups are versioned, bounded, validated, identity-remapped, and committed atomically. Derived search data is rebuildable; canonical sources are not.

### Design and responsive system

- `src/styles/tokens.css` is the semantic design-token authority and `tailwind.config.js` maps those tokens to utilities.
- `src/index.css` contains shared application rules. Structured-workspace rules and document-workbench rules are imported from `src/styles/workspaces.css` and `src/styles/document-workbench.css`, preserving cascade order while giving each presentation system an explicit owner.
- Header and navigation surfaces must use the exact approved colors `#162327` and `#121c20`. Other interactive colors remain semantic tokens rather than component literals.
- Mobile is a first-class shell mode, not a scaled desktop canvas. A workspace owns one primary vertical scroller; narrow command collections may scroll inline, but primary actions and content may not depend on page-level horizontal scrolling.

### Document pagination

Desktop pagination has three coordinated participants:

1. `PaginationExtension.js` measures ProseMirror blocks and creates non-document widget decorations that provide page fill and gutter flow.
2. `DocumentPageSheets` paints independent paper fills, edges, and gaps behind/above the editor.
3. `documentPageBounds.js` reads the painted page rectangles for floating document objects.

The document model contains explicit page-break nodes but does not persist automatic visual breaks. Automatic pagination remains derived presentation, not user data. `src/components/editor/pageGeometry.js` is the shared geometry authority for page ratio, gap, measurements, and normalized page positions consumed by the plugin, React sheets, rulers, and object constraints.

On phones the Document editor intentionally becomes a continuous writing surface. Explicit page breaks remain in the document and desktop/print pagination remains reproducible, while simulated A4 gutters do not consume the narrow editing viewport.

## Verified debt, root causes, and outcomes

| Finding | Verified cause | Completed outcome |
| --- | --- | --- |
| `src/store/index.js` was reported at 3,642 lines | One Zustand store body included backend sync plus unrelated collaboration and UI stores | Reduced to 2,480 lines by extracting sync, collaboration, and UI modules behind the unchanged public store API |
| `RichTextEditor.jsx` was reported at 3,715 lines | Extensions, chrome, geometry, drawing, commands, menus, and the complete ribbon shared one module | Reduced to 1,144 lines; editor command, extension, toolbar, chrome, and geometry modules preserve the document schema and component API |
| `src/lib/i18n.js` was reported at 4,035 lines | Nine complete locale dictionaries shared the runtime helper module | Reduced to 60 lines plus one module per locale, with value-equivalence and fallback tests |
| Build reported a roughly 796 KB `WorkspaceZoomControls` chunk | A component barrel eagerly imported every specialized editor, including callers needing only metadata | Metadata is separated and every editor is loaded through a lazy registry; `WorkspaceZoomControls` is 4.42 KB and the largest application JavaScript chunk is 427.29 KB |
| 38 `@fontsource` families appeared as eager startup imports | `main.jsx` imported both bundled weights for every family | Existing document fidelity is preserved, but a family is now imported only when selected or found in document HTML |
| Reported 19 TODO/FIXME markers | Broad text matching counted the `TODO_LIST` enum and translated words such as “todos”; exact marker search returned zero | The final audit records the exact-marker result instead of treating ordinary product vocabulary as debt |
| Repeated pagination regressions | Page geometry was calculated and rounded in several layers | One geometry contract now drives pagination, page sheets, rulers, and object bounds; long legacy checklists, explicit breaks, Focus mode, zoom, reload, shadows, and complete focus edges have rendered regressions |
| TipTap 2 carried a prototype-pollution advisory | The editor dependency family was on the final v2 line | Every direct TipTap package is aligned on 3.31.3; v3 content-update and destruction lifecycle differences have dedicated persistence/reload coverage |

## Target ownership boundaries

### State modules

`src/store/index.js` remains the compatibility entry point exporting `useNotesStore`, `useThemeStore`, and `useUIStore`. Its implementation composes bounded modules:

- workspace state and normalization;
- note and catalog actions;
- session/account transitions;
- sync orchestration and conflict handling;
- collaboration actions;
- theme and UI preference slices.

No action name, state key, persisted storage key, partialization rule, or caller import changes merely because code moved.

### Editor modules

`RichTextEditor.jsx` is the document-editor orchestrator. Extensions, pagination geometry, page/ruler presentation, object drawing, command menus, toolbar primitives, and ribbon groups live in named modules with explicit props. `NoteEditor` lazy-loads the document editor and the specialized editor registry lazy-loads workspace implementations.

### Presentation modules

- Semantic tokens own application color, spacing, elevation, focus, and control sizing.
- Shared UI primitives own buttons, icon buttons, fields, checkboxes, menus, modals, and dialog headers.
- The app shell owns pane composition and responsive mode.
- Structured workspace shell primitives own headers, summaries, commands, tabs, sections, and the single scroll boundary.
- Individual workspaces own only their domain forms and content views.

### Pagination geometry

One geometry module owns A-series ratio, page gap, measurement normalization, page positions, and scale conversion. The ProseMirror plugin publishes derived page geometry; sheets, rulers, and document-object bounds consume it. CSS paints the result but does not independently infer page count or dimensions.

## Non-negotiable compatibility invariants

- Do not rename or remove IndexedDB tables, indexes, note fields, `noteData` versions, storage paths, outbox operations, local-storage keys, or Supabase identities without an explicit compatible migration.
- Do not rewrite a note merely because it was opened, measured, focused, paginated, or viewed on another device.
- Do not persist automatic page breaks. Explicit page breaks and document content remain authoritative.
- Do not silently resolve unsafe concurrent edits with last-writer-wins when the current system exposes a conflict.
- Do not make local saves depend on network success.
- Do not load an external provider or expose a provider-backed action when capability/privacy checks fail.
- Do not remove bundled font support from existing notes; optimize delivery, not document fidelity.
- Do not merge Document, Paper, Canvas, capture, or annotation persistence formats.

## Completed implementation sequence

1. Establish design/product naming tokens and architectural guardrails.
2. Remove eager editor and font loading; measure production chunks again.
3. Split locale data with value-equivalence verification.
4. Extract store state/sync/action modules behind the existing store API.
5. Split rich-editor presentation and command modules behind the existing component API.
6. Consolidate pagination geometry and reproduce long legacy/checklist layouts in real browsers.
7. Audit shared shell, structured workspace, responsive, and primitive ownership; remove superseded overrides in touched systems.
8. Run unit/integration, lint, build, production deployment, mobile/desktop browser, accessibility, persistence, migration, backup, sync, and visual workflows.
9. Refresh repository screenshots and final architecture/release documentation only from the verified production build.
10. Review the complete diff for accidental data, feature, security, and public-documentation changes before publishing.

## Verification record

### Automated and rendered verification

- `npm test` — 115 files and 472 tests passed. This includes database migrations, backup/import identity remapping, sync/account isolation, store boundaries, locale equivalence, lazy font detection, editor content preservation, and architecture size/import guards.
- `npm run lint` — passed with unused-disable reporting enabled.
- `npm audit --omit=dev` — zero production dependency vulnerabilities after aligning the complete TipTap family on 3.31.3.
- `npm run test:deployment` — production build passed, followed by 7/7 checks for relative manifest identity, actual PNG dimensions, base-path-safe assets, build-manifest containment, service-worker revisioning, deep GitHub Pages fallback, and a cache-only offline reload.
- `npx playwright test --project=chromium` — 192 production-build workflows passed. Coverage includes populated Document, Paper, Canvas, Task List, Project, Meeting, Journal, Brainstorm, Shopping, and Weekly workspaces; keyboard and dialog behavior; light/dark accessibility; 200% reflow; 320, 360, 375, 390, 412, 667, 768, 1024, 1280, 1440, and 1920 pixel viewports; page shadows and focus edges; long legacy checklist pagination; desktop/editor zoom ownership; touch drawing and dragging; backup/import/export; multitab conflicts; capture; annotation; and Meeting actions/reminders.
- `npx playwright test --project=mobile-webkit` — 15 workflows passed and one synthetic two-contact pinch test was skipped because Playwright WebKit cannot emit that gesture. iPhone-style WebKit still exercised real touch Paper drawing/panning/persistence, Canvas sizing, all non-spatial workspaces, settings/help scrolling, rotation, browser history recovery, keyboard-sized editing, dialogs, safe areas, and touch targets. The editor-only two-contact zoom contract passed in the Chromium touch run.
- The PDF paper-style → reload → reopen → export workflow passed three consecutive production runs after the TipTap destruction-race fix; every download was checked as a real PDF.
- `npm run screenshots:update` regenerated ten current, populated, even-paired repository screenshots. Every image was visually inspected; Meeting was deliberately captured on its populated agenda rather than an empty capture panel.
- `npm run icons:update` regenerated the 16, 32, 96, 192, and 512 pixel web/PWA icons from the canonical editor logo; the resulting small and installed-app images were visually inspected.

### Measured architecture outcome

- `src/lib/i18n.js`: 4,029 lines in the prior commit → 60 lines plus locale modules.
- `src/components/RichTextEditor.jsx`: 3,533 lines in the prior commit → 1,144-line orchestrator plus bounded editor modules.
- `src/store/index.js`: 3,399 lines in the prior commit → 2,480-line compatibility entry plus sync, collaboration, and UI-store modules.
- `src/index.css`: 5,251 lines in the prior commit → 2,841 shared lines plus explicit workspace and document stylesheets.
- `WorkspaceZoomControls`: approximately 796 KB before lazy boundaries → 4.42 KB. The largest application JavaScript chunk is now the lazy PDF group at 427.29 KB; the build emits no 500 KB JavaScript warning.

### Failures found and fixed during final verification

- TipTap 3 creates the editor object before its React view is mounted. Early `view.dom` reads caused reload-only error boundaries; DOM-dependent work now waits for the mounted `.ProseMirror` element.
- TipTap 3 clears its schema during destruction. A queued content synchronization callback could serialize a destroyed instance during navigation; serialization now requires a live editor and schema.
- TipTap 3 changed `setContent` options. The old boolean form could emit a content update while merely opening a note; all calls now use `{ emitUpdate: false }`, retaining the invariant that viewing never edits.
- The repository favicon/PWA images still used the older green logo even though application chrome used the new editor logo. All declared sizes now derive reproducibly from the same canonical source.

### Honest remaining verification boundary

No live paid external transcription request was made because `OPENAI_API_KEY` is intentionally not configured; the existing action remains capability-gated. No physical iPhone was connected to this environment. The production application was exercised in Chromium and mobile WebKit with touch-capable device contexts, and the one gesture the WebKit automation layer cannot genuinely synthesize is explicitly reported above rather than claimed.
