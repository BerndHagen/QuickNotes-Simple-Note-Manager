# Capture and recognition

QuickNotes adds attributable recognition to its existing content engines. Notes, Paper/Canvas objects, PDF files, images, and recordings remain canonical. Recognition never replaces the source.

## Canonical records

- `resources` stores bounded metadata for image, PDF, and audio sources.
- `resourceBlobs` stores binary payloads separately from note HTML and `noteData`.
- `noteResources` links a resource to a note without duplicating the binary.
- `recognizedContent` stores handwriting, OCR, PDF text, and timestamped transcript output with provider and source provenance.
- `intelligenceJobs` stores bounded, cancellable OCR/PDF/handwriting/transcription work. Jobs contain source identities and fingerprints, not binary payloads or provider credentials.

Recognition rows use stable note, resource, page, spatial-object, region, and time identities. They carry a source fingerprint, provider/model attribution, processing location, confidence when available, and `current`, `stale`, or `superseded` state. A correction updates the searchable `text` while retaining `machineText`; a rerun does not silently overwrite corrected text.

## User workflows

- A selected Canvas/Paper image can be processed with local printed-text OCR.
- Selected ink can use the browser/operating-system handwriting API where the runtime supports it.
- Attached PDFs use native PDF.js text extraction first and optional local OCR only for pages without useful embedded text.
- New recordings can optionally capture a browser-managed live transcript where browser speech recognition is supported.
- Imported or previously recorded audio can use a configured external provider through the authenticated server boundary after a live capability check and explicit per-operation consent. The action remains unavailable in Off/Local-only modes, for local-only workspaces, for sources over 24 MB, or when the server credential/model cannot be validated.
- Current recognition enters the lexical index. Search locations return to the selected spatial object, PDF page, or audio timestamp.
- A user can review recognized text and explicitly create a normal Todo task. The task stores a versioned source locator, and Task Center exposes a separate **Source** action.

## Persistence, backup, and limits

Dexie schema version 5 adds the canonical resource, recognition, job, and privacy stores without rewriting existing notes. Version 6 adds only an owner-scoped first-cloud-pull marker; it does not rewrite capture data. Workspace backup version 4 carries resource metadata, binary payloads, links, and recognition as bounded collections. Import validates all identities and references before committing them with the note catalog.

PDF payloads are limited to 150 MB, audio to 500 MB, PDFs to 10,000 declared pages, recognition text to 200,000 characters per row, and the local queue to 500 queued jobs. These are safety ceilings, not performance promises.

Supabase migrations add private Storage and owner/note-scoped metadata tables with RLS. A dedicated client adapter synchronizes PDF/audio resource metadata and bytes, note links, recognized rows, and corrections without using the spatial adapter. It keeps a durable local outbox, writes dependencies in safe order, validates downloaded checksums, uses resumable uploads above 6 MB, responds to capture-table Realtime events through the normal validated pull path, and collects a remote Storage object only after its final database reference disappears. Offline and local-only workspaces remain fully authoritative locally.

The optional audio-file provider consumes that canonical cloud source rather than accepting an arbitrary browser upload. Its Edge Function rechecks the authenticated resource graph and fingerprint, returns bounded timestamped segments, and writes no transcript content to its rate-limit table. Segment replacement is atomic and correction-preserving; the standard recognition, search, task-source, backup, and capture-cloud paths remain authoritative.

## Failure behavior

Failed or cancelled processing creates no empty recognition row. Sources remain usable, the job retains a safe actionable error, and supported jobs can be retried from canonical input. Editing or removing source ink/images marks matching recognition stale in the same spatial transaction. Deleting a placement collects a binary only after its final reference disappears.

See [handwriting-recognition.md](handwriting-recognition.md), [ocr.md](ocr.md), [audio-transcription.md](audio-transcription.md), and [intelligence-privacy.md](intelligence-privacy.md).
