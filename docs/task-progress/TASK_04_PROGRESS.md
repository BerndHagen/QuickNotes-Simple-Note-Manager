# Task 4 progress

Status: **In progress — not genuinely complete**

Task 4 is being implemented in dependency order. The capture/recognition foundation, its primary local/browser-managed workflows, owner-scoped cloud persistence, and the restartable imported-audio transcription implementation are coherent and buildable, but successful operation of the deployed external provider still requires a validated server-held secret and significant P1/P2 intelligence work remains. Task 5 has not been started.

## Genuinely completed

- Added the versioned canonical `RecognizedContent` model with stable source identities, regions/time ranges, provider/model provenance, processing location, source fingerprints, correction ownership, and current/stale/superseded lifecycle.
- Added owner-scoped Dexie v5 stores for recognized content, intelligence jobs/settings, canonical resource links/blobs, and recoverable recording chunks without rewriting existing note content.
- Added a capability-specific provider registry and typed provider failures. React surfaces do not call OCR/PDF/handwriting/speech libraries directly.
- Added privacy modes Off, Local only, and External allowed. Browser-managed/external processing requires operation-level confirmation every time; blanket consent cannot be persisted.
- Added a bounded priority job service with persisted status/progress, concurrency limits, cancellation, retry, reload recovery, safe errors, and source-only job records.
- Generalized canonical resources to PDF/audio, kept binary Blobs out of HTML/`noteData`, added reference-aware collection, recoverable five-second recording chunks, and backup/import v4 coverage.
- Implemented real local printed-image OCR with Tesseract.js workers, correction-preserving reruns, source selection/navigation, stale invalidation, and Task 3 indexing.
- Implemented PDF.js native text extraction before optional local OCR of pages without useful text. Results are page-attributed, cancellable, correctable, searchable, and navigate back to the PDF resource/page.
- Implemented bounded audio recording, playback, interrupted-session recovery/discard, and optional browser-managed live speech recognition for new recordings where supported. Final segments retain approximate timestamps, corrections, search navigation, and original-audio linkage.
- Implemented an optional restartable transcription path for imported and previously recorded audio. It uses the existing provider registry and durable job queue, syncs the canonical source before an authenticated Edge Function reads it from private Storage, validates the source fingerprint, and writes bounded timestamped `RecognizedContent` through the existing search/navigation/task/cloud paths.
- Added a live server capability check and per-operation External-allowed consent. Local-only mode never invokes or uploads to the transcription provider; local workspaces, unavailable server credentials/models, and files over the 24 MB provider boundary show an honest unavailable state without a dead action.
- Added correction-preserving transcript replacement. Time-overlapping segments retain stable recognition IDs, user text, and correction ownership across reruns or live-to-file provider upgrades; obsolete segments become superseded and the canonical audio is never changed.
- Made persisted intelligence work owner-aware across reload and account switching. Selecting another workspace suspends mismatched running work to its durable queue, prevents cross-owner commits, and resumes only the active owner's source-fingerprint-validated jobs.
- Implemented real browser/operating-system handwriting recognition where the WICG API is supported. It consumes canonical stroke vectors, preserves ink, supports correction/rerun and explicit ink-to-editable-text, and atomically marks recognition stale when source strokes change.
- Integrated current recognized text into the Task 3 lexical projection at a lower weight than title/headings with precise spatial, PDF, and audio locations.
- Added explicit deterministic task creation from handwriting, image OCR, PDF text/OCR, and transcript segments. It creates only the existing canonical Todo task, stores a bounded versioned source locator, and adds an explicit Task Center action back to the original capture.
- Extended backup/import validation and identity remapping to the recognized-content task bridge, so imported task sources retain valid remapped note, recognition, resource, page, and object identities or reject atomically when their source graph is incomplete.
- Added a dense, responsive attachments/recordings surface and Recognition privacy settings without adding an AI dashboard or permanent assistant panel.
- Added Supabase migrations for owner/note-scoped `note_resources`, `recognized_content`, expanded resource metadata, a private MIME-limited Storage bucket, RLS, identity-hardening triggers, orphan cleanup guards, and covering foreign-key indexes.
- Added a dedicated Task 4 client adapter for canonical PDF/audio resource metadata and bytes, note-resource links, recognized content, and user corrections. It uses an owner-scoped Dexie outbox, dependency-ordered upload/delete, correction-aware first-sync merge, checksum-validated hydration, realtime-triggered refresh, retryable failure behavior, and an explicit v6 first-pull marker without routing capture rows through the Task 2 spatial synchronizer.
- Added resumable authenticated TUS uploads for payloads over 6 MB with the required 6 MB chunk size and direct Supabase Storage host. Small files retain the ordinary Storage path, and metadata-only changes do not upload immutable source bytes again.
- Added remote lifecycle migrations that publish the three capture tables to Realtime with full replica identity and retain a resource row/Storage object while any remote note link, spatial placement, or recognition provenance still references it. The cleanup guard is private and no public security-definer cleanup RPC is exposed.
- Unified local and remote orphan checks across note links, spatial placements, and recognized provenance. Removing an image placement now keeps the OCR source while its recognition becomes stale; removing the final recognition collects the true orphan and queues the correct Task 2 image or Task 4 PDF/audio deletion path.
- Upgraded PDF.js to the patched 6.2.108 release after the package audit identified the malicious-PDF scripting advisory; the local extraction/rendering workflow continues to run with evaluation disabled.
- Added Task 4 documentation for capture/recognition, handwriting, OCR, audio/transcription, provider/AI boundaries, semantic-search status, and intelligence privacy.

