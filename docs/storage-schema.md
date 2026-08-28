# Storage schema

## Browser database

`QuickNotesDB` is Dexie/IndexedDB schema version 10.

| Added | Stores | Role |
| --- | --- | --- |
| v1 | notes, folders, tags, noteTags, noteVersions, syncQueue | original catalog/document persistence |
| v2 | workspaceSnapshots; owner indexes | owner isolation and recoverable workspace snapshot |
| v3 | spatialDocuments, spatialPages, spatialObjects, resources | Paper/Canvas canonical graphs |
| v4 | searchDocuments, knowledgeLinks, knowledgeIndexState | rebuildable Task 3 projections |
| v5 | noteResources, resourceBlobs, recordingSessions, resourceChunks, recognizedContent, intelligenceJobs/settings | capture sources, recovery, recognition |
| v6 | captureSyncState | capture hydration marker |
| v7 | spatialAnnotations/pages/objects | canonical image/PDF overlays |
| v8 | annotationSyncState | annotation remote marker |
| v9 | semanticEmbeddings/indexState | optional rebuildable derived boundary; empty is valid |
| v10 | spatialSyncState | Paper/Canvas remote baselines and durable conflict-review markers |

Canonical binary payloads are stored in `resourceBlobs`; Paper/Canvas legacy
image data remains in the spatial `resources` contract. Workspace snapshots do
not duplicate large spatial/capture payloads. All current owner-bearing stores
are queried through the active owner boundary.

## Supabase

The deployed project stores owner catalogs/documents and versions; shares,
comments, mentions, and private usernames; spatial documents/pages/objects and
image resources; capture resource metadata/links/recognized content;
annotation graphs; and private rate-limit counters for capability-gated server
functions. Canonical PDF/audio bytes live in the private `note-resources`
Storage bucket at owner/resource-derived paths.

RLS and identity-hardening triggers are authoritative. Realtime publication is
enabled only where adapters subscribe. Repository migrations are the reviewable
history, but live-project inspection is required for a release audit because a
SQL file alone does not prove deployed state.
