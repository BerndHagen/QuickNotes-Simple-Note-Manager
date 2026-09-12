# Document, Paper, and Canvas architecture

QuickNotes provides three purpose-built content surfaces inside one application shell. Paper and Canvas extend rather than replace the rich-text and structured editors.

## Current application model

- Notes are the shared catalog record. They provide stable identity, title, folder, tags, lifecycle state, search metadata, and cloud synchronization.
- `standard` notes use Tiptap/ProseMirror and store sanitized HTML in `note.content`.
- Existing task, project, meeting, journal, brainstorm, shopping, and weekly notes use structured `noteData` objects and their current specialized React editors.
- Zustand owns the visible workspace catalog. Dexie stores note records, recovery versions, sync operations, and an owner-scoped workspace snapshot. Supabase remains the optional metadata/document sync backend.
- Tiptap extensions and node views remain the extension boundary for rich documents. Paper and Canvas are sibling content engines, not large Tiptap nodes.

## Canonical content identity

Every note is normalized to an explicit content descriptor:

| `contentKind` | Editor | Primary content | Current schema |
| --- | --- | --- | --- |
| `document` | Tiptap | `note.content` HTML | 1 |
| `structured` | Existing specialized editor | `note.noteData` JSON | 1 |
| `paper` | Paper editor | spatial document/pages/objects | 1 |
| `canvas` | Canvas editor | spatial document/objects | 1 |

`noteType` remains the user-visible subtype and routing key for backward compatibility. New Paper and Canvas notes use `noteType: "paper"` and `noteType: "canvas"`. `contentKind` is never inferred from content. Existing records missing it are migrated deterministically from the already explicit legacy `noteType`; unknown types fall back to `document` without altering their content. `contentSchemaVersion` records the note-level contract. Spatial rows carry their own `schemaVersion` so later migrations do not require rewriting unrelated notes.

Stable IDs are generated with `crypto.randomUUID()`. Note, spatial document, page, object, stroke, and resource identities are never array indexes. Imported backups receive new IDs and all internal page/object/note/resource references are remapped.

## Persistence contract

Dexie schema version 3 adds owner-scoped, per-record storage:

- `spatialDocuments`: one small descriptor per Paper or Canvas note (kind, settings, viewport, revision).
- `spatialPages`: ordered Paper pages with size, surface, and pattern settings.
- `spatialObjects`: strokes and editable objects, indexed by note/page/kind/z-order.
- `resources`: shared attachment metadata and binary payloads, independent of a particular editor surface.

Spatial saves are atomic Dexie transactions. A completed stroke or object transaction writes only the changed document/object/page rows, then updates the note catalog timestamp. Pointer moves never write to Zustand or IndexedDB. The editor reports `Saving`, `Saved`, or `Save failed` from the actual persistence promise; `Saved` is never optimistic.

The workspace snapshot deliberately excludes spatial payloads. Backup version 3 carries spatial documents, pages, objects, and resources as separate bounded arrays. Import validates shapes, sizes, nesting, types, and references before committing the catalog and spatial rows in one transaction. Removing an image placement or permanently deleting a note collects its resource only after the final cross-note reference disappears; ordinary trash preserves spatial data. Version checkpoints remain separate: ProseMirror history continues to own document undo; the spatial engine owns transaction history. The Supabase adapter synchronizes the same per-record DTOs through a dedicated bounded queue and row-level policies without turning `noteData` into a giant sync blob or introducing a CRDT. Concurrent same-owner spatial revisions are retained as durable conflicts and require an explicit graph choice; same-object realtime co-editing is not claimed.

## Shared spatial model

Paper and Canvas share geometry, ink, selection, commands, serialization, export rendering, and input handling. They do not share one mutable god object.

The world coordinate system is editor content space. Pointer coordinates are converted by:

```text
worldX = (screenX - viewport.left - viewport.panX) / viewport.zoom
worldY = (screenY - viewport.top  - viewport.panY) / viewport.zoom
screenX = viewport.left + viewport.panX + worldX * viewport.zoom
screenY = viewport.top  + viewport.panY + worldY * viewport.zoom
```

Paper pages add a page-local origin; persisted points remain page-local so page reordering does not rewrite strokes. Canvas uses unrestricted world coordinates. Zoom and pan are presentation state and never mutate object geometry.

Spatial objects use a discriminated, versioned representation:

- `stroke`: compact points `[x, y, pressure, tiltX, tiltY, time]`, brush, color, opacity, width, bounds.
- `shape`: line, arrow, rectangle, or ellipse with geometry and stroke/fill style.
- `text`, `sticky`, and `indexCard`: bounds, plain text, and restrained semantic styling.
- `image`: bounds and a stable `resourceId`.
- `noteLink`: bounds and a stable target `noteId`; display titles are resolved at render time.

Objects store integer `zIndex` values and timestamps. The spatial document carries the transaction revision. Bounds are cached and validated for hit testing/culling but can be recomputed from source geometry. Security limits cap documents, pages, objects, stroke points, text, dimensions, zoom, and resource bytes.

## Rendering choice

The engine uses a layered hybrid renderer:

