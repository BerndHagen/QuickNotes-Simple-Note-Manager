# Intelligence and capture architecture

Task 4 extends the existing QuickNotes note, spatial, resource, and knowledge systems. It does not create an AI workspace or a second catalog. The original note, ink, image, PDF, or audio remains the source material. Recognition adds attributable, reviewable content to that source.

## Design constraints

- QuickNotes remains fully useful with intelligence disabled and while offline.
- No user content is sent to an external service without an enabled cloud-processing policy and operation-level disclosure.
- Recognition, transcription, translation, embeddings, and generative assistance use QuickNotes-owned provider interfaces. React components do not call vendor SDKs directly.
- Machine output is untrusted, bounded, and sanitized before persistence or display.
- Expensive work uses one bounded, cancellable job service. Manual work outranks automatic indexing.
- Task 1 chrome, Task 2 content engines, and Task 3 lexical knowledge/search remain canonical.

## Sources, resources, and binary payloads

The source hierarchy is:

```text
Note
  -> Document content or structured noteData
  -> Paper/Canvas spatial document
       -> page/object/stroke
  -> resource metadata
       -> immutable binary payload
  -> recognized content
       -> source locator + source fingerprint
```

Resources are shared attachment records, not editor-specific blobs. Task 4 broadens the image-only contract to `image`, `pdf`, and `audio`. Metadata contains stable identity, owner, MIME type, byte size, file name, checksums/fingerprints, dimensions/duration/page count where known, and timestamps. Binary payloads live in a separate IndexedDB store so audio and PDFs are never embedded as base64 in `note.content`, `noteData`, or spatial object JSON. Spatial image placements continue to reference the resource ID.

Locally imported files are canonical user data. Deleting a placement does not delete a resource while any note, placement, transcript, OCR row, or task source still references it. Trash preserves resources. Permanent deletion performs reference-aware collection.

Backups carry resource metadata and encoded binary payloads as separate bounded records. Import validates count, MIME allowlists, declared and actual size, identity uniqueness, and references before committing. Cloud binary synchronization stays behind the dedicated Task 4 adapter and private Supabase Storage; provider input is never read directly from arbitrary URLs. Source bytes are uploaded before metadata, downloads are checksum-validated before an atomic local commit, and metadata-only updates do not resend an unchanged payload. Files over 6 MB use authenticated resumable TUS uploads with fixed 6 MB chunks; the TUS client is loaded only for that path.

## Recognized content and provenance

`RecognizedContent` is the common persisted record for OCR, handwriting, native PDF text, and transcripts:

| Field | Meaning |
| --- | --- |
| `id`, `ownerId`, `noteId` | Stable owner-scoped identity and catalog parent |
| `sourceKind` | `ink`, `image`, `pdf`, or `audio` |
| `sourceResourceId` | Image/PDF/audio resource, if applicable |
| `sourceObjectIds` | Stable spatial source objects/strokes, bounded and sorted |
| `sourcePageId`, `sourcePageNumber` | Paper or PDF page locator |
| `sourceRegion` | Optional source-local rectangle |
| `sourceTimeRange` | Optional audio start/end milliseconds |
| `type` | `handwriting`, `ocr`, `pdfText`, or `transcript` |
| `machineText` | Most recent bounded provider output |
| `text` | Searchable/display text, initially equal to `machineText` |
| `confidence` | Optional normalized 0–1 confidence; absence is not zero |
| `providerId`, `modelId`, `modelVersion` | Reproducible provider attribution |
| `processingLocation` | `local`, `browserManaged`, or `external` |
| `language` | BCP-47-style language hint/result where available |
| `sourceFingerprint` | Hash/revision fingerprint of the exact source input |
| `status` | `current`, `stale`, or `superseded` |
| `userEdited`, `editedAt` | Correction ownership |
| `schemaVersion`, `createdAt`, `generatedAt`, `updatedAt` | Contract and lifecycle |

Machine reruns update `machineText`. They update `text` only when `userEdited` is false. Corrected text is retained and the row can be marked stale when its source changes; it is never silently overwritten. A user can explicitly discard a correction or replace it with a new result.

Source fingerprints use canonical source revisions rather than recognized text. Ink fingerprints include stable object IDs plus their `updatedAt`/geometry data; resources use a content checksum; PDF and audio segments add page/time boundaries. Editing or deleting a source invalidates only affected rows. Re-indexing recognition never mutates the source.

## Source navigation

Task 3 search locations are extended, not replaced. A recognized location contains `recognitionId` plus the relevant note, resource, Paper page, source object/region, PDF page, or audio time range. Search navigation opens the existing note/editor and then:

- selects and centers a spatial object or Paper region;
- opens the referenced image/PDF at the stored page/region; or
- opens the recording and seeks to the stored start time.

Unavailable source material produces a clear diagnostic; it does not redirect to anonymous hidden text.

## Provider architecture

