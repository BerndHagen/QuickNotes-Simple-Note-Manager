<p align="center">
  <img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/quicknotes-logo.png" alt="QuickNotes Logo" width="128" />
</p>

<h1 align="center">QuickNotes - Simple Note Manager</h1>

<p align="center">
  <b>A modern, feature-rich note-taking application with cloud sync, offline support, and a powerful rich text editor.</b><br>
  <b>Organize your thoughts with folders, tags, and purpose-built note workspaces.</b>
</p>

<p align="center">
  <a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" alt="License"></a>&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React Version">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite" alt="Vite Version">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Platform-Web-9f9f9f?style=flat-square" alt="Platform">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square" alt="Status">
</p>

**QuickNotes** is a browser-based writing and note workspace built with React and TipTap. It works fully offline using IndexedDB and can optionally sync to a cloud backend. Standard notes use a paginated A4 document editor, while purpose-built workspaces cover tasks, project planning, meetings, journals, brainstorming, shopping, and weekly planning.

You can try QuickNotes [**here**](https://berndhagen.github.io/QuickNotes-Simple-Note-Manager/) — no account required. A local workspace keeps everything in your own browser, or you can sign up to sync and share notes across devices.

## Key Features

- **Rich Text Editor:** Full WYSIWYG editor powered by TipTap with headings, bold, italic, underline, strikethrough, text alignment, font colors, highlights, and more
- **Code Blocks:** Syntax highlighting for many programming languages via Lowlight
- **Tables:** Insert and edit tables with a bubble menu for row/column operations, cell merging, header toggling, and cell background colors
- **Task Lists:** Interactive, nestable checklists with per-item shape, colour, size, completion treatment, add/remove-item actions, and persistent defaults for new lists
- **Image Support:** Upload and embed resizable images directly in notes with drag handles
- **Document Objects:** Draw five common SVG shapes directly from the ribbon or open a dense Word-style gallery of 46 categorized shapes, then move, resize from eight handles, rotate, flip, wrap, recolor, and size them precisely
- **Professional Editor Ribbon:** A flat, familiar command row across Home, Insert, Layout, Review, and View. Home begins with font family, size, line height, styles, colour, alignment, and lists; compact separators replace boxed groups, and no tab exists for only a handful of disconnected commands
- **Structured Writing:** Searchable slash commands, semantic callouts, local date/time insertion, and a contextual checklist editor keep advanced blocks discoverable without crowding every tab
- **Paragraph Layout:** Repeatable multilevel indentation, before/after spacing, a horizontal and vertical full-page ruler with shaded margin areas, a top-left tab selector, first-line/left/right indents, plus left, centre, right, and decimal tab stops that the Tab key follows
- **A4 Document Pages:** Standard notes render as complete A4 sheets. Content automatically flows onto additional visible pages, `Ctrl/Cmd+Enter` inserts a durable manual page break, and PDF export follows those boundaries without adding blank pages
- **Review & View Tools:** Find and replace, browser spell checking, translation, document statistics, an accessibility checker with issue navigation, document outline, formatting marks, ruler, width controls, and focus mode
- **Document Workbench:** A centred A4 writing surface with focused, standard, wide, and full-width modes separates the document from application chrome
- **Persistent Paper:** Plain, ruled, grid, dotted, sepia, blueprint, and dark paper choices are saved with each note and carried into PDF exports
- **Folders & Tags:** Organize notes into folders and assign color-coded tags via the Tag Manager
- **Favorites & Pins:** Star or pin important notes for quick access
- **Global Search:** Full-text search across all notes by title, content, and tags
- **Find & Replace:** In-editor find and replace with regex support
- **Quick Note:** Capture ideas instantly with a floating modal
- **Focused Note Types:** A unified creator with useful starters for documents, task lists, project boards, meetings, journals, idea boards, shopping lists, and weekly plans
- **Specialized Workspaces:** Dedicated, structured editors whose controls, data, statistics, and exports match each note type
- **Version History:** View and restore previous document or structured-workspace versions (up to 30 versions per note)
- **Duplicate Detection:** Automatically find similar or duplicate notes
- **Focus Mode:** Distraction-free writing experience
- **Dark / Light / System Theme:** Three theme modes with automatic system preference detection
- **Drag & Drop Sorting:** Reorder notes via drag and drop using @dnd-kit
- **Export & Import:** Download notes as JSON, Markdown, plain text, HTML, or a self-contained paginated A4 PDF that preserves paper, rich formatting, and manual page breaks; import Markdown, plain-text, and HTML files
- **Reminders:** Set one-time, daily, weekly, or monthly reminders
- **Note Sharing:** Share notes with other users via invite links (requires backend)
- **Real-Time Collaboration:** Live updates on shared notes via realtime subscriptions (requires backend)
- **Voice Input:** Dictate notes using the Web Speech API
- **Translation:** Translate note content between multiple languages
- **HTML Editor:** Direct HTML editing for advanced formatting
- **Offline-First:** All data stored locally in IndexedDB via Dexie; works without internet
- **Cloud Sync:** Optional backend sync with automatic conflict resolution and sync queue
- **PWA Support:** Installable as a Progressive Web App with service worker caching
- **Multilingual UI:** Interface available in English, German, Spanish, French, Portuguese, Chinese, Hindi, Arabic, and Russian
- **Mobile Responsive:** Responsive layout with mobile-specific views, touch-friendly targets, and safe area support

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

The application will be available at `http://localhost:5173`. No backend or environment variables are required for local development — QuickNotes runs in offline-only mode by default.

### Production Build

```bash
npm run build
npm run preview
```

The build output is written to `dist/`. Development uses `/`; production builds use
`/QuickNotes-Simple-Note-Manager/` by default. Set `VITE_BASE_PATH` to deploy the
same build configuration at another absolute path. For example, a custom-domain
deployment can use this `.env.production` entry:

```dotenv
VITE_BASE_PATH=/
```

## Project Structure

```
QuickNotes-Simple-Note-Manager/
├── .env.example                          # Supabase environment variable template
├── .github/
│   └── workflows/
│       └── deploy.yml                    # GitHub Actions: build + publish to Pages
├── index.html                            # HTML entry point
├── package.json                          # Dependencies and scripts
├── postcss.config.js                     # PostCSS configuration (Tailwind)
├── tailwind.config.js                    # Tailwind CSS configuration
├── vite.config.js                        # Vite build configuration
├── vitest.config.js                      # Unit test configuration
├── playwright.config.js                  # Browser test configuration
├── eslint.config.js                      # ESLint flat config
│
├── e2e/                                  # Playwright browser tests
│   ├── helpers.js                        # Shared sign-in, viewport, and error helpers
│   ├── accessibility.spec.js             # axe-core WCAG checks
│   ├── responsive.spec.js                # 320px–1920px layout checks
│   ├── workspace.spec.js                 # Core workspace flows
│   └── note-types.spec.js                # Specialized workspace flows
│
├── supabase/
│   └── migrations/                       # SQL migrations: schema, RLS, RPCs, constraints
│
├── public/
│   ├── 404.html                          # SPA fallback for GitHub Pages
│   ├── app-shell.js                      # Route restoration + service-worker registration
│   ├── manifest.json                     # PWA manifest
│   ├── sw.js                             # Service worker for offline caching
│   └── icons/                            # PWA icons
│
├── scripts/
│   └── validate-deployment.mjs            # Built PWA, deep-link, and offline checks
│
└── src/
    ├── App.jsx                           # Root application component
    ├── main.jsx                          # React entry point
    ├── index.css                         # Global CSS (Tailwind + custom styles)
    │
    ├── styles/
    │   └── tokens.css                    # Design tokens (colour, type, spacing, motion)
    │
    ├── hooks/
    │   └── useBreakpoint.js              # compact / medium / wide layout modes
    │
    ├── test/
    │   └── setup.js                      # Vitest environment setup
    │
    ├── components/
    │   ├── index.js                      # Barrel exports for all components
    │   │
    │   ├── NoteEditor.jsx                # Main note editing view with toolbar
    │   ├── RichTextEditor.jsx            # TipTap editor wrapper with all extensions
    │   ├── NotesList.jsx                 # Note list panel (list view)
    │   ├── NoteCard.jsx                  # Single row in the note list
    │   ├── NotesGrid.jsx                 # Note grid panel (grid view)
    │   ├── Sidebar.jsx                   # Navigation sidebar with folders & tags
    │   ├── AuthScreen.jsx                # Login / signup screen
    │   ├── PasswordRecoveryScreen.jsx    # Password reset completion screen
    │   ├── ThemeProvider.jsx             # Dark / Light / System theme provider
    │   ├── ErrorBoundary.jsx             # Top-level render error boundary
    │   ├── SyncStatus.jsx                # Sync state indicator + manual sync trigger
    │   │
    │   ├── SettingsModal.jsx             # Application settings modal
    │   ├── EditorSettingsModal.jsx       # Editor-specific settings (font, spacing)
    │   ├── NoteTypesModal.jsx            # Unified note type + starter selector
    │   ├── FolderDialogs.jsx             # Folder create/edit dialog + confirmations
    │   ├── ExportModal.jsx               # Export notes (JSON / Markdown / text / HTML / PDF)
    │   ├── ImportModal.jsx               # Import Markdown, plain-text, and HTML files
    │   ├── GlobalSearchModal.jsx         # Full-text search modal (Ctrl+K)
    │   ├── FindReplaceBar.jsx            # In-editor find & replace bar
    │   ├── QuickNoteModal.jsx            # Quick note capture modal (Ctrl+N)
    │   ├── FocusMode.jsx                 # Distraction-free writing mode
    │   ├── ShareNoteModal.jsx            # Note sharing dialog
    │   ├── SharedNotesView.jsx           # View of received shared notes
    │   ├── ReminderModal.jsx             # Note reminder setting
    │   ├── VersionHistoryModal.jsx       # Note version history viewer
    │   ├── DuplicateDetectionModal.jsx   # Duplicate note finder
    │   ├── TrashView.jsx                 # Trash management view
    │   ├── ArchiveView.jsx               # Archive view
    │   ├── TagManagerModal.jsx           # Tag creation and management
    │   ├── TranslateModal.jsx            # Note translation between languages
    │   ├── HTMLEditorModal.jsx           # Direct HTML source editor
    │   ├── HelpModal.jsx                 # FAQ / help modal
    │   ├── PrivacyModal.jsx              # Privacy policy
    │   ├── TermsModal.jsx                # Terms of service
    │   ├── KeyboardShortcutsModal.jsx    # Keyboard shortcut customization
    │   ├── SortDropdown.jsx              # Note sort options + sort logic
    │   ├── VoiceInput.jsx                # Voice input via Web Speech API
    │   ├── NoteStatistics.jsx            # Word/character count display
    │   ├── ImageUploadModal.jsx          # Image upload dialog
    │   ├── LinkInsertModal.jsx           # Link insertion dialog
    │   ├── NoteLinkPopover.jsx           # Internal note link popover
    │   ├── NotePreviewPopover.jsx        # Note preview on hover
    │   ├── TableBubbleMenu.jsx           # Table editing bubble menu
    │   ├── ResizableImage.jsx            # Resizable image component
    │   ├── ResizableImageExtension.js    # TipTap extension for resizable images
    │   ├── TextBoxExtension.js           # TipTap extension: movable text box
    │   ├── TextBoxView.jsx               # Text box node view (drag, resize, wrap)
    │   ├── ParagraphLayoutExtension.js    # Persistent ruler, indents, and tab stops
    │   ├── TabStopExtension.js            # Durable inline tab advances
    │   ├── PageBreakExtension.js           # Durable Ctrl/Cmd+Enter page boundaries
    │   ├── PaginationExtension.js          # Automatic visual A4 page flow
    │   ├── StyledTaskItem.js              # Selectable checkbox appearances
    │   ├── CustomTableCell.js            # TipTap extension: custom table cell
    │   └── CustomTableHeader.js          # TipTap extension: custom table header
    │
    │   └── ui/                           # Shared primitives used across the app
    │       ├── index.jsx                 # Barrel exports
    │       ├── Modal.jsx                 # Dialog shell (focus trap, Escape, scroll lock)
    │       ├── LegacyDialog.jsx          # Overlay wrapper for bespoke dialog panels
    │       ├── Menu.jsx                  # Anchored, portal-rendered dropdown
    │       ├── Button.jsx                # Button + IconButton
    │       ├── Field.jsx                 # Label / control / hint + error wiring
    │       ├── Badge.jsx                 # Count badges and tag pills
    │       ├── Avatar.jsx                # Avatar with initials fallback
    │       ├── EmptyState.jsx            # Empty and zero-result states
    │       ├── Spinner.jsx               # Loading indicator
    │       └── useFocusTrap.js           # Focus trap, scroll lock, Escape hooks
    │
    │   └── editors/                      # Specialized note type editors
    │       ├── index.js                  # Editor registry + barrel exports
    │       ├── noteTypes.js              # Configs, starters, defaults, and legacy normalization
    │       ├── FocusedNoteTitle.jsx      # Shared editable workspace hero title
    │       ├── BrainstormEditor.jsx      # Brainstorming with idea cards + voting
    │       ├── JournalEditor.jsx         # Daily journal with mood tracking
    │       ├── MeetingNotesEditor.jsx    # Meeting notes with agenda + action items
    │       ├── ProjectPlannerEditor.jsx  # Project planning with kanban columns
    │       ├── ShoppingListEditor.jsx    # Shopping list with categories
    │       ├── TodoListEditor.jsx        # To-do list with priorities + deadlines
    │       └── WeeklyPlannerEditor.jsx   # Weekly planner with day-by-day layout
    │
    ├── lib/
    │   ├── backend.js                    # Supabase backend with offline stub fallback
    │   ├── db.js                         # IndexedDB via Dexie (offline storage)
    │   ├── i18n.js                       # Translations for 9 languages (4000+ lines)
    │   ├── localSession.js               # Durable local-workspace session state
    │   ├── authValidation.js             # Email and password policy checks
    │   ├── dataValidation.js             # Title, folder, and tag limits (match the DB)
    │   ├── sanitizeHtml.js               # DOMPurify profile for untrusted note HTML
    │   ├── filterNotes.js                # Shared search / scope / tag filtering
    │   ├── folderIcons.js                # Folder icon set and colour palette
    │   ├── shortcuts.js                  # Shortcut registry + user bindings
    │   ├── reminders.js                  # One-time and repeating reminder scheduling
    │   ├── syncReconciliation.js         # Local/cloud id reconciliation for sync
    │   ├── useCollaboration.js           # Real-time collaboration hooks
    │   ├── useTranslation.js             # Translation hook for components
    │   └── utils.js                      # Utility functions (dates, slugify, etc.)
    │
    └── store/
        └── index.js                      # Zustand stores (useNotesStore, useUIStore, useThemeStore)
```

## Architecture Overview

QuickNotes follows an **offline-first** architecture:

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│    React UI      │ ───▶ │  Zustand Store   │ ───▶ │ IndexedDB (Dexie)│
│   (Components)   │ ◀─── │   (State Mgmt)   │ ◀─── │ (Local Storage)  │
└──────────────────┘      └────────┬─────────┘      └──────────────────┘
                                   │
                          ┌────────▼─────────┐
                          │  Backend Layer   │  (Optional)
                          │  (backend.js)    │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  Cloud Database  │  (e.g. Supabase)
                          └──────────────────┘
```

1. **All data is written to IndexedDB first** via Dexie, ensuring immediate persistence regardless of network status
2. **Changes are queued** in a `syncQueue` table with the operation type (`insert`, `update`, `delete`)
3. **When online**, the sync engine processes the queue and reconciles with the remote backend
4. **Conflict resolution** uses timestamp comparison with a 2-second buffer to determine which version wins
5. **The backend layer is a stub** by default — the app functions fully without any backend configured

## Backend — Supabase Integration

The file `src/lib/backend.js` provides the backend layer using **Supabase** (`@supabase/supabase-js`). It uses a PKCE auth flow with auto-refresh tokens and persistent sessions.

### Dual Mode

The backend operates in two modes depending on whether `VITE_SUPABASE_URL` and either
`VITE_SUPABASE_PUBLISHABLE_KEY` (preferred) or the legacy
`VITE_SUPABASE_ANON_KEY` are configured:

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Cloud** | URL and a public key are set | Full Supabase client with auth, realtime, cloud sync |
| **Offline-only** | Env vars missing or invalid | Stub backend — app works fully offline without auth or sync |

### Stub Fallback (Offline-Only Mode)

When Supabase is not configured, all backend methods return safe no-op results:

| Method | Stub Return |
|--------|-------------|
| `backend.auth.getSession()` | `{ data: { session: null } }` |
| `backend.auth.signUp()` | Error: `Backend not configured. Check .env file.` |
| `backend.auth.signInWithPassword()` | Error: `Backend not configured. Check .env file.` |
| `backend.from(table).select()` | `{ data: [], error: null }` |
| `getSharedNotes()` | `[]` |
| `createShareLink()` | Error: `Backend not configured` |

### Supabase Query Interface

When configured, the backend exposes the standard Supabase client API:

```javascript
backend.from('notes').select('*').eq('user_id', userId)
backend.from('notes').upsert(noteData).select()
backend.from('notes').delete().eq('id', noteId)
backend.auth.signInWithPassword({ email, password })
backend.auth.signUp({ email, password })
backend.auth.signOut()
backend.channel('name').on('postgres_changes', filter, callback).subscribe()
```

### Backend Functions

| Function | Purpose |
|----------|---------|
| `backend.auth.*` | Authentication (signup, login, logout, session, password reset) |
| `backend.from(table)` | Query builder: read/write for `notes`, `folders`, `tags`; read-only for `note_versions`, `shared_notes`, `accepted_shares` |
| `backend.channel()` | Realtime subscriptions for live collaboration |
| `createShareLink()` | Create share invitation for a note |
| `acceptShare()` | Accept a share invitation |
| `declineShare()` | Decline a share invitation |
| `getSharedNotes()` | Fetch all notes shared with the current user |
| `getPendingShares()` | Fetch pending share invitations |
| `removeShare()` | Remove a share |
| `leaveSharedNote()` | Leave a shared note |
| `updateSharedNote()` | Apply a collaborator edit through the restricted RPC |
| `subscribeToSharedNoteContent()` | Subscribe to realtime changes on a shared note |
| `getRemoteNoteVersions()` | Fetch remote version history for a note |
| `deleteUserAccount()` | Delete user account and all associated data via RPC |
| `isBackendConfigured()` | Check if Supabase credentials are set |
| `getRedirectUrl()` | Get OAuth redirect URL (handles localhost vs production) |

## Offline Storage & Sync

### IndexedDB Schema (`src/lib/db.js`)

QuickNotes uses Dexie (IndexedDB wrapper) with the following tables:

| Table | Indexes | Purpose |
|-------|---------|---------|
| `notes` | `id, title, content, folderId, userId, createdAt, updatedAt, syncStatus` | All notes |
| `folders` | `id, name, parentId, userId, createdAt, updatedAt, syncStatus` | Folder hierarchy |
| `tags` | `id, name, color, userId, syncStatus` | Tag definitions |
| `noteTags` | `[noteId+tagId], noteId, tagId` | Note-tag associations (legacy, not used — tags stored as array in notes) |
| `noteVersions` | `++id, noteId, title, content, noteType, noteData, createdAt` | Version history (max 30 per note) |
| `syncQueue` | `++id, table, operation, data, timestamp` | Pending operations for cloud sync |

### Sync Status Enum

```javascript
SyncStatus.SYNCED   // Synchronized with backend
SyncStatus.PENDING  // Waiting for sync
SyncStatus.CONFLICT // Merge conflict detected
SyncStatus.ERROR    // Sync failed
```

### Sync Flow

1. Every local edit sets `syncStatus: PENDING` on the affected record
2. The edit is also added to the `syncQueue` table
3. `syncWithBackend()` processes the queue:
   - Uploads pending folder/tag deletions
   - Uploads new/modified folders and tags
   - Reconciles case-insensitive folder/tag matches and remaps legacy local folder IDs
   - Uploads pending notes
   - Downloads remote notes and merges with local state
   - Cleans up the sync queue
4. Conflict resolution: remote wins if `remote.updated_at > local.updatedAt + 2000ms`

## State Management

The application uses three Zustand stores defined in `src/store/index.js`:

### `useNotesStore` (persisted)

Core data store for notes, folders, tags, and sync logic.

| State / Action | Description |
|---------------|-------------|
| `notes`, `folders`, `tags` | Core data arrays |
| `selectedNoteId`, `selectedFolderId`, `selectedTagFilter` | Current selection state |
| `searchQuery` | Current search filter |
| `user`, `isAuthChecked` | Authentication state |
| `sharedNotes`, `pendingShares` | Sharing data |
| `isSyncing`, `lastSyncTime`, `isOnline` | Sync status |
| `createNote()`, `updateNote()`, `deleteNote()` | CRUD operations |
| `toggleStar()`, `togglePin()`, `archiveNote()` | Note state toggles |
| `createFolder()`, `updateFolder()`, `deleteFolder()` | Folder CRUD |
| `createTag()`, `updateTag()`, `deleteTag()` | Tag CRUD (renames propagate to all notes) |
| `addTagToNote()`, `removeTagFromNote()` | Tag assignment |
| `reorderNotes()`, `moveNote()`, `duplicateNote()` | Note management |
| `syncWithBackend()` | Full bidirectional sync |
| `getFilteredNotes()` | Returns notes filtered by folder, tag, search query |
| `getSelectedNote()` | Returns the currently selected note (including shared) |
| `shareNote()`, `acceptShare()`, `declineShare()` | Sharing actions |
| `loadSharedNotes()`, `leaveSharedNote()` | Sharing management |
| `initializeStarterContent()` | Creates welcome note, starter folders, and tags for new users |

**Persisted fields:** `notes`, `folders`, `tags`, `lastSyncTime`

### `useThemeStore` (persisted)

| State / Action | Description |
|---------------|-------------|
| `theme` | `'light'`, `'dark'`, or `'system'` |
| `setTheme()` | Update theme preference |

**Persisted fields:** `theme`

### `useUIStore` (persisted)

Manages all UI state: modal visibility, sidebar state, view mode, sync settings, and language.

| Category | States |
|----------|--------|
| **Layout** | `sidebarOpen`, `notesListWidth`, `mobileView`, `viewMode` (`list` / `grid`) |
| **Modals** | `settingsOpen`, `exportModalOpen`, `importModalOpen`, `globalSearchOpen`, `focusModeOpen`, `shortcutsModalOpen`, `noteTypesModalOpen`, `helpModalOpen`, `privacyModalOpen`, `termsModalOpen`, `tagManagerOpen`, `translateModalOpen`, `editorSettingsOpen`, `htmlEditorOpen`, `shareModalOpen`, `sharedNotesViewOpen`, `versionHistoryOpen`, `duplicateModalOpen`, `reminderModalOpen`, `imageUploadOpen`, `linkModalOpen`, `archiveViewOpen`, `quickNoteOpen`, `showTrash`, `findReplaceOpen` |
| **Sorting** | `currentSort` (e.g. `updated-desc`, `title-asc`, etc.) |
| **Selection** | `multiSelectMode`, `selectedNoteIds` |
| **Sync** | `autoSync`, `syncInterval`, `syncOnStartup`, `showSyncNotifications` |
| **Preferences** | `confirmBeforeDelete`, `spellCheck`, `showNoteStatistics`, `trashRetentionDays` |
| **Language** | `language` (ISO code: `en`, `de`, `es`, `fr`, `pt`, `zh`, `hi`, `ar`, `ru`) |

**Persisted fields:** `language`, `currentSort`, `notesListWidth`, `viewMode`, `autoSync`, `syncInterval`, `syncOnStartup`, `showSyncNotifications`, `confirmBeforeDelete`, `spellCheck`, `showNoteStatistics`, `trashRetentionDays`

## Rich Text Editor

The editor is built on **TipTap** (ProseMirror wrapper) with the following extensions configured in `RichTextEditor.jsx`:

| Extension | Purpose |
|-----------|---------|
| `StarterKit` | Bold, italic, headings, lists, blockquotes, code, history |
| `Underline` | Underline formatting |
| `TextAlign` | Left / center / right / justify alignment |
| `Highlight` | Background highlight with color picker |
| `Color` + `TextStyle` | Text foreground color |
| `FontFamily` | Font family selection |
| `Link` | Clickable hyperlinks |
| `Image` (custom) | Resizable images with drag handles (`ResizableImageExtension.js`) |
| `Table`, `TableRow`, `TableCell`, `TableHeader` (custom) | Tables with cell colors (`CustomTableCell.js`, `CustomTableHeader.js`) |
| `TaskList` + `StyledTaskItem` | Nested interactive checkboxes with selectable geometry |
| `CalloutExtension` (custom) | Semantic information, tip, warning, and important blocks |
| `CodeBlockLowlight` | Syntax-highlighted code blocks |
| `Placeholder` | Placeholder text when editor is empty |
| `Subscript` + `Superscript` | Sub/superscript text |
| `TextBoxExtension` (custom) | Editable text boxes with resize, wrapping and free positioning |
| `ShapeExtension` (custom) | Editable document shapes with persistent geometry and transforms |
| `PageBreakExtension` + `PaginationExtension` (custom) | Manual and automatic A4 page boundaries with visible inter-page gaps |

### Custom TipTap Extensions

- **`TextBoxExtension.js`** — Adds drag-created, freely movable text boxes with eight resize handles, exact geometry, wrapping, fill, border, and text-alignment controls.
- **`ShapeExtension.js`** — Adds 46 editable SVG objects with five direct ribbon choices, a categorized full gallery, drag creation, eight-handle resize, exact geometry, rotation, flips, wrapping, keyboard movement, and color presets.
- **`ParagraphLayoutExtension.js` + `TabStopExtension.js`** — Persist repeatable indents, paragraph spacing, ruler markers, typed left/centre/right/decimal stops, and matching Tab-key advances in note HTML.
- **`PageBreakExtension.js` + `PaginationExtension.js`** — Render the editor as successive A4 sheets, add pages as content grows, and persist manual `Ctrl/Cmd+Enter` boundaries for editing and PDF export.
- **`StyledTaskItem.js`** — Persists per-item checkbox shape, colour, size, checked-text behavior, and accessible interaction without replacing task semantics.
- **`CalloutExtension.js`** — Stores editable callout tone as semantic note HTML instead of a decorative floating shape.

- **`ResizableImageExtension.js`** — Extends the Image node to support drag-to-resize with handles. Renders via `ResizableImage.jsx`.
- **`CustomTableCell.js`** — Extends TableCell with a `backgroundColor` attribute for per-cell coloring.
- **`CustomTableHeader.js`** — Extends TableHeader with a `backgroundColor` attribute.

### Table Bubble Menu

`TableBubbleMenu.jsx` provides a floating toolbar when a table is selected, with operations for:
- Add / delete rows and columns
- Toggle header row / header column
- Merge / split cells
- Set cell / row background color
- Delete table

## Specialized Note Type Editors

Beyond the standard rich text editor, QuickNotes provides specialized editors for specific workflows. These are defined in `src/components/editors/`:

| Type | Editor Component | Key Features |
|------|------------------|-------------|
| `standard` | `RichTextEditor.jsx` | Full WYSIWYG rich text |
| `todo` | `TodoListEditor.jsx` | Priorities, due dates, subtasks, notes, stars, filters, sorting, and progress |
| `project` | `ProjectPlannerEditor.jsx` | Backlog-to-done board, milestones, team members, assignees, task details, and accessible status changes |
| `meeting` | `MeetingNotesEditor.jsx` | Details, attendance, timed agenda, topic notes, decisions, owned actions, and copyable summary |
| `journal` | `JournalEditor.jsx` | Mood, energy, weather, daily goals, highlights, gratitude, reflection prompts, tags, and free writing |
| `brainstorm` | `BrainstormEditor.jsx` | Rapid capture, custom categories, voting, stars, notes, duplication, sorting, and grid/list views |
| `shopping` | `ShoppingListEditor.jsx` | Categories, quantities, units, price estimates, currency, purchased totals, and budget tracking |
| `weekly` | `WeeklyPlannerEditor.jsx` | Local-time-safe week planning, daily events, time-blocked tasks, ratings, goals, notes, and review |

### Note Type Configuration (`noteTypes.js`)

Each note type has a configuration object with:

```javascript
{
  id: 'todo',
  name: 'Task List',
  description: 'A focused task manager with the context needed to finish work.',
  bestFor: 'Personal backlogs, checklists, routines, and delivery plans',
  icon: CheckSquare,           // Lucide icon component
  color: '#168966',
  category: 'Planning',
  features: ['Priorities', 'Due dates', 'Subtasks', 'Progress & filters'],
  keywords: ['todo', 'checklist', 'tasks', 'deadline', 'routine'],
}
```

Each type provides at least four purposeful starters. `getDefaultData(type)` creates a clean schema, `getStarterData(type, starterId)` creates an independent starter workspace, and `normalizeNoteData(type, data)` safely migrates older note shapes. Editor selection is handled by `NOTE_TYPE_EDITORS` in `editors/index.js`.

## Internationalization (i18n)

The i18n system is defined in `src/lib/i18n.js` (~3100 lines) with full translations for 9 languages:

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `de` | German | LTR |
| `es` | Spanish | LTR |
| `fr` | French | LTR |
| `pt` | Portuguese | LTR |
| `zh` | Chinese | LTR |
| `hi` | Hindi | LTR |
| `ar` | Arabic | RTL |
| `ru` | Russian | LTR |

### Translation Keys Structure

```
common.*        — Generic buttons (save, cancel, delete, etc.)
sidebar.*       — Sidebar navigation
nav.*           — Navigation items
notes.*         — Note-related labels
editor.*        — Editor toolbar labels
translate.*     — Translation feature
folders.*       — Folder management
tags.*          — Tag management
trash.*         — Trash view
settings.*      — Settings modal (all sections)
share.*         — Note sharing
help.*          — FAQ questions and answers
terms.*         — Terms of service
privacy.*       — Privacy policy
```

### Usage in Components

```jsx
import { useTranslation } from '../lib/useTranslation'

function Component() {
  const { t, language } = useTranslation()
  return <span>{t('notes.newNote')}</span>
}
```

### Time Formatting

`src/lib/utils.js` includes localized relative time formatting (`formatDate`, `formatSyncTime`) for all 9 languages.

## Theming

QuickNotes supports three theme modes managed by `ThemeProvider.jsx` and `useThemeStore`:

| Mode | Behavior |
|------|----------|
| `light` | Light background, dark text |
| `dark` | Dark background with gray-900/950 tones |
| `system` | Follows OS preference via `prefers-color-scheme` |

The theme is applied by toggling the `dark` class on the `<html>` element. Tailwind's `darkMode: 'class'` configuration enables `dark:` variant classes throughout the app.

### Custom CSS (`index.css`)

The global stylesheet includes extensive custom styles for:
- TipTap editor elements (headings, lists, blockquotes, links, highlights, code blocks)
- Table styles with cell selection, hover effects, resize handles
- Dark mode adjustments for paper backgrounds
- Task list checkbox styling
- Mobile responsive overrides (touch targets, toolbar scrolling, safe area insets)
- Animation keyframes (sync indicator, skeleton loading, dropdowns, modals, sidebar slide-in)

## PWA & Service Worker

### Service Worker (`public/sw.js`)

The service worker installs a complete application shell and applies a strategy
suited to each request type:

1. Installation caches `index.html`, every generated JavaScript and CSS chunk from
   Vite's build manifest, the web app manifest, and all install icons. Features that
   are loaded on demand therefore remain available without a prior visit.
2. Navigation is network-first with a bounded timeout and cached-shell fallback.
3. Same-origin static assets use stale-while-revalidate caching.
4. API calls, cross-origin resources, partial-content requests, and non-GET requests
   are never placed in the application cache.
5. Activation removes only superseded QuickNotes caches, leaving unrelated caches
   on the same origin untouched.

Each production build injects a digest of Vite's asset manifest into the worker.
Changing any generated chunk therefore triggers a fresh, complete install. Updated
workers wait until existing tabs close before activating, which avoids mixing an old
page with a new bundle.

### PWA Manifest (`public/manifest.json`)

The app is installable as a PWA with:
- App name: QuickNotes
- Theme color and icons
- `standalone` display mode
- Deployment-relative identity, scope, start URL, icons, and shortcuts

### SPA Routing on GitHub Pages

`public/404.html` handles GitHub Pages SPA routing by redirecting an unknown path to
the application shell. `public/app-shell.js` restores the original path, query
string, and fragment before React starts. The configured production base path is
injected into the fallback at build time.

## Database Schema

When using a cloud backend, the following database tables are expected. The SQL in
`supabase/migrations/` is the authoritative definition of the policies, grants,
constraints, RPCs, and triggers described below. Apply it to a new project with the
Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

| Table | Purpose |
|-------|---------|
| `notes` | All notes with title, content, tags (array), note_type, note_data (JSONB), starred, pinned, deleted, archived, reminder |
| `folders` | Folder hierarchy with name, icon, color, parent_id |
| `tags` | Tag definitions with name and color |
| `note_versions` | Version history (max 30 per note, auto-created on content change) |
| `shared_notes` | Share invitations with permission levels and status |
| `accepted_shares` | Denormalized accepted shares for fast access |

### Row Level Security

All public tables have RLS enabled. Anonymous roles have no table grants. Authenticated
users can access:
- Their own notes, folders, and tags
- Notes shared with them (via `accepted_shares`)
- Share invitations they created or received

Shared-note writes go through a restricted RPC that accepts only title, content,
note type, and structured note data. Direct updates remain owner-only.

### Stored Procedures

| Procedure | Purpose |
|-----------|---------|
| `create_share_invitation(note_id, email, permission)` | Create a view/edit invitation for an owned note |
| `accept_share_invitation(share_id)` | Accept share, create `accepted_shares` entry |
| `decline_share_invitation(share_id)` | Decline share invitation |
| `revoke_share_invitation(share_id)` | Revoke an invitation and cascade accepted access |
| `leave_shared_note(note_id)` | Remove user from shared note |
| `update_shared_note(note_id, patch)` | Apply an allow-listed collaborator edit |
| `get_pending_share_invitations()` | Return safe invitation metadata for the signed-in recipient |
| `delete_user_account()` | Permanently delete user account and all associated data |

### Triggers

| Trigger | Purpose |
|---------|---------|
| `update_updated_at_column()` | Auto-update `updated_at` on notes, folders, shared_notes |
| `create_note_version()` | Auto-create a version on document or structured-data changes (max 30) |

## GitHub Actions & Deployment

### GitHub Pages Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` on every push to
`main`. To run it on a fork:

1. Enable GitHub Pages in repository settings with **GitHub Actions** as the source
2. Optionally add the repository secrets `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) — without them the
   deployed app runs in offline-only mode
3. No source edit is required for a normal project-site fork: GitHub Actions derives
   the base path from `GITHUB_REPOSITORY`. Set `VITE_BASE_PATH=/` when publishing at
   an origin root, or set it to another absolute path such as `/notes/`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | No | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | No | Preferred Supabase public browser key (safe for frontend, protected by RLS) |
| `VITE_SUPABASE_ANON_KEY` | No | Legacy fallback for older Supabase projects |
| `VITE_BASE_PATH` | No | Absolute deployment path; defaults to the repository path for production and `/` for development |

When `VITE_SUPABASE_URL` and one of the two keys are set and point to a valid Supabase instance, the app enables cloud sync, authentication, and sharing features. Without them, QuickNotes runs in local-only mode with full functionality except sync and auth.

### Setup

1. Copy `.env.example` to `.env`
2. Fill in your Supabase project URL and publishable key (found in Supabase Dashboard → Settings → API)
3. Restart the dev server

> **Note:** Never expose the `service_role` key in frontend code — it bypasses Row Level Security and must only be used server-side.

For GitHub Pages deployment, set these as **repository secrets** named
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Settings → Secrets and
variables → Actions).

### Production Auth Checklist

- Configure custom SMTP before inviting production users. Supabase's default email
  sender is rate-limited and intended for evaluation.
- Keep email confirmation enabled and add the deployed URL plus password-recovery
  URL to Auth redirect allow-lists.
- Enable leaked-password protection in the Supabase Auth password-security settings.
- Use the app's 12-character minimum password policy; the UI also caps passwords at
  128 characters.

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | UI framework |
| `react-dom` | ^18.2.0 | React DOM renderer |
| `zustand` | ^4.4.7 | State management with persist middleware |
| `dexie` | ^3.2.4 | IndexedDB wrapper for offline storage |
| `dexie-react-hooks` | ^1.1.7 | React hooks for Dexie |
| `@tiptap/react` | ^2.1.13 | Rich text editor (React binding) |
| `@tiptap/starter-kit` | ^2.1.13 | Core TipTap extensions |
| `@tiptap/pm` | ^2.1.13 | ProseMirror core |
| `@tiptap/extension-*` | Various | TipTap editor extensions (table, image, link, highlight, code-block, task-list, text-align, color, font-family, underline, subscript, superscript, placeholder, text-style) |
| `@dnd-kit/core` | ^6.3.1 | Drag and drop core |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable drag and drop |
| `@dnd-kit/utilities` | ^3.2.2 | Drag and drop utilities |
| `highlight.js` | ^11.9.0 | Syntax highlighting engine |
| `lowlight` | ^3.1.0 | Lowlight adapter for highlight.js |
| `lucide-react` | ^0.294.0 | Icon library |
| `react-hot-toast` | ^2.4.1 | Toast notifications |
| `dompurify` | ^3.4.12 | Sanitizes imported and previewed rich-text HTML |
| `@supabase/supabase-js` | ^2.111.0 | Supabase client for auth, database, and realtime |

### Dev

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^8.2.0 | Build tool + dev server |
| `@vitejs/plugin-react` | ^6.0.5 | React support for Vite |
| `tailwindcss` | ^3.3.5 | Utility-first CSS framework |
| `postcss` | ^8.5.25 | CSS processing |
| `autoprefixer` | ^10.5.4 | CSS vendor prefixes |
| `eslint` | ^9.39.5 | Linting |
| `eslint-plugin-react` | ^7.37.5 | React linting rules |
| `eslint-plugin-react-hooks` | ^7.1.1 | React hooks linting |
| `eslint-plugin-react-refresh` | ^0.5.3 | React hot refresh linting |
| `eslint-config-prettier` | ^10.1.8 | Disables rules that conflict with formatting |
| `vitest` | ^4.1.10 | Unit test runner |
| `@vitest/coverage-v8` | ^4.1.10 | Coverage reporting |
| `jsdom` | ^29.1.1 | DOM environment for unit tests |
| `fake-indexeddb` | ^6.2.5 | IndexedDB implementation for unit tests |
| `@testing-library/react` | ^16.3.2 | Component testing utilities |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `@testing-library/jest-dom` | ^7.0.0 | DOM assertions |
| `@playwright/test` | ^1.62.0 | Browser test runner |
| `@axe-core/playwright` | ^4.12.1 | Automated WCAG checks |

The `overrides` block in `package.json` pins transitive dependencies that would
otherwise resolve to versions with published advisories. `brace-expansion` is
resolved through `vendor/brace-expansion-compat`, a small CommonJS adapter that
exposes the patched `brace-expansion` 5 API in the callable shape `minimatch` 3
expects.

## Build Instructions

### Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
```

Output is written to `dist/`. To preview:

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

### Testing

Unit tests live next to the modules they cover (`src/**/*.test.js`) and run in a
jsdom environment with `fake-indexeddb` standing in for browser storage:

```bash
npm test           # single run
npm run test:watch # watch mode
```

Browser tests live in `e2e/` and cover core workspace flows, the specialized note
type workspaces, responsive layout from 320px to 1920px, and automated WCAG A/AA
checks via axe-core:

```bash
npx playwright install chromium webkit # one-time browser installation
npm run build      # Playwright serves dist/ via `npm run preview`
npm run test:e2e
```

The deployment check builds the application, serves `dist/` with GitHub Pages 404
semantics, verifies manifest and icon metadata, follows a deep link, installs the
service worker, clears Chromium's HTTP cache, and reloads offline:

```bash
npm run test:deployment
```

The suite uses the local workspace by default. To exercise the cloud sign-in path
instead, point the build at a Supabase project and export `QN_EMAIL` and
`QN_PASSWORD` for a test account — never commit those credentials.

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

Please run `npm run lint` and `npm test` before opening a pull request.

### Areas for Contribution

- **Alternative backends** — Implement the `backend.js` surface against another provider
- **New note type editors** — Add specialized editors for new workflows
- **Additional languages** — Extend `i18n.js` with new translations
- **Accessibility** — Improve screen reader support and keyboard navigation
- **Performance** — Optimize large note lists, editor startup time, and sync batching
- **Test coverage** — Extend the unit and browser suites, especially around sync and sharing

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/issues) with:
- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots if applicable

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software, provided that any derivative works are also licensed under the GPL-3.0 and made available as open source.

