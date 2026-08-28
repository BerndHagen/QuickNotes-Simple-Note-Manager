<p align="center">
  <img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-logo.png" alt="QuickNotes Logo" width="128" />
</p>

<h1 align="center">QuickNotes - Simple Note Manager</h1>

<p align="center">
  <b>A modern, local-first writing, planning, ink, and knowledge workspace.</b><br>
  <b>Organize documents, Paper notes, Canvas boards, daily work, and captured sources in one application.</b>
</p>

<p align="center">
  <a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/releases/latest"><img src="https://img.shields.io/github/v/release/BerndHagen/QuickNotes-Simple-Note-Manager?display_name=tag&sort=semver&style=flat-square&color=168966" alt="Latest stable release"></a>&nbsp;&nbsp;
  <a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" alt="License"></a>&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React Version">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite" alt="Vite Version">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Platform-Web-9f9f9f?style=flat-square" alt="Platform">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square" alt="Status">
</p>

**QuickNotes** is a browser-based note and knowledge workspace built with React, TipTap, and a purpose-built spatial editor. Its core editing, organization, search, backup, and recovery workflows run locally in IndexedDB. A configured Supabase backend adds authentication, cross-device synchronization, private resource storage, sharing, comments, mentions, and Realtime refresh.

Documents provide a paginated rich-text workbench. Paper provides real pages, ink, shapes, annotations, and page management. Canvas provides an effectively infinite spatial surface. Purpose-built workspaces cover tasks, projects, meetings, journals, brainstorming, shopping, and weekly planning without making each workspace feel like a separate application.

