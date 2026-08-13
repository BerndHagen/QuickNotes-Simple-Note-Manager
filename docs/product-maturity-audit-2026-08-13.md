# QuickNotes product maturity audit

Date: 2026-08-13
Scope: production shell, core note workflow, structured workspaces, shared UI, responsive behavior, accessibility, and focused engineering risks.

## Executive assessment before implementation

QuickNotes already has a credible information architecture, a distinctive and legible dark navigation rail, a capable document editor, strong search, clear offline/local-first communication, semantic color tokens, and unusually broad automated browser coverage. The original application looked polished, but not yet consistently mature. Its strongest screens were the editor, navigation, search, and authentication flow.

The largest gap was hierarchy. At normal desktop sizes the product was placed inside a rounded, shadowed showcase frame, while every structured workspace opened with a saturated green hero containing decorative contours, a large icon, a progress ring or timer, and four KPI cards. Those layers made the user's work compete with product presentation. Repeated cards, thick borders, pills, and full-column Kanban colors reinforced the dashboard/template character.

## Findings and recommendations

| Severity | Issue | Why it lowers perceived quality | Location | Confidence | Recommendation | Scope |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | The production workspace becomes an inset, rounded, heavily shadowed window at desktop widths. | The browser/OS already provides an outer boundary. A second frame makes the product read as a screenshot being showcased and wastes working area. The behavior also changes abruptly at 1280 px. | `src/index.css`, `.qn-workspace-frame` desktop media query; body `.qn-canvas` | Objective problem | Run the product edge-to-edge at every viewport. Keep the framed canvas for authentication and external marketing only. | shared shell fix |
| P1 | Structured note types use tall saturated heroes and decorative contour graphics. | The header is the strongest focal point even though the task board, tasks, meeting details, and written content are the user's actual work. It consumes disproportionate vertical space on laptop screens. | All files in `src/components/editors/`; `.qn-type-hero` in `src/index.css` | Strong recommendation | Replace the hero treatment with a compact neutral workspace header. Retain green for icons, progress, focus, selection, and primary actions. | design-system fix |
| P1 | Project, task, and meeting headers present secondary counts as four KPI cards, often alongside duplicate summary/progress information. | Dashboard-style metrics compete with operational content and repeat the same state several ways. | `ProjectPlannerEditor.jsx`, `TodoListEditor.jsx`, `MeetingNotesEditor.jsx` | Strong recommendation | Use one compact semantic metric strip; remove redundant progress rings while retaining the percentage in text. Keep the meeting timer because it is an active tool. | shared component fix |
| P1 | Kanban state colors frame entire columns with strong blue, amber, and green borders/backgrounds. | Large color fields create three simultaneous focal points and make status more decorative than informative. | `ProjectPlannerEditor.jsx`, `COLUMN_COLORS` and board markup | Strong recommendation | Use neutral column surfaces and borders; confine semantic color to a small status indicator and exceptional states such as overdue. | local/shared pattern fix |
| P2 | The normal document header remains an inset green banner above the editor. | It is more restrained than the structured heroes, but still acts as a decorative card between app chrome and content. | `NoteEditor.jsx`, `.qn-note-banner` / `.qn-banner-surface` | Strong recommendation | Convert it to a flat, compact document header with neutral text and surfaces; preserve green through interaction states and tags. | shared component fix |
| P2 | The note list renders every item as an individually rounded bordered card. | Repetition creates container noise in a dense navigation surface and reduces scan efficiency. | `NoteCard.jsx` | Strong recommendation | Use flatter full-width rows with separators and an inset selected indicator. Preserve previews, tags, metadata, hover actions, and keyboard behavior. | shared component fix |
| P2 | Task rows use thick rounded borders and permanent icon clusters; some controls scale on hover. | The treatment resembles a component gallery, produces visual jitter, and gives low-priority controls too much weight. | `TodoListEditor.jsx`, `TaskItem` | Objective problem / strong recommendation | Flatten rows, use one-pixel separators, remove scale effects, and keep secondary actions visually quiet until hover/focus without hiding them on touch. | local fix |
| P2 | Structured workspace tabs are rounded filled pills on a raised/glass-like strip. | The selected navigation competes with primary actions and continues the nested-rounded-rectangle pattern. | `.qn-type-tabs` and all specialized editors | Strong recommendation | Use a flat tab rail with a restrained underline/edge indicator and no blur or floating shadow. | design-system fix |
| P2 | Specialized editors contain many one-off `rounded-xl`, `border-2`, hard-coded palette, menu, and focus treatments. | Equivalent controls do not share a stable visual language, and future changes require screen-by-screen patches. | `src/components/editors/*.jsx` | Objective problem | Establish shared workspace header/metric/form rules now; migrate deeper legacy menus and domain cards incrementally where behavior can remain unchanged. | design-system fix |
| P2 | Several task/project menus are bespoke absolutely positioned popovers rather than the shared menu primitive. | They do not inherit the shared collision, focus, Escape, and keyboard navigation behavior. | `TodoListEditor.jsx`, project forms | Objective problem | Migrate to the shared menu primitive in a focused follow-up; do not combine it with the hierarchy rewrite unless regression coverage is added. | shared component fix |
| P2 | The project board uses native drag as its primary direct manipulation. | Drag works with a pointer, but keyboard users need to open Edit and change the column instead of receiving an equivalent direct reorder affordance. | `ProjectPlannerEditor.jsx` | Objective problem | Retain the accessible Edit → column path and add explicit keyboard move actions if board usage research supports it. | interaction fix |
| P3 | Radius levels are tokenized, but legacy workspaces still select many one-off radii and shadows. | The system exists on paper but is not consistently consumed, which is noticeable through repetition. | `src/styles/tokens.css`, specialized editors and legacy dialogs | Objective problem | Reduce new work to control/card/dialog radii and replace legacy values during component migration. | design-system fix |
| P3 | The global CSS still includes legacy gradients and palette-specific overrides for editor tools. | These are contained and functional, but make the visual system harder to audit. | `src/index.css` | Objective problem | Remove only rules made dead by this pass; avoid an unrelated editor rewrite. | engineering cleanup |