## Screenshots

If you'd like a preview of QuickNotes before trying it out, the screenshots below show the application's key features. Note that future updates may introduce additional functionality.

<table>
  <tr>
    <th>QuickNotes - Sign in</th>
    <th>QuickNotes - Editor</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-startup.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-startup.png" alt="QuickNotes Sign in" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-editor.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-editor.png" alt="QuickNotes Editor" width="450"></a></td>
  </tr>
  <tr>
    <th>QuickNotes - Task Workspace</th>
    <th>QuickNotes - Meeting Workspace</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-tasks.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-tasks.png" alt="QuickNotes Task Workspace" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-meeting.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-meeting.png" alt="QuickNotes Meeting Workspace" width="450"></a></td>
  </tr>
  <tr>
    <th>QuickNotes - Global Search</th>
    <th>QuickNotes - Project Board</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-search.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-search.png" alt="QuickNotes Global Search" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-board.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-board.png" alt="QuickNotes Project Board" width="450"></a></td>
  </tr>
  <tr>
    <th>QuickNotes - Workspaces</th>
    <th>QuickNotes - Document Shapes</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-workspaces.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-workspaces.png" alt="QuickNotes Workspace Picker" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-shapes.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/images/screenshot-shapes.png" alt="QuickNotes Document Shapes" width="450"></a></td>
  </tr>
</table>