`IntelligenceProviderRegistry` exposes capability-specific contracts rather than one universal AI method:

- `HandwritingRecognizer.recognizeInk(input, context)` accepts bounded canonical stroke vectors and returns text plus optional regions/confidence.
- `OcrRecognizer.recognizeImage(input, context)` accepts decoded, bounded image data and returns page/region text.
- `MathRecognizer.recognizeMath(input, context)` is reserved until a real provider is configured; no fake math conversion is shown.
- `SpeechTranscriber.transcribe(input, context)` accepts an audio resource/stream and returns bounded timestamped segments.
- `SemanticEmbeddingProvider.embed(input, context)` produces versioned rebuildable vectors.
- `AiAssistantProvider.generate(input, context)` handles explicitly scoped, review-first generative actions.
- `TranslationProvider.translate(input, context)` absorbs the existing translation service into the same disclosure/cancellation policy.

Every provider descriptor declares capability, processing location, offline support, supported input/languages, model identity, limits, and whether explicit transfer consent is required. The registry resolves providers against user policy, connectivity, capability, and input size. It never silently falls back from local to external processing.

Provider errors use typed categories (`unsupported`, `unavailable`, `permission`, `rateLimit`, `input`, `cancelled`, `provider`) and preserve safe diagnostics without persisting raw vendor responses.

## Selected implementation technologies

- Printed image OCR uses Tesseract.js in a worker and is classified as local processing. Language data/model downloads are disclosed and cached separately from user content. Tesseract is not represented as a handwriting recognizer and does not accept PDFs directly.
- PDF.js extracts native text first. Only pages without useful native text are rendered at a bounded scale for OCR. Page jobs are sequential or low-concurrency and cancellable.
- Audio recording uses `getUserMedia` and `MediaRecorder`; resulting Blob payloads are stored as resources. Recording is not transcription.
- Browser `SpeechRecognition` is classified as `browserManaged`, because browsers may send microphone audio to a server. It is never called local merely because no QuickNotes API key is used. On-device mode may be offered only after runtime capability and language-pack checks.
- Browser handwriting uses the WICG/Chromium Handwriting Recognition API where available and passes the canonical stroke vectors. It is classified as browser-managed because the operating system/browser controls whether recognition is on-device or service-backed. Unsupported browsers omit the action rather than calling OCR or returning fabricated text. A future external provider remains possible behind an authenticated server function.
- ONNX Runtime Web is an available boundary for future optional local models, but no large model is bundled or cached without an explicit model-management UX.
- Supabase `pgvector` is a possible opt-in cloud semantic implementation. Lexical Task 3 search remains primary; embeddings are derived, owner-scoped, versioned, and rebuildable.

## Background jobs

`IntelligenceJobService` owns one priority queue for `handwriting`, `ocr`, `pdfText`, `pdfOcr`, `transcription`, `semanticIndex`, `translation`, and `assistant` operations. Persisted job rows contain IDs, owner/note/resource/source identities, provider ID, priority, status, progress, attempt count, safe result references/errors, and timestamps. They never contain binary input or provider credentials.

Statuses are `queued`, `running`, `completed`, `failed`, and `cancelled`. Interactive jobs outrank automatic processing. The service uses bounded per-capability concurrency (initially one local inference/PDF/transcription job and at most two small network jobs), `AbortController`, cooperative page/chunk boundaries, and stale-owner guards. Closing a note cancels transient preview work; explicitly backgrounded work can continue. Reload converts abandoned `running` jobs back to a safe retryable state only when the provider supports restart from canonical input.

Progress is real provider/page/chunk progress, not a timer. Failed/cancelled jobs do not create recognition rows. A successful job commits validated recognition rows and then notifies the canonical knowledge projection.

## OCR and handwriting flows

Image OCR:

```text
user requests OCR -> policy/provider disclosure -> decode/downscale safely
-> local worker recognition -> validate regions/text -> transactionally persist
-> refresh Task 3 document -> navigate matches to image/region
```

PDF processing:

```text
import PDF resource -> enumerate bounded pages -> extract native text
-> persist page-attributed pdfText -> OCR only pages with no useful text when requested
-> index attributed rows
```

Handwriting:

```text
select strokes -> snapshot IDs/fingerprint -> disclose selected provider/location
-> recognize immutable stroke snapshot -> retain ink -> review result
-> keep searchable only, copy, or explicitly create editable text
```

Recognition never replaces ink automatically. Editing source strokes marks matching rows stale. Ink-to-shape is a separate explicit geometry command and must not treat ordinary handwriting as shapes.

## Audio and transcription flow

Recording permission is requested only after a user action. The UI exposes active recording state, elapsed duration, stop/cancel, storage size, and microphone failures. Cancel discards unsaved chunks and stops every media track. Stop stores one bounded Blob resource before offering transcription.

