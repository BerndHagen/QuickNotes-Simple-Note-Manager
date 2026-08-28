# Known limitations

This list describes the verified QuickNotes 3.x release boundary. It is not a
claim that QuickNotes is bug-free or cannot lose data.

## Release and operations

- Supabase Auth leaked-password protection is unavailable on the connected
  Free project and is not enabled for the hosted 3.0 release. This is an
  accepted operational limitation, not a claim that compromised passwords are
  screened. Deployments that require that protection should enable the
  applicable Supabase Auth plan/setting and rerun authentication smoke checks.
- The static GitHub Pages deployment cannot supply HTTP-only security headers
  such as CSP `frame-ancestors`. A production host should add anti-framing and
  the repository CSP at the response-header layer.
- Release tags must be created only from a clean reviewed commit that passes
  the normal release gate.

## Providers and platform capabilities

- Paid provider-backed AI, semantic embeddings/search, grounded Q&A, and a
  successful imported-audio provider request are deferred by product decision.
  Their controls remain capability-gated; no mock response is counted as proof.
- Browser speech and handwriting recognition depend on browser/operating-system
  support and may be unavailable or browser-managed. Local-only mode does not
  silently use them.
- Tesseract language data can require a network download before local OCR can
  start. PDF native text extraction remains local and PDF scripting is disabled.

## Collaboration and conflicts

- Shared Paper, Canvas, image/PDF annotations, and their resources are
  deliberately read-only for collaborators. QuickNotes does not claim realtime
  multi-writer spatial editing or collaborative spatial undo.
- Note, catalog, correction, annotation, and spatial conflicts preserve both
  sides and require review, but structured task data is resolved at the owning
  note payload boundary rather than by a field-level merge engine.
- A confirmed permanent deletion is an intentional tombstone and wins over
  unreviewed edits from another device. Ordinary Trash/restore operations use
  normal conflict review.

## Storage and performance

- A `.qnotes` archive is assembled in browser memory. The 1 GB format bound is
  not a promise that every browser/device can export that size; memory, Blob,
  and storage quotas can impose a lower ceiling.
- A new cloud device hydrates canonical PDF/audio payloads sequentially. Large
  libraries can take time and browser storage, and failures remain visible
  rather than producing apparently usable metadata-only attachments.
- The production build still reports a 787 kB minified RichTextEditor chunk and
  a 1.26 MB PDF worker asset. These are tracked performance debt.

## Verification boundaries

- Automated Chromium and iPhone-13 WebKit emulation are covered. Real Firefox,
  physical Safari/iOS, stylus hardware, native extreme zoom, OS storage
  eviction, abrupt process termination at every write boundary, and a
  multi-hour physical-device soak were not verified. The 3.0 release makes no
  certification claim for those environments.
- Service-worker install/offline reload and update safety are automated, but a
  true first-ever load cannot work offline because no application shell has yet
  been cached; this is the supported policy.
- External email delivery/abuse controls, provider retention, and successful
  paid-provider operation are operational responsibilities outside the
  provider-free audit.