No P0 release blocker was found in the inspected core workflow.

## Prioritized implementation plan

### Tier 1 — First impression and hierarchy

1. Remove the production workspace's artificial desktop frame and body canvas.
2. Replace structured heroes with compact neutral headers.
3. Replace KPI cards/progress rings with a semantic metric strip.
4. Restrain Kanban color to status indicators.
5. Flatten the document header so content becomes the strongest editor element.

### Tier 2 — Design-system consistency

1. Introduce a shared workspace metric primitive.
2. Align workspace title, tabs, form borders, radii, focus, and surface rules with existing tokens.
3. Flatten note and task rows while preserving density and interaction affordances.

### Tier 3 — Interaction maturity

1. Remove decorative hover scaling and transition-all usage in touched task/project controls.
2. Preserve hover/focus disclosure and touch-visible actions.
3. Verify title editing, filtering, task completion, tabs, timer controls, context menus, and drag/edit paths.

### Tier 4 — Accessibility, responsiveness, and edge cases

1. Use semantic `dl` markup for workspace metrics.
2. Test 390, 1024, 1366, 1440, and 1920 px layouts plus enlarged text.
3. Verify focus visibility, keyboard paths, reduced motion, contrast, long titles, empty states, and overflow.

### Tier 5 — Engineering cleanup

Limit cleanup to dead presentation rules and defects discovered in touched code. Preserve routing, persistence, synchronization, and domain state architecture.

### Tier 6 — Final micro-polish

Recheck optical alignment, row height, icon baselines, truncation, selected states, divider placement, and sticky regions after the hierarchy changes are rendered.

## Deliberate preservation decisions

- Keep the dark green navigation rail. It is legible, differentiated, and gives QuickNotes a recognizable identity.
- Keep authentication expressive, including its large green surface and framed product preview; it is a presentation context rather than a working surface.
- Keep the three-pane desktop structure and one-pane compact navigation model.
- Keep editor typography, readable line length, formatting toolbar, search/command UI, local-first status language, and existing shared dialog primitives.
- Keep semantic status color where it communicates overdue, destructive, warning, completion, selection, or priority state.
- Do not rewrite routing, state management, IndexedDB/Supabase persistence, sync, or rich-text architecture for this visual maturity pass.

## Post-implementation record

### Primary visual diagnosis and result