You can try QuickNotes [**here**](https://berndhagen.github.io/QuickNotes-Simple-Note-Manager/) — no account is required. A private local workspace keeps its data in the browser, while an account can synchronize supported data through a configured Supabase deployment.

## Key Features

- **Document Workspace:** Paginated TipTap/ProseMirror editing with headings, typography, colors, alignment, lists, tables, links, images, code blocks, callouts, checklists, document objects, rulers, indents, tab stops, page breaks, and PDF export
- **Paper Workspace:** Multi-page writing surface with A4, A5, Letter, and free sizing; white, warm, cream, and dark surfaces; blank, ruled, dot, square, and graph patterns; live page previews; page add, duplicate, reorder, and delete controls
- **Canvas Workspace:** Effectively infinite spatial workspace with pan and zoom, ink, shapes, text, sticky notes, index cards, images, note links, selection, z-order controls, and export
- **Natural Ink:** Pressure- and tilt-aware pen input, a broad translucent highlighter, whole-stroke erasing, low-latency in-progress rendering, high-DPI committed rendering, Ink Replay, and session undo/redo
- **Shapes and Annotations:** Lines, arrows, rectangles, and ellipses; ink-to-shape conversion; and non-destructive image/PDF annotation overlays that preserve the original attachment
- **Specialized Workspaces:** Dedicated Task List, Project Board, Meeting Workspace, Daily Journal, Idea Board, Shopping List, and Weekly Planner editors with suitable starter templates
- **Meeting Workflow:** Agenda planning, timers, participants, decisions, notes, action items, reminders, recording, transcript review, and source-linked navigation
- **Task Center:** One workspace-wide view for document checklists and structured tasks, including completion, recurrence, reminder integration, and return-to-source actions
- **Folders and Tags:** Nested folders, configurable icons and colors, tag management, favorites, pins, archive, Trash, and drag-and-drop organization
- **Knowledge System:** Stable internal note links, heading and spatial anchors, backlinks, hover previews, orphan handling, and precise return-to-source navigation
- **Fast Search:** Rebuildable owner-scoped lexical search across titles, content, headings, tags, structured fields, recognized text, and spatial objects
- **Smart Views:** Saved all/any filters for text, title, tag, folder, note type, favorites, pins, task state, reminders, and dates
- **Capture and Recognition:** Canonical image, PDF, and audio attachments; local image OCR; native PDF text extraction before OCR; browser handwriting and speech support where the platform provides it; reviewed corrections; and source-linked task creation
- **Audio and Transcripts:** Recording, playback, recoverable recording chunks, timestamped transcript segments, corrections, search navigation, and Meeting integration
- **Privacy Controls:** Recognition modes for Off, Local only, and External allowed, with fresh consent before browser-managed or external processing
- **Offline-First Persistence:** Atomic local writes through Dexie, durable outboxes, explicit saving/failure states, version checkpoints, migration gates, and multi-tab coordination
- **Backup and Recovery:** Bounded atomic `.qnotes` backup/restore, identity remapping, integrity validation, recovery versions, and reference-aware resource cleanup
- **Optional Cloud Sync:** Owner-scoped catalog, spatial, capture, annotation, resource, and correction synchronization without mixing unrelated content engines into one payload
- **Collaboration:** Note sharing, view/edit permissions, comments, mentions, revocation behavior, and explicit conflict review where changes cannot be merged safely
- **Data Safety:** Canonical notes, ink, images, PDFs, and audio remain authoritative; search, recognition, and other enrichments do not destructively replace original content
- **Version History:** View and restore previous document and structured-workspace versions with bounded retention
- **Import and Export:** Import Markdown, plain text, and HTML; export JSON, Markdown, text, HTML, document PDF, spatial image/PDF output, and complete `.qnotes` workspace backups
- **Themes and Accessibility:** Light, dark, and system themes; visible keyboard focus; named controls; reduced-motion support; responsive layouts; touch targets; and screen-reader status output
- **PWA Support:** Installable web application with versioned shell caching, update notification, deep-link restoration, and offline reload after the shell has been cached
- **Multilingual UI:** English, German, Spanish, French, Portuguese, Chinese, Hindi, Arabic, and Russian interface translations

Provider-backed generative AI, embeddings, semantic search, grounded Q&A, and imported-audio provider verification are intentionally deferred until a real provider is configured. Their boundaries remain capability-gated; QuickNotes does not display mock results or silently send content to an external service.

## Table of Contents

1. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Production Build](#production-build)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Backend — Supabase Integration](#backend--supabase-integration)
   - [Dual Mode](#dual-mode)
   - [Stub Fallback](#stub-fallback-offline-only-mode)
   - [Supabase Query Interface](#supabase-query-interface)
   - [Backend Functions](#backend-functions)
5. [Offline Storage & Sync](#offline-storage--sync)
   - [IndexedDB Schema](#indexeddb-schema-srclibdbjs)
   - [Sync Status Enum](#sync-status-enum)
   - [Sync Flow](#sync-flow)
6. [State Management](#state-management)
   - [useNotesStore](#usenotesstore-persisted)
   - [useThemeStore](#usethemestore-persisted)
   - [useUIStore](#useuistore-persisted)
7. [Rich Text Editor](#rich-text-editor)
   - [Custom TipTap Extensions](#custom-tiptap-extensions)
   - [Table Bubble Menu](#table-bubble-menu)
8. [Specialized Note Type Editors](#specialized-note-type-editors)
   - [Note Type Configuration](#note-type-configuration-notetypesjs)
   - [Paper and Canvas](#paper-and-canvas)
   - [Capture and Recognition](#capture-and-recognition)
9. [Internationalization (i18n)](#internationalization-i18n)
   - [Translation Keys Structure](#translation-keys-structure)
   - [Usage in Components](#usage-in-components)
   - [Time Formatting](#time-formatting)
10. [Theming](#theming)
    - [Custom CSS](#custom-css-indexcss)
11. [PWA & Service Worker](#pwa--service-worker)
    - [Service Worker](#service-worker-publicswjs)
    - [PWA Manifest](#pwa-manifest-publicmanifestjson)
    - [SPA Routing on GitHub Pages](#spa-routing-on-github-pages)
12. [Database Schema](#database-schema)
    - [Row Level Security](#row-level-security)
    - [Stored Procedures](#stored-procedures)
    - [Triggers](#triggers)
13. [GitHub Actions & Deployment](#github-actions--deployment)
    - [GitHub Pages Deployment](#github-pages-deployment)
14. [Environment Variables](#environment-variables)
    - [Setup](#setup)
    - [Production Auth Checklist](#production-auth-checklist)
15. [Dependencies](#dependencies)
    - [Runtime](#runtime)
    - [Dev](#dev)
16. [Build Instructions](#build-instructions)
    - [Development](#development)
    - [Production Build](#production-build-1)
    - [Linting](#linting)
    - [Testing](#testing)
17. [Contributing](#contributing)
    - [Areas for Contribution](#areas-for-contribution)
    - [Reporting Issues](#reporting-issues)
18. [License](#license)
19. [Screenshots](#screenshots)

## Getting Started

### Prerequisites

- Node.js 22 (the version used by CI; see `.nvmrc`)
- npm 10.9.4 (pinned in `package.json` for reproducible lockfiles)

### Installation

```bash
git clone https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager.git
cd QuickNotes-Simple-Note-Manager
npm ci
npm run dev
```

The development application is available at `http://localhost:5173`. No backend or environment variables are required for a private local workspace.

### Production Build

```bash
npm run build
npm run preview
```

The build output is written to `dist/`. Development uses `/`; production builds use `/QuickNotes-Simple-Note-Manager/` by default. Set `VITE_BASE_PATH` to another absolute URL path when deploying elsewhere:

```dotenv
VITE_BASE_PATH=/
```

## Project Structure

```text
QuickNotes-Simple-Note-Manager/
├── .env.example                       # Public browser configuration template
├── .github/workflows/                 # Deployment and release workflows
├── docs/                              # Public architecture, safety, setup, and release documentation
├── e2e/                               # Playwright production-browser tests
├── images/                            # Logo and current product screenshots
├── public/                            # PWA shell, icons, OCR assets, and service worker
├── scripts/                           # Deployment, release, benchmark, and screenshot tools
├── src/
│   ├── components/
│   │   ├── editors/                   # Specialized structured workspaces
│   │   ├── resources/                 # Attachments, recording, and transcripts
│   │   ├── spatial/                   # Paper, Canvas, ink, shapes, and annotation UI
│   │   ├── workspace/                 # Shared application shell and panes
│   │   └── ui/                        # Shared accessible UI primitives
│   ├── hooks/                         # Responsive and knowledge-index hooks
│   ├── lib/
│   │   ├── capture/                   # Dedicated capture cloud adapter and uploads
│   │   ├── collaboration/             # Collaboration cache and permissions
│   │   ├── intelligence/              # Recognition, jobs, privacy, and provenance
│   │   ├── knowledge/                 # Search, links, anchors, and indexes
│   │   ├── resources/                 # Attachment metadata, blobs, and integrity
│   │   └── spatial/                   # Geometry, commands, rendering, export, and sync
│   ├── store/                         # Zustand state and persistence coordination
│   └── styles/                        # Design tokens and shared styling
├── supabase/
│   ├── functions/                     # Authenticated Edge Function source
│   └── migrations/                    # Schema, RLS, Storage, Realtime, and lifecycle SQL
├── package.json                        # Dependencies and verification scripts
├── playwright.config.js               # Browser-test configuration
├── vite.config.js                     # Build and deployment configuration
└── vitest.config.js                    # Unit/integration-test configuration
```

## Architecture Overview

QuickNotes follows a **local-first, canonical-source** architecture:

```text
┌──────────────────────────────┐
│ React application shell      │
│ Document · Paper · Canvas    │
│ Structured work · Capture    │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│ Zustand visible state        │
│ Dexie canonical stores       │
│ Durable, bounded outboxes    │
└──────────────┬───────────────┘
               │ optional
┌──────────────▼───────────────┐
│ Supabase                     │
│ Auth · Postgres/RLS          │
│ Storage · Realtime           │
│ Authenticated Functions      │
└──────────────────────────────┘
```

1. **Canonical local writes complete first.** Notes, spatial objects, resources, annotations, and required outbox operations are committed atomically.
2. **Each content engine keeps its own contract.** Documents store sanitized HTML, structured editors store versioned `noteData`, and Paper/Canvas store per-record spatial documents, pages, and objects.
3. **Original sources stay authoritative.** Ink, images, PDFs, audio, and note content are not destructively replaced by recognition, search projections, or provider output.
4. **Search and knowledge rows are rebuildable.** Lexical search remains useful without semantic providers or derived indexes.
5. **Cloud adapters are separated by dependency.** Catalog, spatial, capture, and annotation synchronization do not share one giant payload.
6. **Conflicts remain visible.** Concurrent spatial graphs and other unsafe merges require review instead of silent last-writer data loss.

Detailed references are available in [`docs/document-paper-canvas-architecture.md`](docs/document-paper-canvas-architecture.md), [`docs/knowledge-system-architecture.md`](docs/knowledge-system-architecture.md), [`docs/intelligence-capture-architecture.md`](docs/intelligence-capture-architecture.md), and [`docs/sync-architecture.md`](docs/sync-architecture.md).

## Backend — Supabase Integration

`src/lib/backend.js` creates the optional Supabase client. Authentication uses PKCE, persistent browser sessions, and automatic token refresh. Cloud access is constrained by Row Level Security, Storage policies, validation triggers, restricted RPCs, and authenticated Edge Functions.

### Dual Mode

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Cloud** | `VITE_SUPABASE_URL` and a public publishable/anon key are valid | Authentication, synchronization, private resources, sharing, comments, mentions, and Realtime refresh are enabled |
| **Offline-only** | Browser environment variables are missing or invalid | Local editing, organization, search, capture, backup, restore, and export continue without an account |

### Stub Fallback (Offline-Only Mode)

The fallback exposes the same safe client boundary without pretending that remote work succeeded. Reads return empty data where appropriate; authentication, sharing, and other cloud-only mutations return an explicit backend-not-configured error. Local saves never depend on the stub.

### Supabase Query Interface

When configured, QuickNotes uses the standard Supabase client for authenticated queries and Realtime channels:

```javascript
backend.from('notes').select('*').eq('user_id', userId)
backend.from('notes').upsert(noteData).select()
backend.auth.signInWithPassword({ email, password })
backend.channel('workspace').on('postgres_changes', filter, callback).subscribe()
```

Dedicated adapters handle spatial rows, capture resources, recognition corrections, annotations, comments, and conflict-safe lifecycle operations.

### Backend Functions

| Boundary | Purpose |
|----------|---------|
| `backend.auth.*` | Sign up, sign in, sign out, session refresh, and password recovery |
| Catalog queries | Owner-scoped notes, folders, tags, templates, Smart Views, versions, and sharing metadata |
| Spatial adapter | Paper/Canvas descriptors, pages, objects, referenced images, and conflict baselines |
| Capture adapter | Private image/PDF/audio resources, note links, recognized rows, corrections, and resumable uploads |
| Annotation adapter | Non-destructive image/PDF overlay documents, pages, and spatial objects |
| Collaboration RPCs | Restricted shared-note edits, invitations, comments, mentions, leave, and revoke operations |
| `transcribe-audio` | Capability-gated external audio transcription; unavailable without a valid server-held provider secret |
| `ai-intelligence` | Preserved future provider boundary; unavailable while provider-backed AI is deferred |

## Offline Storage & Sync

### IndexedDB Schema (`src/lib/db.js`)

Dexie schema version 10 uses owner-scoped, purpose-specific stores:

| Store group | Purpose |
|-------------|---------|
| Catalog | Notes, folders, tags, versions, workspace snapshots, and the catalog sync queue |
| Spatial | Paper/Canvas documents, pages, objects, resources, and conflict/revision state |
| Knowledge | Search documents, knowledge links, and deterministic index state |
| Capture | Note-resource links, binary payloads, recording sessions/chunks, recognized content, jobs, settings, and capture sync state |
| Annotation | Attachment annotation documents, pages, objects, and per-annotation sync state |
| Derived intelligence | Optional semantic vectors and index state; removable and rebuildable without changing canonical content |

Database upgrades are additive. An older tab yields its IndexedDB connection and shows a non-dismissable reload gate before a newer schema can proceed, preventing continued editing against a closed connection.

### Sync Status Enum

```javascript
SyncStatus.SYNCED   // Synchronized with the configured backend
SyncStatus.PENDING  // Durable local operation is waiting for sync
SyncStatus.CONFLICT // Remote and local state require explicit review
SyncStatus.ERROR    // A retryable or actionable synchronization failure occurred
```

### Sync Flow

1. A user action commits canonical local state and its required outbox operation.
2. The UI reports the real persistence result; it never reports an optimistic save before the write completes.
3. Signed-in online work drains bounded queues in dependency order.
4. Uploads write immutable bytes before metadata; deletes remove dependents before collecting an unreferenced source.
5. Pulls validate ownership, shape, size, versions, references, and source fingerprints before adopting data.
6. Failed work remains durable and retryable across reloads, reconnects, and account switches.
7. Realtime events trigger scoped refreshes; they are not trusted as canonical payloads by themselves.

See [`docs/storage-schema.md`](docs/storage-schema.md), [`docs/sync-behavior.md`](docs/sync-behavior.md), and [`docs/backup-restore.md`](docs/backup-restore.md) for the complete persistence contract.

## State Management

### `useNotesStore` (persisted)

Owns the visible workspace catalog, selection, organization, note lifecycle, persistence coordination, synchronization state, conflicts, and actions that bridge editors to canonical repositories.

### `useThemeStore` (persisted)

Stores `light`, `dark`, or `system`, follows operating-system changes in system mode, and applies the active theme through shared design tokens.

### `useUIStore` (persisted)

Owns shell layout, pane visibility and sizing, list/grid preferences, modal state, shortcuts, notification preferences, Trash retention, and other UI settings. Canonical editor payloads do not live in this store.

## Rich Text Editor

Standard Document notes use TipTap/ProseMirror with sanitized HTML as canonical content. The ribbon is organized across Home, Insert, Layout, Review, and View, with contextual controls where permanent controls would add clutter.

Features include typography, headings, line and paragraph spacing, colors, highlights, alignment, nested lists, styled checklists, links, images, tables, code blocks, callouts, slash commands, text boxes, 46 categorized SVG shapes, document outline, find/replace, statistics, spell checking, accessibility review, rulers, indents, tab stops, page-width modes, paper styles, manual page breaks, and paginated PDF export.

### Custom TipTap Extensions

| Extension | Purpose |
|-----------|---------|
| Pagination and Page Break | Visible A4 page flow and durable `Ctrl/Cmd+Enter` boundaries |
| Paragraph Layout and Tab Stop | Persistent margins, indents, spacing, ruler controls, and tab advances |
| Styled Task Item | Selectable checkbox shape, color, size, and completion treatment |
| Resizable Image | Embedded images with bounded resize handles |
| Shape and Text Box | Movable, resizable document objects with wrap and style controls |
| Heading Anchor | Stable heading identities for internal links and precise navigation |
| Invisible Characters | Optional formatting-mark visualization |
| Custom Table Cell/Header | Cell background and header behavior used by table tools |

### Table Bubble Menu

The contextual table menu adds and removes rows or columns, merges and splits cells, toggles header rows or columns, changes cell backgrounds, and deletes the table without permanently occupying ribbon space.

## Specialized Note Type Editors

QuickNotes routes each note through an explicit versioned `contentKind`: `document`, `structured`, `paper`, or `canvas`. `noteType` remains the visible subtype and compatibility routing key.

| Workspace | Purpose |
|-----------|---------|
| **Document** | Paginated rich writing and review |
| **Paper** | Page-oriented handwriting, drawing, shapes, and mixed spatial objects |
| **Canvas** | Infinite planning, mapping, drawing, and linked spatial objects |
| **Task List** | Prioritized tasks, recurrence, dates, details, and completion history |
| **Project Board** | Kanban columns, project metadata, milestones, and task movement |
| **Meeting Workspace** | Agenda, timing, notes, decisions, recording/transcripts, actions, and reminders |
| **Daily Journal** | Date-safe daily entries, reflection, mood, and prompts |
| **Idea Board** | Categorized ideas, voting, filtering, and creative starters |
| **Shopping List** | Categories, quantities, completion, and reusable shopping flows |
| **Weekly Planner** | Day-by-day planning with weekly priorities and review |

### Note Type Configuration (`noteTypes.js`)

`src/components/editors/noteTypes.js` defines stable type IDs, labels, icons, categories, default data, starter templates, normalization, and creator behavior. Stable IDs are generated for user content; array indexes are not persisted as identity.

### Paper and Canvas

Paper and Canvas share geometry, brushes, pointer handling, commands, selection, history, serialization, rendering, image resources, note links, export, accessibility behavior, and conflict-safe cloud boundaries. Paper persists page-local coordinates and page settings. Canvas persists unrestricted world coordinates and its last viewport. Pointer movement draws through refs and Canvas 2D without writing React state or IndexedDB for each sample; one completed gesture becomes one command and one durable save.

### Capture and Recognition

Attachments remain canonical resources independent of recognition. Local Tesseract OCR handles printed images, PDF.js extracts native text before optional page OCR, and supported browser APIs may provide handwriting or live speech recognition. Results keep provider/model, processing location, source fingerprint, region or timestamp, correction ownership, and current/stale/superseded state. Correcting text does not erase machine output.

## Internationalization (i18n)

QuickNotes includes English, German, Spanish, French, Portuguese, Chinese, Hindi, Arabic, and Russian interface translations. English fallback text remains available when a newer key has not yet been translated.

### Translation Keys Structure

Translations in `src/lib/i18n.js` are grouped by application areas such as authentication, sidebar, notes, editor, settings, sharing, folders, tags, export, import, reminders, and validation.

### Usage in Components

```javascript
const { t } = useTranslation()
t('notes.createNew', 'New note')
```

### Time Formatting

Dates and relative times use the active locale where supported. Stored timestamps remain ISO values so presentation changes do not rewrite canonical records.

## Theming

QuickNotes supports Light, Dark, and System modes. The shared design system keeps continuous dark-forest application chrome, deep-green navigation, neutral professional controls, and warm content surfaces instead of recoloring every workspace as an unrelated mini-application.

### Custom CSS (`index.css`)

`src/styles/tokens.css`, `src/index.css`, and `src/spatial.css` define semantic colors, typography, spacing, focus rings, restrained radii, responsive breakpoints, page patterns, canvas layers, and reduced-motion behavior. Components consume semantic tokens rather than arbitrary per-screen pastel themes.

## PWA & Service Worker

### Service Worker (`public/sw.js`)

The versioned service worker caches the built application shell, removes obsolete caches during activation, preserves navigation fallback behavior, and reports when an updated build is ready. A first-ever visit still requires a connection; offline reload works after the shell has been cached.

### PWA Manifest (`public/manifest.json`)

The manifest defines QuickNotes as an installable standalone application with product icons, theme/background colors, and the repository deployment start URL.

### SPA Routing on GitHub Pages

`public/404.html` and `public/app-shell.js` preserve deep links on GitHub Pages. The production base path is validated during the build so malformed or relative deployment paths fail early.

## Database Schema

Supabase migrations in `supabase/migrations/` define the cloud contract for catalog records, sharing, spatial content, capture resources, recognition, annotations, comments, mentions, lifecycle cleanup, and provider rate limits. Apply them in filename order to a new deployment.

### Row Level Security

RLS is enabled on user-data tables. Owner policies isolate private rows, sharing policies expose only authorized note data, collaborator spatial/capture graphs remain read-only where same-object editing is not safely supported, and private quota tables are reserved for the service role. Storage objects use owner-scoped paths and private-bucket policies.

### Stored Procedures

Restricted RPCs handle operations that cannot be safely expressed as direct browser writes, including collaboration updates, comment/mention boundaries, Trash cleanup, account deletion, and reference-aware lifecycle work. Grants are limited to the roles that need each operation.

### Triggers

Validation and identity-hardening triggers reject mismatched owners, note/resource references, oversized payloads, invalid future schema versions, and unauthorized relationship changes. Cleanup guards retain a resource while any note link, spatial placement, annotation, or recognition provenance still references it.

The public security and storage model is documented in [`docs/security-model.md`](docs/security-model.md) and [`docs/storage-schema.md`](docs/storage-schema.md).

## GitHub Actions & Deployment

### GitHub Pages Deployment

The deployment workflow installs pinned dependencies, runs release checks, builds the production application, publishes the artifact to GitHub Pages, and validates critical live behavior. Stable release notes are curated in `docs/releases/` and validated separately from generated commit history.

For another host, configure `VITE_BASE_PATH`, serve `dist/`, preserve SPA fallback routing, use HTTPS for PWA/microphone features, and configure response security headers where the platform permits them.

## Environment Variables

### Setup

Copy `.env.example` to `.env.local` and add only public browser configuration for your own project:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
VITE_BASE_PATH=/
```

`VITE_SUPABASE_ANON_KEY` remains supported for legacy projects. Never place a `service_role` key, OpenAI key, password, test-account credential, or another private secret in a `VITE_` variable or tracked file. Provider credentials belong only in server-held Edge Function secrets.

### Production Auth Checklist

1. Apply every migration in `supabase/migrations/`.
2. Configure the application URL and allowed redirect URLs in Supabase Auth.
3. Use a browser-safe publishable/anon key only.
4. Deploy only the Edge Functions required by the capabilities you operate.
5. Store provider credentials as server-held secrets, never client variables.
6. Verify RLS, Storage policies, grants, Realtime publication, and function JWT enforcement against the actual project.
7. Run `npm run test:deployment` against the final production base path.

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| React 18 | Application UI |
| TipTap / ProseMirror | Document editing and extensions |
| Zustand | Visible application and UI state |
| Dexie | IndexedDB persistence and migrations |
| Supabase JS | Optional Auth, Postgres, Storage, and Realtime client |
| MiniSearch | Local lexical search |
| Tesseract.js | Local printed-image OCR |
| PDF.js | Local native PDF text extraction and rendering |
| jsPDF / html2canvas | Document and spatial export |
| DOMPurify | Rich HTML sanitization |
| tus-js-client | Resumable private resource uploads |
| DnD Kit | Accessible drag-and-drop organization |
| Lucide React | Shared iconography |
| React Hot Toast | Status and action feedback |

### Dev

| Package | Purpose |
|---------|---------|
| Vite 8 | Development server and production build |
| Vitest 4 | Unit and integration tests |
| Playwright | Production-browser, responsive, offline, and recovery tests |
| axe-core Playwright | Automated accessibility checks |
| Testing Library | Component behavior tests |
| ESLint 9 | Static analysis |
| Tailwind CSS 3 / PostCSS | Utility styles and CSS build processing |

Exact versions are recorded in `package.json` and `package-lock.json`.

## Build Instructions

### Development

```bash
npm ci
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

### Linting

```bash
npm run lint
```

### Testing

```bash
npm test
npm run test:e2e
npm run test:deployment
npm run validate:release-notes
npm audit --omit=dev
```

Additional focused commands:

```bash
npm run test:watch
npm run benchmark:search
npm run screenshots:update
```

Release checks cover migration and backup safety, malformed data, synchronization failures and conflicts, account isolation, multi-tab coordination, Paper/Canvas rendering, capture workflows, resource cleanup, responsive layouts, accessibility, service-worker behavior, and offline recovery. Current boundaries are recorded in [`docs/known-limitations.md`](docs/known-limitations.md) and [`docs/release-readiness.md`](docs/release-readiness.md).

## Contributing

Bug reports, focused fixes, tests, documentation improvements, and carefully scoped accessibility or compatibility work are welcome. Keep changes consistent with the architecture, preserve local-only behavior, and do not introduce controls for capabilities that are not genuinely available.

### Areas for Contribution

- Browser and physical-device compatibility evidence
- Accessibility improvements and assistive-technology testing
- Data-safety, migration, backup, recovery, and synchronization tests
- Performance work for large note, ink, attachment, and search libraries
- Translation corrections and completeness
- Clear public setup and architecture documentation

### Reporting Issues

Use [GitHub Issues](https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/issues) and include reproduction steps, expected behavior, actual behavior, browser/OS details, and the smallest safe sample needed. Remove note content, tokens, email addresses, credentials, and private URLs from logs or screenshots before posting.

## License

QuickNotes is distributed under the [GNU General Public License v3.0](LICENSE).

## Screenshots

If you'd like a preview of QuickNotes before using it, the screenshots below show the application's main workspaces and workflows. Note that future updates may introduce additional functionality.

<table>
  <tr>
    <th>QuickNotes - Document Workspace</th>
    <th>QuickNotes - Paper Workspace</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-document.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-document.png" alt="QuickNotes Document Workspace" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-paper.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-paper.png" alt="QuickNotes Paper Workspace" width="450"></a></td>
  </tr>
  <tr>
    <th>QuickNotes - Canvas Workspace</th>
    <th>QuickNotes - Meeting Workspace</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-canvas.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-canvas.png" alt="QuickNotes Canvas Workspace" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-meeting.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-meeting.png" alt="QuickNotes Meeting Workspace" width="450"></a></td>
  </tr>
  <tr>
    <th>QuickNotes - Global Search</th>
    <th>QuickNotes - Task Center</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-search.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-search.png" alt="QuickNotes Global Search" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-tasks.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-3-tasks.png" alt="QuickNotes Task Center" width="450"></a></td>
  </tr>
</table>
