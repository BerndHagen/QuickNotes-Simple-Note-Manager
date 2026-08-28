# Performance baseline

Performance is evaluated on production assets, not only unit models. The
baseline targets modern evergreen desktop/mobile browsers with IndexedDB,
Canvas, Pointer Events, ES modules, and workers.

## Architecture controls

- Search uses owner-scoped derived documents and MiniSearch; corrupt projections
  rebuild from canonical data.
- Paper/Canvas draw active ink through refs and high-DPI canvas without a React
  state update per pointer point. Stable layers cache paths and cull objects.
- Large PDF/OCR/editor modules are lazy or worker-backed. Canonical binary
  payloads are not base64-expanded in the normal database/archive path.
- Sync queues are bounded by identity coalescing and adapters process explicit
  dependencies. Capture hydration is sequential to bound concurrent memory.
- Catalog counts are computed in a single pass; a 10,000-note import uses bulk
  validation/remapping and bulk IndexedDB writes.

## Current automated evidence

- `npm run benchmark:search` indexed 50,000 documents in 3,169 ms, answered the
  benchmark query in 3.8 ms, and used 180 MB in the 2026-08-28 audit run.
- A generated 10,000-note import validates/remaps atomically, and a generated
  10,000-stroke Canvas graph persists and reopens from per-object rows without
  a monolithic snapshot. Queue replay, long strokes, repeated undo/redo, and
  migration fixtures are also automated.
- Production browser workflows cover desktop/compact layouts, Paper/Canvas
  rendering, PDF/OCR, capture, Task Center, and multi-tab behavior.
- A bounded repeated browser run completed 36/36 multi-tab, Paper/Canvas,
  import, PDF export, and complete-archive round-trip cases. This is useful
  repetition evidence, but it is not represented as a multi-hour soak.
- The current production build succeeds. The lazy RichTextEditor bundle and
  PDF worker still emit size advisories; they are tracked performance debt, not
  hidden as failures.

Real Firefox, physical Safari/iOS/stylus hardware, multi-hour soak, forced OS
storage eviction, and maximum-size archives are not yet verified and must not
be claimed from emulation alone.
