# QuickNotes design system

This document records the practical UI rules for the current QuickNotes shell. The source of truth for values is `src/styles/tokens.css`; Tailwind aliases live in `tailwind.config.js`, and shared controls live in `src/components/ui`.

## Identity and hierarchy

QuickNotes is a professional notebook and knowledge workspace. Its visual hierarchy is:

1. Continuous dark-forest application chrome for identity and global actions.
2. Deep-green navigation for product-level destinations.
3. Neutral collection, inspector, ribbon, dialog, and other utility surfaces.
4. Warm or user-selected paper inside a subdued workbench.

Green identifies the application and important interaction states. It is not a decorative wash for every panel. Authentication may retain a restrained stationery texture; the working shell stays flat.

## Color roles and themes

- `--qn-banner-*`: the 48px application bar, including its text, border, and hover states.
- `--qn-nav-*`: the navigation rail and its selected/hovered rows.
- `--qn-surface-*`: app, panel, base, raised, workbench, toolbar, window, and sunken layers.
- `--qn-text*`: primary, muted, subtle, inverted, and on-brand text.
- `--qn-accent*`: selection, focus, active tabs, links, and primary interaction feedback.
- `--qn-danger`, `--qn-warning`, `--qn-success`, `--qn-info`: semantic state only; do not use these to decorate categories.
- `--qn-border*`: the main method for separating in-flow panes and work areas.

Dark mode keeps the top chrome and navigation deep green. Utility surfaces become neutral charcoal, and paper styles choose their own readable foreground. Never infer readable text from the global theme when a paper style supplies explicit colors.

## Typography, spacing, and controls

The UI uses the existing sans-serif type scale and semantic Tailwind aliases (`text-ui-*`, `text-title-*`). Document typography belongs to the editor and may be customized independently. Prefer weight, size, and separators over colored containers to establish hierarchy.

Use the existing spacing scale and keep desktop layouts dense. Standard controls are 30–36px high; touch layouts use the 44px `--qn-touch-target`. Lucide icons are the default icon language and should use the semantic icon sizes. Icon-only controls require an accessible label and tooltip/title behavior where the shared primitive provides it.

## Radius and elevation

- Ordinary controls: 6px (`--qn-radius-control`).
- Contained product objects: 8px (`--qn-radius-card`) when a border is not enough.
- Dialogs and application windows: 12px (`--qn-radius-dialog`).
- Collection rows and in-flow panes: square edges.
- Pills are reserved for tags, compact status, and values that are genuinely capsule-shaped.

Use elevation for menus, popovers, dialogs, and the physical edge of paper. Do not shadow every pane or list row. The workbench-to-paper shadow is intentionally restrained.

## Application shell and panels

The desktop shell is one continuous frame:

`top chrome` above `navigation | collection | workspace | optional inspector`

- Navigation is 264px when docked, persists its desktop collapsed state, and becomes a closed-by-default drawer below 1200px.
- The collection pane is keyboard- and pointer-resizable from 280–420px. Its width and visibility persist.
- The inspector is available from 1440px, optional, reusable, and resizable from 260–380px. It exposes real properties, outline navigation, and backlinks.
- Separators use borders plus a narrow, visible-on-focus resize affordance. A separator must expose its value and support arrows, Home, and End.
- Focus mode removes navigation, collection, and inspector while retaining a compact green header and real editor commands.

At 768–1199px, keep collection and workspace in flow and use the navigation drawer. Below 768px, show one primary pane at a time and retain the existing browser-history behavior. The desktop top chrome is hidden on compact layouts so it does not duplicate mobile note chrome.

## Workspace grammar

Every note type stays inside the same shell. A workspace consists of:

1. A compact type cue and editable title.
2. Optional summary or metadata directly related to the current content.
3. A flat tab/command row when the mode needs multiple views.
4. A neutral workbench holding the mode's real content objects.
5. The shared bottom status and sharing area.

Document, task list, project board, meeting, journal, idea board, shopping list, and weekly planner may use different content structures, but must not introduce their own product chrome, unrelated palette, or decorative dashboard.

## Ribbon behavior

The application bar owns the green brand identity. On desktop, the editor note bar is a neutral workspace header and the existing ribbon remains a flat, horizontally reachable command surface. Commands stay grouped under Home, Insert, Layout, Review, and View; groups may become contextual or hide at narrow editor widths, but working commands must remain reachable. On mobile, formatting may collapse behind the existing toggle and the compact note header may remain green.

## Document, paper, and canvas boundaries

`PaperSurface` in `src/components/workspace/WorkspaceSurface.jsx` is the reusable content wrapper used by the rich-text editor. Paper color, rules, grid, margins, and foreground remain driven by the existing paper-style model. Paper sits within `--qn-surface-workbench` and is the main place where a subtle physical edge is appropriate.

Paper and Canvas use their shared spatial editor boundary and canonical workbench styling. They retain purpose-built page and infinite-world behavior while using the same application chrome, typography, controls, focus treatment, and status language as Document.

## Dialogs, search, and accessibility

Global search remains available from the top chrome and `Ctrl/Cmd+K`; collection search remains scoped to the visible list. Dialogs use the shared modal shell, neutral header/body/footer surfaces, focus trapping, Escape handling, scroll locking, and focus restoration.

Requirements for every change:

- Preserve a visible 2px focus indicator and logical keyboard order.
- Maintain accessible names, roles, selected/expanded state, and 44px touch targets on mobile.
- Do not require hover for essential touch actions.
- Check light and dark contrast, including user-selectable paper styles.
- Avoid document-level horizontal scrolling at supported widths.
- Respect reduced motion through existing motion utilities and keep transitions short.

## Validation

For shell or workspace changes, inspect 1920×1080, 1440×900, 1366×768, the 1024px tablet range, and supported phone widths. Exercise light and dark mode, editor ribbons, structured workspaces, the optional inspector, focus mode, drawers, dialogs, and pane persistence. Run lint, unit tests, the production build, Chromium end-to-end coverage, and mobile WebKit coverage before changing these rules.