- **Green usage:** The original working surfaces used green as both brand and layout hierarchy. The final workspace is neutral-first; green remains prominent in navigation and is used selectively for primary actions, selection, focus, progress, tags, and semantic state.
- **Workspace headers:** The large green heroes were confirmed as the largest professionalism problem. They are now compact neutral headers with a small type icon, editable title, concise summary, and (where useful) a semantic metric strip.
- **Dashboard/stat treatment:** Redundant progress rings and four independent KPI cards were removed from project and task headers. Project, task, and meeting summaries now use a shared description-list primitive.
- **Cards and radii:** Note cards became full-width rows with separators and a precise selected edge. Task cards became flat rows. Functional cards remain where containment is useful, such as Kanban tasks and setting groups.
- **Kanban color:** Full blue/amber/green column frames became neutral columns with small status dots. Overdue and priority color remains semantic.
- **Navigation branding:** The dark green rail was preserved. It remains the main branded application surface and now reaches every viewport edge.
- **Editor/content hierarchy:** The inset green document banner became a flat neutral document header. The document body is now the strongest element in the editor.

### Changes implemented

- Removed the desktop-only 12 px application margin, artificial 16 px window radius, outer border, and large drop shadow.
- Removed the global decorative canvas from the signed-in product while keeping the authentication canvas and framed preview.
- Added `WorkspaceMetrics` for compact, semantic project/task/meeting summaries.
- Reworked focused-workspace title styling, tabs, form borders, header surfaces, and responsive metric layout.
- Removed redundant project/task progress rings.
- Neutralized Kanban column boundaries and confined status color to indicators.
- Flattened note-list cards and task rows while preserving metadata, selection, hover/focus actions, touch access, and keyboard navigation.
- Removed decorative hover scaling from touched task controls.
- Removed the duplicate specialized-workspace title from compact app chrome.
- Corrected the shopping Settings hover color exposed by neutral-header contrast testing.
- Added an automated desktop-boundary regression at 1440 × 900.

### Verification performed

- Unit/integration: 47 files, 227 tests passed.
- Browser: 101/101 Playwright tests passed across Chromium and mobile WebKit.
- Viewports: automated 320, 360, 375, 390, 412, 667 landscape, 768, 1024, 1280, 1440, and 1920 px checks; manual rendered comparison at 390, 1024, 1366, and 1440 px.
- Accessibility: axe WCAG A/AA scans passed for authentication, light/dark workspace and editor, settings, shortcuts, every specialized workspace, expanded structured controls, and relevant dialogs.
- Keyboard/touch: sidebar reachability, editor controls, dialog focus trap/Escape/restoration, mobile Back/Forward behavior, touch targets, note reordering, and specialized-workspace controls passed.
- Responsive/edge cases: no horizontal page overflow, short viewports, orientation changes, safe areas, enlarged settings text, empty search, loading, local persistence, and offline-oriented workflows passed.
- Lint: passed.
- Type checking: not configured; the repository is JavaScript and has no typecheck script or TypeScript project.
- Production build: passed. Vite continues to warn about chunks above 500 kB.
- Deployment validation: 7/7 checks passed.
- Diff hygiene: `git diff --check` passed.

### Remaining issues

- Several focused-workspace menus and detailed domain cards still use legacy one-off markup and palette utilities. They are visually subordinate after this pass, but not yet fully migrated to shared primitives.
- Project-board direct manipulation is pointer-oriented. Keyboard users can change a task's status through Edit, but there is no equally direct keyboard move command on the board.
- The production build still reports large application/rich-editor chunks. This pass did not turn a visual hierarchy task into a bundling/architecture rewrite.
- Actual browser zoom was not manually exercised; enlarged text and the full responsive matrix passed.
- Remote Supabase behavior was outside this local visual pass; existing local/offline and mocked collaboration coverage passed.

### Final quality assessment

| Area | Score | What prevents 9+ |
| --- | ---: | --- |
| Visual professionalism | 8.4/10 | Some deep structured-workspace cards and controls still expose the older visual vocabulary. |
| UX maturity | 8.3/10 | Bespoke focused-workspace menus and indirect keyboard Kanban movement remain. |
| Design-system consistency | 8.0/10 | Shared shell/header/metric/row patterns are coherent, but legacy workspace internals still contain one-off radii and palette utilities. |
| Engineering maturity | 8.4/10 | Strong automated coverage and persistence design; no static typecheck and large build chunks remain. |
| Accessibility | 8.8/10 | Broad axe, keyboard, touch, and mobile WebKit evidence; direct board movement parity is not exceptional. |
| Responsiveness | 8.8/10 | Strong 320–1920 px and orientation evidence; actual browser zoom was not tested. |
| Overall large-organization credibility | 8.4/10 | The core product now reads as mature software, but the remaining legacy workspace internals and bundle profile keep it below exceptional consistency. |