Transcripts are segment-based recognized content linked to the audio resource. Segment corrections preserve timestamps and set `userEdited`. Search results open the recording and seek to the segment. Meeting notes may start recording and create tasks from selected transcript text, but neither happens silently.

## Knowledge and task integration

Current recognized rows contribute to a dedicated `recognizedText` field in the Task 3 `SearchDocument`, with lower weight than title/headings and with source locations. Stale/superseded rows are excluded by default. The knowledge source fingerprint includes recognition revisions so successful recognition or corrections incrementally rebuild only the affected note. Raw ink and binary payloads are never tokenized.

Creating a task from recognized text writes the existing canonical task representation and adds a bounded source locator (`noteId`, `recognitionId`, and object/resource/page/time fields). Reminders continue to attach to canonical note/task identities. Recognition does not create implicit backlinks merely because output resembles a note title.

Semantic search later merges bounded semantic candidates with lexical results. Exact/title lexical matches retain their strong ordering. Embeddings and summaries are derived tables, excluded from backups unless user-edited, and invalidated by canonical source fingerprints.

## AI boundary

AI is disabled by default and never appears as a permanent assistant panel. An action provides the selected scope, provider/location, estimated input size, and whether data leaves the device. Generative output is previewed as a diff or separate draft; accepting it uses the existing editor transaction/version system. AI does not directly delete notes, share data, create tasks/tags/links, or overwrite corrected recognition.

Grounded Q&A may retrieve only notes currently accessible to the active owner. Responses must carry stable source references and must not intentionally include trashed, revoked, or inaccessible content. Provider prompts and responses are bounded and treated as untrusted.

## Collaboration and synchronization

Recognized rows are owner/note scoped and follow the note's authoritative access rules. User corrections are important user data and sync; machine-only results may be regenerated but use the same row contract. Background jobs and local privacy settings do not synchronize. Binary resources synchronize through a dedicated Task 4 storage adapter and metadata/RLS tables, not giant JSON columns or the Task 2 spatial queue.

The adapter has its own outbox table name and dependency order. It uploads resource bytes and metadata before note links and recognition, and deletes recognition and links before attempting final resource collection. Local reference checks and private database triggers retain a resource while a note link, spatial placement, or recognized provenance row still references it. First connection merges existing local capture data instead of treating an empty remote table as deletion; corrected recognition outranks machine-only output, then timestamps resolve ordinary last-write precedence. A v6 owner marker distinguishes that bootstrap from later authoritative pulls. Failed upload, download, checksum, RLS, or metadata operations remain queued/visible and do not manufacture a successful sync state.

Capture Realtime events schedule the existing full workspace synchronization entry point. They do not mutate Dexie directly from event payloads. This preserves one validation/merge path and lets the receiving device download Storage bytes before exposing the remote metadata locally.

Task 4 does not pretend to add conflict-free live ink, transcript, or spatial co-editing. Existing note sharing remains authoritative. Concurrent correction conflicts surface as ordinary record conflicts until a later explicit resolution model exists.

## Privacy and data flow

The simple policy is:

- **Intelligence off:** no recognition/AI calls; normal QuickNotes features work.
- **Local only (default):** local providers and native extraction may run; unavailable cloud-only actions explain why.
- **Allow external processing:** external providers may be used after the action names the provider, content type, and scope. Sensitive operations can require confirmation every time.

Provider credentials are never placed in note data, IndexedDB job rows, logs, source control, or client environment variables that expose secrets. External calls use authenticated server functions, bounded payloads, rate limits, timeouts, cancellation, and minimal logging. No full-library processing begins automatically.

## Migration and failure behavior

The IndexedDB migrations only add stores; they do not rewrite existing notes, spatial rows, resources, recognized corrections, or Task 3 projections. Version 6 adds only the owner-scoped capture first-pull marker. Unknown future schema versions are rejected. Intelligence may be disabled or its derived/job tables cleared without harming canonical notes and sources; user-corrected recognized rows require an explicit data-deletion choice.

If processing fails, the source remains available, the job records a safe actionable error, no empty recognition row is written, and retry starts from canonical input. Index refresh failures leave recognized content intact and expose the existing Task 3 rebuild path.

## Current delivery sequence

1. Persisted recognition, provider descriptors, privacy policy, bounded job queue, validation, and indexing/source navigation contracts.
2. Generalized resource/blob repository and backup/import migration.
3. Local image OCR and PDF native-text/OCR workflows.
4. Audio capture, browser-managed live transcription, correction, and timestamp navigation.
5. Browser-managed handwriting plus ink selection/review and stale-source handling.
6. Canonical task creation with capture-source navigation.
7. Dedicated capture resource/recognition cloud synchronization and remote lifecycle.
8. Restartable imported-audio transcription through the authenticated external-provider boundary, with capability gating and correction-preserving segment replacement.
9. Remaining reminder/Meeting integrations, then optional annotation, semantic, and generative features.

This order deliberately completes the capture/recognition foundation before optional AI surfaces.
