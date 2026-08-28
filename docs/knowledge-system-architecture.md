# Knowledge system architecture

QuickNotes connects every content surface through one local-first knowledge model without replacing its purpose-built editors.

## Canonical and derived data

Notes, structured `noteData`, spatial rows, resources, folders, tags, and Smart View definitions remain canonical. The knowledge system creates two owner-scoped projections in IndexedDB:

```text
canonical notes + folders + spatial objects/resources
                         |
                         +-- SearchDocument rows --> MiniSearch worker index
                         |
                         +-- knowledgeLinks rows --> forward links/backlinks
```

`searchDocuments`, `knowledgeLinks`, and `knowledgeIndexState` are disposable derived data. They are not included in workspace snapshots, backups, or Supabase synchronization. Rebuilding reads canonical rows and never writes notes. This separation follows IndexedDB's transactional object-store model while keeping cloud data free of device-specific indexes ([IndexedDB specification](https://www.w3.org/TR/IndexedDB/)).

## Canonical identities

- `NoteId` identifies every catalog note independent of title, folder, or editor.
- `AnchorId` is stored as `data-anchor-id` on meaningful Document headings.
- `ObjectId` and `PageId` address Paper and Canvas objects and pages.
- `ResourceId` identifies a resource independently of a placement.
- Derived link IDs are deterministic from owner, source location, target identity, and ordinal.

Renaming or moving a note changes display metadata only. A link target remains `{ noteId, anchorId?, objectId? }`. Imported content continues to use the archive identity-remapping boundary.

## SearchDocument

`SearchDocument` schema version 1 is the common projection. It contains weighted text fields, classification and state fields, stable result locations, and a source fingerprint. Document HTML, structured workspaces, Paper, and Canvas remain separate canonical engines; their machine-readable content is projected into the same search contract.

The searchable sources are title, Document text/headings, bounded structured values, tags, folder name, note/content type, typed Paper/Canvas objects, note-reference labels, and image resource metadata. Vector stroke points are never converted to text. Raw handwriting therefore remains unsearchable until a later task supplies recognized text as an explicit source.

## Index and update lifecycle

1. The workspace activates an owner-scoped knowledge service.
2. The repository compares canonical fingerprints with persisted projections.
3. Changed notes are projected in bounded batches that yield to the browser.
4. Search documents and extracted links commit atomically with index state.
5. A long-lived module worker incrementally replaces, adds, or removes MiniSearch documents.
6. Successful note or spatial persistence emits a canonical-content-persisted event. Remote sync writes use the same refresh boundary.
7. Queries receive a request ID; stale responses cannot replace newer results.

The worker performs tokenization and ranking away from the UI thread using the browser's worker execution model ([WHATWG Workers](https://html.spec.whatwg.org/dev/workers.html)). If Worker construction fails, the same engine runs against the persisted projections on the main thread with an explicit degraded/error status and a rebuild action.

An absent, old, building, failed, or count-inconsistent `knowledgeIndexState` causes deterministic derived-data replacement. Dexie version 4 adds empty derived stores to the version 3 schema; the migration does not rewrite canonical rows.

## Link and graph model

Explicit links are extracted from sanitized Document anchors and spatial `noteLink` objects. A relationship row records source note/location, target note/location, label, context, and relationship type. Forward links and backlinks are two indexed views of the same row.

The relationship rows are also the graph index. QuickNotes does not require a graph visualization because ordinary search and navigation must not depend on one. The Inspector's forward-link and backlink lists are the accessible, nonvisual relationship representation. A future graph can consume these rows without changing link identity or canonical content.

## Query and organization model

Global Search uses ordinary lexical text plus optional filters. Folders answer where a note lives, tags provide many labels, links express relationships, and Smart Views store dynamic query criteria. None substitutes for another.

Smart Views remain canonical owner-scoped definitions evaluated against current notes. Their text rules use the active `SearchDocument` projection when present, which gives structured and spatial text the same semantics as global search, and fall back to canonical content during startup or recovery.

## Sync and future boundaries

Supabase synchronizes canonical notes and spatial rows. Each client rebuilds its own search and relationship projections, scoped by the active workspace owner. Sharing expands the accessible canonical note set; it does not expose one owner's local index to another owner.

Sources such as OCR text, handwriting recognition, PDF text, transcription, or image text can add bounded, attributed fields and locations to `SearchDocument`. They must reference the existing `NoteId`, `AnchorId`, `ObjectId`, or `ResourceId`; they must not reinterpret raw pixels or stroke points inside this indexer. Semantic embeddings remain outside the lexical index and are not needed for search.