## Important architectural decisions

- Original notes, strokes, images, PDFs, and audio are canonical. Recognition and search projections are attributable derived/enrichment data and never destructively replace the source.
- Stable recognition IDs remain the full provenance authority. A task copies only the recognition ID and bounded navigation fallbacks, avoiding thousands of stroke IDs in canonical `noteData`.
- Tesseract and PDF.js are local. Browser handwriting and speech are browser-managed because QuickNotes cannot guarantee that platform processing is on-device.
- Local-only is the default. Provider selection never silently falls back to a less-private location.
- Text correction changes searchable text while retaining machine output. Reruns preserve corrected text.
- Spatial source invalidation is committed in the same Dexie transaction as changed/deleted source objects.
- Task 4 cloud persistence is a dedicated adapter and outbox namespace. Storage bytes are committed before metadata, remote dependencies are written resource → link → recognition and removed in reverse order, and Task 2 spatial synchronization remains unchanged.
- Corrections outrank machine-only recognition during first-sync and concurrent pull comparison. Otherwise the newest record wins; machine text and provider provenance are never replaced by correction text.
- External audio transcription sends canonical note/resource identity—not arbitrary client bytes or credentials. The server revalidates the authenticated source graph, Storage path, MIME type, size, and SHA-256 fingerprint before provider transfer. Provider results remain attributable derived data.
- External capability is determined live. Deploying a function alone does not expose a control; a signed-in capability probe must validate the server-held credential and model first.
- Semantic/generative interfaces are reserved boundaries only. No fake embeddings, chatbot, task extraction, math, or provider controls are shown.

## Definition-of-done audit

Completed foundation/workflows:

- Clean provider boundaries; useful Off/local-only operation; explicit local/browser-managed classification and consent.
- Canonical sources and attributed, correctable recognition output.
- Real supported-browser handwriting; non-destructive ink-to-text; Task 3 indexing/navigation; stale ink invalidation.
- Real local image OCR; native PDF text first; scanned-page OCR; PDF page navigation.
- Canonical audio resources; optional live transcript; timestamp correction/search/playback navigation; and a restartable, retryable, correction-preserving imported-audio job path through the authenticated external-provider boundary.
- Canonical task creation from recognized/transcribed text and task-source navigation.
- Bounded/cancellable OCR, PDF, handwriting, and imported-audio job architecture; reload/account-switch recovery; responsive capture surfaces.
- Offline-first Task 4 persistence plus owner-scoped resource/link/recognition upload, hydration, correction sync, retry, Realtime refresh, reference-aware remote deletion, and resumable large-file Storage upload.
- Existing Task 1 shell, Task 2 surfaces, and Task 3 search/knowledge system remain canonical.