1. CSS renders Paper surfaces and repeatable ruled/dot/grid patterns without persisting pixels.
2. A high-DPI Canvas 2D layer renders committed vector-source ink. It scales its backing store by `devicePixelRatio` while retaining CSS/world coordinates.
3. A separate high-DPI canvas renders the in-progress stroke directly from refs for low latency; React state changes once when the stroke commits.
4. An SVG/HTML object layer renders shapes and editable text-like objects, plus selection handles. Viewport culling prevents mounting off-screen objects.

This keeps stroke source data editable and replayable, avoids a DOM node per point, avoids React renders per pointer sample, and gives text-like objects native focus and accessibility. Export replays the same canonical vectors to an off-screen canvas; editor chrome and selection affordances are excluded.

Ink Replay builds a read-only timeline from stable stroke creation order and each stroke's relative point timestamps. Playback, pause, bounded inter-stroke timing, and seek derive a temporary set of visible source points; replay never rewrites the note or creates history entries.

## Pointer and gesture pipeline

One Pointer Events controller handles `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, and `lostpointercapture` for both surfaces. It captures the active pointer, uses `getCoalescedEvents()` when available (without also processing the parent sample), and falls back to the dispatched event. Samples retain pressure and tilt. Unsupported pressure uses a deterministic active-pressure fallback rather than producing invisible strokes.

`touch-action: none` is scoped to the drawing viewport. Pen input draws; mouse input uses the active tool; single-touch pans by default to avoid accidental finger ink. Reusable brush definitions own width, opacity, cap/join style, and pressure response: Pen varies naturally with pressure, while Highlighter is broad, translucent, square-ended, and intentionally much less pressure-sensitive. The eraser is honestly a whole-stroke eraser in schema version 1. Palm rejection is best effort: non-primary touch pointers are ignored while a pen pointer is active. Cancellation finalizes no partial command and reliably releases transient input state.

Relevant platform contracts:

- [W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/)
- [MDN: `getCoalescedEvents()`](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)
- [MDN: `devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- [MDN: optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

## Commands, selection, and history

The spatial command layer applies atomic `add`, `remove`, `update`, and `batch` transactions. One stroke, drag, resize, paste, duplicate, or z-order operation creates one history entry. Undo applies the inverse transaction; redo reapplies the original. History is capped and is session-local, while committed results are durable.

Selection uses cached bounds followed by type-specific hit testing. Click selects one object; Shift adds/removes; lasso intersects bounds; drag moves the selection as one command. Resize handles apply to bounded objects. Keyboard Delete, copy, paste, duplicate, arrow nudge, Escape, undo, and redo target spatial selection only when a text field is not active. Clipboard data uses a namespaced plain-text envelope because the async Clipboard API does not consistently permit arbitrary custom MIME types.

## Surface differences

Paper is page-oriented. Each page persists size (`free`, A4, A5, or Letter), surface (`white`, `warm`, `cream`, or `dark`), pattern (`blank`, `ruled`, `dot`, `square`, or `graph`), order, and independent objects. Add, duplicate, delete, and reorder are page transactions. Page size presets use real aspect ratios; export maps pages to one PDF page each.

Canvas is an effectively infinite world. It persists a last viewport, but all content remains in world coordinates. Pan/zoom never resizes the world element. It supports ink plus bounded shapes, text, sticky notes, index cards, images, and stable note links with z-order controls.

## Autosave, failure, and performance

- Completed pointer and object operations commit as atomic commands. Text editing uses a short debounce and is flushed on note switch, unmount, or page switch.
- A failed save keeps the editor dirty, exposes retry, and leaves the in-memory command available. Failures are not swallowed.
- The active-ink canvas draws coalesced pointer samples directly without React renders. Committed paths and bounds are cached, stable layers redraw only when the model or viewport changes, and objects outside the expanded viewport are culled.
- Canvas backing dimensions are clamped. Imported point counts, coordinates, text lengths, object counts, page counts, and resources are bounded before allocation.
- Stress verification covers long strokes, thousands of strokes/objects, repeated undo/redo, zoom extremes, resize, reload, and interrupted gestures.

## Accessibility and responsive behavior

Toolbars use real buttons with names, pressed states, keyboard shortcuts, visible focus, and no color-only status. Save and selection changes have polite live regions. Text-like objects remain keyboard focusable. A non-visual selection summary provides object type and bounds. Motion is minimal and respects reduced-motion preferences.

Desktop keeps the shared three-pane shell. Compact layouts show the existing back/title bar and prioritize the surface. Tool controls collapse into a horizontally scrollable, dense toolbar; important drawing tools remain reachable at touch size. Dark mode keeps the deep blue-teal chrome, neutral controls, and explicit Paper surface choice instead of recoloring every page automatically.

## Migration sequence

1. Normalize catalog notes in memory and on the next ordinary note write; do not rewrite every existing note during startup.
2. Open Dexie version 3. Existing v1/v2 tables remain unchanged; new stores start empty.
3. Opening a Paper or Canvas note calls `ensureSpatialDocument(note)`. If no descriptor exists, create the deterministic schema-1 defaults and one Paper page where applicable.
4. Migrate only rows whose own `schemaVersion` is older, in a transaction. Unknown future versions are rejected with an actionable editor error rather than guessed.
5. Backup import remaps and writes spatial records only after the entire payload validates.

This sequence keeps existing documents byte-for-byte intact and makes migrations deterministic, explicit, and restart-safe.
