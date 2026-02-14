<p align="center">
  <img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_icon.png" alt="QuickNotes Logo" width="128" />
</p>

<h1 align="center">QuickNotes - Simple Note Manager</h1>

<p align="center">
  <b>A modern, feature-rich note-taking application with cloud sync, offline support, and a powerful rich text editor.</b><br>
  <b>Organize your thoughts with folders, tags, templates, and more.</b>
</p>

<p align="center">
  <a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/releases"><img src="https://img.shields.io/github/v/release/BerndHagen/QuickNotes-Simple-Note-Manager?include_prereleases&style=flat-square&color=CD853F" alt="Latest Release"></a>&nbsp;&nbsp;
  <a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"></a>&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React Version">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite" alt="Vite Version">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Platform-Web-9f9f9f?style=flat-square" alt="Platform">&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square" alt="Status">
</p>

**QuickNotes** is a browser-based note-taking application built with React and TipTap. It works fully offline using IndexedDB and can optionally sync to a cloud backend. Notes support rich text formatting, code blocks with syntax highlighting, tables, images, checklists, and more.

## Key Features

- **Rich Text Editor:** Full WYSIWYG editor powered by TipTap with headings, bold, italic, underline, strikethrough, text alignment, font colors, highlights, and more
- **Code Blocks:** Syntax highlighting for many programming languages via Lowlight
- **Tables:** Insert and edit tables with a bubble menu for row/column operations, cell merging, header toggling, and cell background colors
- **Task Lists:** Interactive checklists with checkbox toggling
- **Image Support:** Upload and embed resizable images directly in notes with drag handles
- **Folders & Tags:** Organize notes into folders and assign color-coded tags via the Tag Manager
- **Favorites & Pins:** Star or pin important notes for quick access
- **Global Search:** Full-text search across all notes by title, content, and tags
- **Find & Replace:** In-editor find and replace with regex support
- **Quick Note:** Capture ideas instantly with a floating modal
- **Templates:** Pre-built note templates for common use cases (empty note, to-do, meeting notes, project plan, code snippet, journal)
- **Specialized Note Types:** Dedicated editors for brainstorming, meeting notes, project planning, shopping lists, weekly planners, journals, and to-do lists
- **Version History:** View and restore previous versions of any note (up to 50 versions per note)
- **Duplicate Detection:** Automatically find similar or duplicate notes
- **Focus Mode:** Distraction-free writing experience
- **Dark / Light / System Theme:** Three theme modes with automatic system preference detection
- **Drag & Drop Sorting:** Reorder notes via drag and drop using @dnd-kit
- **Export & Import:** Export notes as JSON, Markdown, or HTML; import from JSON
- **Reminders:** Set reminders for individual notes
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
    - [Release Workflow](#release-workflow-githubworkflowsreleaseyml)
    - [GitHub Pages Deployment](#github-pages-deployment)
14. [Environment Variables](#environment-variables)
    - [Setup](#setup)
15. [Dependencies](#dependencies)
    - [Runtime](#runtime)
    - [Dev](#dev)
16. [Build Instructions](#build-instructions)
    - [Development](#development)
    - [Production Build](#production-build-1)
    - [Linting](#linting)
17. [Contributing](#contributing)
    - [Areas for Contribution](#areas-for-contribution)
    - [Reporting Issues](#reporting-issues)
18. [License](#license)
19. [Screenshots](#screenshots)

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Installation

```bash
git clone https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager.git
cd QuickNotes-Simple-Note-Manager
npm install
npm run dev
```

The application will be available at `http://localhost:5173`. No backend or environment variables are required for local development — QuickNotes runs in offline-only mode by default.

### Production Build

```bash
npm run build
npm run preview
```

The build output is written to `dist/`. The `base` path in `vite.config.js` is set to `/QuickNotes-Simple-Note-Manager/` for GitHub Pages deployment.

## Project Structure

```
QuickNotes-Simple-Note-Manager/
├── .env.example                          # Supabase environment variable template
├── .github/
│   └── workflows/
│       └── release.yml                   # GitHub Actions: build + create release
├── index.html                            # HTML entry point
├── package.json                          # Dependencies and scripts
├── postcss.config.js                     # PostCSS configuration (Tailwind)
├── tailwind.config.js                    # Tailwind CSS configuration
├── vite.config.js                        # Vite build configuration
│
├── public/
│   ├── 404.html                          # SPA fallback for GitHub Pages
│   ├── manifest.json                     # PWA manifest
│   ├── sw.js                             # Service worker for offline caching
│   └── icons/                            # PWA icons
│
└── src/
    ├── App.jsx                           # Root application component
    ├── main.jsx                          # React entry point
    ├── index.css                         # Global CSS (Tailwind + custom styles)
    │
    ├── components/
    │   ├── index.js                      # Barrel exports for all components
    │   │
    │   ├── NoteEditor.jsx                # Main note editing view with toolbar
    │   ├── RichTextEditor.jsx            # TipTap editor wrapper with all extensions
    │   ├── NotesList.jsx                 # Note list panel (list view)
    │   ├── NotesGrid.jsx                 # Note grid panel (grid view)
    │   ├── Sidebar.jsx                   # Navigation sidebar with folders & tags
    │   ├── AuthScreen.jsx                # Login / signup screen
    │   ├── ThemeProvider.jsx             # Dark / Light / System theme provider
    │   │
    │   ├── SettingsModal.jsx             # Application settings modal
    │   ├── EditorSettingsModal.jsx        # Editor-specific settings (font, spacing)
    │   ├── TemplateModal.jsx             # Quick template selection (Ctrl+T)
    │   ├── NoteTemplatesModal.jsx        # Full template gallery with 25+ templates
    │   ├── NoteTypesModal.jsx            # Specialized note type selector
    │   ├── ExportModal.jsx               # Export notes (JSON / Markdown / HTML)
    │   ├── ImportModal.jsx               # Import notes from JSON
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
    │   ├── CustomTableCell.js            # TipTap extension: custom table cell
    │   └── CustomTableHeader.js          # TipTap extension: custom table header
    │
    │   └── editors/                      # Specialized note type editors
    │       ├── index.js                  # Editor registry + barrel exports
    │       ├── noteTypes.js              # Note type definitions, configs, defaults
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
    │   ├── i18n.js                       # Translations for 9 languages (3100+ lines)
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

The backend operates in two modes depending on whether `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured:

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Cloud** | Both env vars set and URL contains `supabase.co` | Full Supabase client with auth, real-time, cloud sync |
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
| `backend.from(table)` | CRUD query builder for `notes`, `folders`, `tags`, `shared_notes`, `accepted_shares` |
| `backend.channel()` | Realtime subscriptions for live collaboration |
| `createShareLink()` | Create share invitation for a note |
| `acceptShare()` | Accept a share invitation |
| `declineShare()` | Decline a share invitation |
| `getSharedNotes()` | Fetch all notes shared with the current user |
| `getPendingShares()` | Fetch pending share invitations |
| `removeShare()` | Remove a share |
| `leaveSharedNote()` | Leave a shared note |
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
| `noteVersions` | `++id, noteId, content, createdAt` | Version history (max 50 per note) |
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
   - Merges remote folders/tags into local state
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
| **Modals** | `settingsOpen`, `exportModalOpen`, `importModalOpen`, `globalSearchOpen`, `focusModeOpen`, `shortcutsModalOpen`, `templatesModalOpen`, `noteTypesModalOpen`, `helpModalOpen`, `privacyModalOpen`, `termsModalOpen`, `tagManagerOpen`, `translateModalOpen`, `editorSettingsOpen`, `htmlEditorOpen`, `shareModalOpen`, `sharedNotesViewOpen`, `templateModalOpen`, `versionHistoryOpen`, `duplicateModalOpen`, `reminderModalOpen`, `imageUploadOpen`, `linkModalOpen`, `archiveViewOpen`, `quickNoteOpen`, `showTrash`, `findReplaceOpen` |
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
| `TaskList` + `TaskItem` | Interactive checkboxes |
| `CodeBlockLowlight` | Syntax-highlighted code blocks |
| `Placeholder` | Placeholder text when editor is empty |
| `Subscript` + `Superscript` | Sub/superscript text |

### Custom TipTap Extensions

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
| `todo` | `TodoListEditor.jsx` | Tasks with priorities (low/medium/high/urgent), deadlines, categories, filtering |
| `project` | `ProjectPlannerEditor.jsx` | Kanban-style columns (To Do / In Progress / Done), task cards with drag support |
| `meeting` | `MeetingNotesEditor.jsx` | Attendees, agenda items, discussion notes, action items with owners |
| `journal` | `JournalEditor.jsx` | Mood tracking, gratitude entries, daily highlights |
| `brainstorm` | `BrainstormEditor.jsx` | Idea cards with voting/rating, grid and list views, category filtering |
| `shopping` | `ShoppingListEditor.jsx` | Items with quantity, category, price, checked state |
| `weekly` | `WeeklyPlannerEditor.jsx` | Day-by-day schedule with time slots and goals |

### Note Type Configuration (`noteTypes.js`)

Each note type has a configuration object with:

```javascript
{
  id: 'todo',
  name: 'To-Do List',
  description: 'Task management with priorities & deadlines',
  icon: CheckSquare,           // Lucide icon component
  color: '#22c55e',
  gradient: 'from-green-500 to-emerald-600',
  category: 'Productivity',
  features: ['Priorities', 'Deadlines', 'Subtasks', 'Progress'],
}
```

The `getDefaultData(type)` function generates the initial structured data for each note type. Editor selection is handled by the `EDITOR_MAP` in `editors/index.js`.

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
templates.*     — Template names and labels
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

The service worker implements a **network-first with cache fallback** strategy:

1. Attempts to fetch from the network
2. On success, caches the response for future offline use
3. On failure, falls back to the cached version
4. For navigation requests, falls back to the root page (SPA routing)
5. Excludes backend API requests from caching

### PWA Manifest (`public/manifest.json`)

The app is installable as a PWA with:
- App name: QuickNotes
- Theme color and icons
- `standalone` display mode
- Start URL pointing to the deployed base path

### SPA Routing on GitHub Pages

`public/404.html` handles GitHub Pages SPA routing by redirecting all 404s back to `index.html` with the original path encoded as a query parameter.

## Database Schema

When using a cloud backend, the following database tables are expected.

| Table | Purpose |
|-------|---------|
| `notes` | All notes with title, content, tags (array), note_type, note_data (JSONB), starred, pinned, deleted, archived, reminder |
| `folders` | Folder hierarchy with name, icon, color, parent_id |
| `tags` | Tag definitions with name and color |
| `note_versions` | Version history (max 50 per note, auto-created on content change) |
| `shared_notes` | Share invitations with permission levels and status |
| `accepted_shares` | Denormalized accepted shares for fast access |
| `collaboration_cursors` | Active editor tracking for real-time collaboration |

### Row Level Security

All tables should have RLS enabled so users can only access:
- Their own notes, folders, and tags
- Notes shared with them (via `accepted_shares`)
- Share invitations they created or received

### Stored Procedures

| Procedure | Purpose |
|-----------|---------|
| `accept_share_invitation(share_id)` | Accept share, create `accepted_shares` entry |
| `decline_share_invitation(share_id)` | Decline share invitation |
| `leave_shared_note(note_id)` | Remove user from shared note |
| `delete_user_account()` | Permanently delete user account and all associated data |

### Triggers

| Trigger | Purpose |
|---------|---------|
| `update_updated_at_column()` | Auto-update `updated_at` on notes, folders, shared_notes |
| `create_note_version()` | Auto-create version on `notes.content` change (max 50) |

## GitHub Actions & Deployment

### Release Workflow (`.github/workflows/release.yml`)

Triggered on every push to `main`:

1. Checks out code and installs Node.js 20
2. Runs `npm ci` + `npm run build`
3. Generates a timestamped release tag (`release-YYYYMMDD-HHMMSS`)
4. Creates a ZIP of the `dist/` output
5. Creates a GitHub Release with the ZIP artifact and auto-generated release notes from commit messages

### GitHub Pages Deployment

To deploy to GitHub Pages:

1. Set repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (optional — app works without them)
2. The `base` path in `vite.config.js` is set to `/QuickNotes-Simple-Note-Manager/`
3. Enable GitHub Pages in repository settings (source: GitHub Actions)
4. Add a deploy workflow that builds and publishes the `dist/` directory

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | No | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | No | Your Supabase anon/public key (safe for frontend, protected by RLS) |

When both variables are set and point to a valid Supabase instance, the app enables cloud sync, authentication, and sharing features. Without them, QuickNotes runs in local-only mode with full functionality except sync and auth.

### Setup

1. Copy `.env.example` to `.env`
2. Fill in your Supabase project URL and anon key (found in Supabase Dashboard → Settings → API)
3. Restart the dev server

> **Note:** Never expose the `service_role` key in frontend code — it bypasses Row Level Security and must only be used server-side.

For GitHub Pages deployment, set these as **repository secrets** named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions).

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
| `uuid` | ^9.0.1 | UUID generation |
| `@supabase/supabase-js` | ^2.95.3 | Supabase client for auth, database, and real-time |

### Dev

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.0.0 | Build tool + dev server |
| `@vitejs/plugin-react` | ^4.2.0 | React support for Vite |
| `tailwindcss` | ^3.3.5 | Utility-first CSS framework |
| `postcss` | ^8.4.31 | CSS processing |
| `autoprefixer` | ^10.4.16 | CSS vendor prefixes |
| `eslint` | ^8.53.0 | Linting |
| `eslint-plugin-react` | ^7.33.2 | React linting rules |
| `eslint-plugin-react-hooks` | ^4.6.0 | React hooks linting |
| `eslint-plugin-react-refresh` | ^0.4.4 | React hot refresh linting |

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

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Areas for Contribution

- **Backend implementations** — Connect the `backend.js` abstraction to providers like Supabase, Firebase, or a custom REST API
- **New note type editors** — Add specialized editors for new workflows
- **Additional languages** — Extend `i18n.js` with new translations
- **Accessibility** — Improve screen reader support and keyboard navigation
- **Performance** — Optimize large note lists, editor startup time, and sync batching
- **Testing** — Add unit and integration tests

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/issues) with:
- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots if applicable

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software for personal and commercial purposes.

## Screenshots

If you'd like a preview of QuickNotes before trying it out, the screenshots below show the application's key features. Note that future updates may introduce additional functionality.

<table>
  <tr>
    <th>QuickNotes - Startup</th>
    <th>QuickNotes - Editor</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_startup.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_startup.png" alt="QuickNotes Startup" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_editor.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_editor.png" alt="QuickNotes Editor" width="450"></a></td>
  </tr>
  <tr>
    <th>QuickNotes - Note</th>
    <th>QuickNotes - Tags</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_note.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_note.png" alt="QuickNotes Note" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_tags.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_tags.png" alt="QuickNotes Tags" width="450"></a></td>
  </tr>
  <tr>
    <th>QuickNotes - Meeting Notes</th>
    <th>QuickNotes - To-Do List</th>
  </tr>
  <tr>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_meeting.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_meeting.png" alt="QuickNotes Meeting Notes" width="450"></a></td>
    <td><a href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_todo.png" target="_blank" rel="noopener noreferrer"><img src="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/raw/main/img/img_v1.0.0-quicknotes_todo.png" alt="QuickNotes To-Do List" width="450"></a></td>
  </tr>
</table>