Partial or not yet complete:

- The connected project has the authenticated audio transcription function deployed, but a successful real provider request is not yet verified: the available Supabase MCP cannot inspect or set Edge Function secrets and no authenticated QuickNotes test-account credentials were available. Until the live capability probe validates `OPENAI_API_KEY` and `whisper-1`, the UI correctly keeps file transcription unavailable.
- Image/PDF annotation overlays, ink-to-shape, reminders tied to task/anchor identities, and a complete Meeting recording/transcript/action workflow remain.
- Robust sharing UX/comments/mentions were not expanded; existing note sharing remains authoritative and spatial realtime collaboration is not claimed.
- AI text actions, grounded Q&A, link/tag/task suggestions, semantic embeddings/search, stale-vector handling, and semantic Smart Views are not implemented.
- Ink-to-math, diarization, browser clipper, camera-scan refinement, and local model management are not implemented.

Therefore Task 4 does not yet satisfy its full definition of done.

## Known issues and limitations

- Browser handwriting and speech APIs are platform-dependent and absent in many browsers. Unsupported actions are omitted or explained.
- Browser speech segment timestamps are capture-time approximations, not authoritative audio timecodes.
- External audio-file transcription requires a signed-in cloud workspace, External-allowed mode, fresh per-operation consent, an operational server-held provider secret, and a source no larger than 24 MB. Larger recordings remain canonical and playable but are not chunk-transcribed.
- Cancelling an external job prevents its result from being committed and aborts the client request, but cannot guarantee that already-started upstream provider processing stops. The current `whisper-1` model reference is a provider-managed alias rather than a pinned model revision.
- PDF native text currently navigates/highlights at page level rather than word-level geometry.
- Tesseract language model startup may require a network download even though user image processing remains local.
- Capture synchronization currently owns the active user's resource graph. Existing shared-note authorization remains authoritative, but collaborator-authored capture resources, live correction conflict UX, and revocation UX are not claimed as complete collaboration support.
- A newly connected device hydrates canonical PDF/audio payloads sequentially so they remain available locally; very large libraries can therefore take time and browser storage. Failed downloads remain visible as sync failures rather than producing metadata-only ghost attachments.
- The production build reports the existing large RichTextEditor chunk advisory and a large PDF worker asset; neither is a build failure.

## Verification actually performed

- `npm test -- --run src/lib/taskSources.test.js src/lib/workspaceTasks.test.js src/lib/intelligence src/lib/resources` — 12 files, 29 tests passed.
- `npm test` — 86 files, 343 tests passed after the final task-source backup/import remapping changes.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npx playwright test e2e/intelligence-capture.spec.js e2e/pdf-capture.spec.js e2e/daily-workflows.spec.js e2e/spatial-editors.spec.js e2e/knowledge-system.spec.js --project=chromium` — 12 tests passed, covering real local Tesseract OCR, native PDF extraction, reviewed canonical task creation/source return, Task Center, mobile workflows, Task 2 spatial editors, and Task 3 knowledge/search behavior.
- `npx playwright test e2e/intelligence-privacy.spec.js --project=chromium` — passed the default local-only mode, persisted External mode, explicit browser-managed disclosure, responsive layout, dark mode, and Axe checks before restoring Local only.
- `npx playwright test e2e/pdf-capture.spec.js --project=chromium` — passed again from the final production build after adding the loading-boundary assertion to the dark-state capture.
- `npm test -- --run src/lib/capture/cloud.test.js src/lib/resources/repository.test.js src/lib/intelligence/repository.test.js src/lib/knowledge/migration.test.js src/lib/spatial/repository.test.js src/store/sync.test.js` — 6 files, 35 tests passed for outbox ordering, corrections, metadata-only updates, reference-aware deletion, resumable upload, failed-payload retry, empty-device hydration, local-only behavior, migration preservation, and store reconciliation.
- `npm test` — 87 files, 350 tests passed after the dedicated adapter, PDF.js security update, and final recognition-aware resource-lifecycle correction.
- `npm audit --omit=dev` — found 0 vulnerabilities after upgrading PDF.js to 6.2.108.
- `npx playwright test e2e/intelligence-privacy.spec.js e2e/pdf-capture.spec.js --project=chromium` — 2 tests passed from the production build; PDF extraction passed once more after the PDF.js update.
- `npx playwright test e2e/pdf-capture.spec.js e2e/spatial-editors.spec.js --project=chromium` — 4 tests passed from the final production build, covering the PDF capture/search/source-return workflow and representative Paper/Canvas desktop, compact, reload, undo/redo, and high-DPI behavior.
- `npm test -- --run src/lib/intelligence src/lib/resources src/store/sync.test.js` — 13 files, 40 tests passed for identity-only provider invocation, capture-sync ordering, source-fingerprint rejection, bounded result validation, correction-preserving reruns, obsolete-segment supersession, durable job retry/cancellation, and owner-switch suspension/recovery.
- `npm test` — 89 files, 356 tests passed after the imported-audio implementation and lazy backend-dependency fix for offline/component-test isolation.
- `npm run lint` and `npm run build` — passed after the final implementation. The production build retains the existing RichTextEditor chunk and PDF worker advisories only.
- `npx playwright test e2e/audio-file-transcription.spec.js e2e/intelligence-privacy.spec.js e2e/pdf-capture.spec.js e2e/knowledge-system.spec.js e2e/daily-workflows.spec.js --project=chromium` — 10 tests passed from the production build, covering honest unavailable audio-file UI, desktop/compact/dark rendering, no compact horizontal overflow, Axe, privacy persistence, native PDF extraction/source return, Unicode/Canvas lexical search, stable knowledge links, Task Center, mobile layout, and recurring tasks.
- The imported-audio attachment UI was rendered and inspected at 1440×900 light, 390×844 compact, and 1440×900 dark. Controls remain dense and contextual; the unavailable deployment state does not expose a fake transcription action.
- The attachments, privacy, OCR review, and recognized-task UI were rendered and inspected at 1440×900 light, 390×844 compact, and 1440×900 dark. The compact task form has no horizontal overflow and the final dark capture shows the actual review dialog rather than an in-flight loading fallback.
- Supabase project `cjlcgoatorfakxrkwunm` accepted all seven Task 4 migrations. Rollback-only authenticated lifecycle probes created metadata/link/recognition, preserved machine output through correction, retained resources referenced by a note link or recognition, and removed each final orphan without leaving rows or Storage objects.
- The `transcribe-audio` Edge Function is deployed active with JWT verification. An anonymous capability request returned 401. MCP/SQL inspection confirmed the quota table has RLS enabled, neither `anon` nor `authenticated` can read it or execute its claim function, and only `service_role` can claim capacity. The table stores only owner/window/count/bytes, not source or transcript content.
- Final MCP inspection confirmed all three capture tables in Realtime with full replica identity, the enabled private resource guard, and zero probe residue. The security advisor reports the intentional no-browser-policy info for the private quota table plus the pre-existing leaked-password-protection Auth setting; performance findings are informational unused-index notices.
- A successful authenticated provider transcription is explicitly not claimed because the Edge Function secret could not be inspected/configured with the available MCP and no authenticated test workspace credentials were available. The capability-gated unavailable state was tested instead.
- The obsolete `.tmp-trace-intelligence-2/` verification directory was removed; it contained only disposable Playwright trace artifacts.

## Next Task 4 work

1. Configure/verify the server-held `OPENAI_API_KEY` and run one authenticated real-file transcription against the deployed function; keep the action capability-gated until that operational check succeeds.
2. Complete reminder and Meeting integration around canonical task/source identities.
3. Add the remaining annotation/ink-to-shape workflows in dependency order.
4. Implement remaining P1/P2 semantic/generative features only through real configured providers and review-first UX.
