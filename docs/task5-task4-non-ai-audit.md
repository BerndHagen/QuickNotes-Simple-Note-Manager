# Task 5 audit: required non-AI Task 4 scope

Audit date: 2026-08-28

This audit uses the complete original Task 4 specification and the current repository. `TASK_04_PROGRESS.md` is historical context only. External provider-backed generative features, semantic search/embeddings, grounded Q&A, and paid-provider verification are deferred by product decision and are not assessed as release blockers here.

## Result matrix

| Area | Result | Repository evidence | Failure-oriented evidence |
| --- | --- | --- | --- |
| Provider/privacy/provenance foundation | PASS | `src/lib/intelligence/`, `src/lib/intelligence/repository.js`, `src/lib/intelligence/providers.js`, Recognition settings and capture UI | Provider/job tests verify typed capabilities, processing location, cancellation, fingerprint validation, owner switching, and Local-only isolation. Unconfigured external audio remains unavailable rather than mocked. |
| Handwriting, image OCR, PDF extraction/OCR, source navigation | PASS | Browser handwriting provider; Tesseract image OCR; PDF.js native extraction before optional OCR; `RecognizedContent` locations feed Task 3 lexical search | Existing intelligence/PDF production tests navigate from results back to the stable spatial object, resource, page, or transcript location. Original sources remain unchanged. |
| Canonical audio and recording durability | PASS | `AudioRecorder.jsx`, resource repository, five-second recording chunks, recovery/discard UI, audio playback and transcript-seek handling | Repository tests atomically promote saved chunks to a resource. Interrupted recordings remain recoverable. Start/pause/resume/stop and transcript separation are implemented; browser speech remains capability-dependent. |
| Meeting recording/transcript/action workflow | PASS | `MeetingNotesEditor.jsx`, `ResourceManagerModal.jsx`, `RecognitionTaskModal.jsx`, canonical Todo/task-source utilities | Production Chromium creates a Meeting, attaches audio/transcript data, reloads, reviews transcript text, creates a canonical action and decision, opens the source, and assigns a reminder. No separate transcript-task model exists. |
| Reminder integration | PASS | `src/lib/reminders.js`, Reminder modal, Today/Task Center aggregation, normalized source locator | Unit tests cover stable task sources across rename, trigger/snooze/complete, and recurring advancement. Backup tests remap reminder note/resource/recognition identities. |
| PDF annotation | PASS | `AttachmentAnnotationModal.jsx` and `SpatialAnnotationOverlay.jsx` reuse Task 2 brushes, geometry, selection, history, object model, and rendering | Production Chromium draws a non-destructive PDF overlay, reloads it, and verifies desktop/compact/dark behavior. Repository and cloud tests cover graph persistence, duplication, deletion, hydration, and conflicts. |
| Image annotation | PASS | A selected Paper/Canvas image exposes the same attachment annotation modal and canonical overlay graph; spatial image payload remains the source | Production Chromium draws an image overlay, reloads it, and verifies that the canonical image data URL is byte-for-byte unchanged. The workspace owner is now passed explicitly to cloud hydration/conflict handling. |
| Ink-to-shape | PASS | `shapeRecognition.js` proposes conservative line/arrow/rectangle/ellipse candidates; conversion is explicit and applies through Task 2 commands | Unit tests decline small/open/ambiguous/highlighter marks. Production Chromium converts selected ink, retains the hidden source stroke and timing for replay, then verifies undo, redo, and reload. |
| Capture/resource local persistence | PASS | Owner-scoped Dexie resources, blobs, note links, recognized rows, recording chunks, annotation graphs, and dedicated outboxes | Tests cover payload separation, final-reference collection, correction preservation, failed upload retention, empty-device hydration, and no cloud outbox in local mode. |
| Capture/resource cloud sync | PASS | Dedicated Task 4 capture and annotation adapters; Task 2 spatial sync is not overloaded | Tests cover resource-before-link/recognition ordering, resumable upload, dependency-ordered deletes, checksum hydration, retry, Realtime refresh, and annotation graph ordering. |
| Concurrent correction/annotation conflicts | PASS after Task 5 fixes | Transcript conflicts are durable in capture sync state; annotation revision/deletion conflicts are durable in annotation sync state; both surfaces expose explicit incoming/local choices | Deterministic tests prove two corrected transcripts are not collapsed and pending annotation edits survive a remote update/deletion. Editing is blocked while an annotation conflict is unresolved. |
| Paper/Canvas same-owner conflicts | PASS after Task 5 fixes | Spatial sync has its own owner-scoped durable marker/conflict store and does not reuse the catalog or capture adapters | Deterministic tests cover concurrent revision, remote deletion, reload reconstruction, incoming/local resolution, dependency-ordered queue drain, and confirmed parent permanent deletion winning over a later orphaned child revision. |
| Sharing and permission behavior | PASS | Sharing UI shows view/edit state; shared capture graphs hydrate under their source owner; shared Paper/Canvas/resources remain read-only because concurrent spatial editing is explicitly deferred | Live rollback-only two-tenant RLS probes: unrelated user visibility and writes were zero; view share read all capture/annotation rows but could not correct; edit share could correct recognized text; annotation mutation remained owner-only. |
| Revocation and local derived cleanup | PASS | `purgeSharedNoteCache` removes foreign spatial/capture/annotation rows, lexical/knowledge/semantic projections, and only truly orphaned local resources | Unit test retains a resource still referenced by another note and collects the final orphan. Live probe showed every capture/annotation row became invisible immediately after share revocation. |
| Backup/import | PASS for Task 4 graph | Binary `.qnotes` archive includes resource payloads, note links, recognized corrections, annotation documents/pages/objects, reminders, and task-source locators | Tests validate checksums, remap the complete graph, reject missing references atomically, and preserve corrected recognition and reminder/task navigation identities. |
| Comments/mentions | PASS where supported | Stable note/anchor/object comment schema, participant/mention resolution, real authenticated recipient identities | Component/unit tests cover anchored comments and participants. No spatial realtime cursor or unsafe custom OT claim is made. |
| Ink-to-math, diarization, camera refinement, browser clipper | N/A (optional/evaluated) | No fake visible controls. Provider/data boundaries allow future implementations without changing canonical sources | Task 4 explicitly permits deferring robust math recognition and conditions diarization/camera/clipper on capability/feasibility. Their absence is not represented as implemented functionality. |

## Live authorization probe

The connected Supabase project `cjlcgoatorfakxrkwunm` was tested with real existing tenant identities and rollback-only fixtures.

- Without a share, tenant B saw zero rows in `resources`, `note_resources`, `recognized_content`, `spatial_annotations`, `spatial_annotation_pages`, and `spatial_annotation_objects`; unauthorized recognition updates and annotation deletes affected zero rows, and a cross-tenant resource insert was rejected by RLS.
- With a `view` accepted share, tenant B could read all six graph layers but could not update the recognition row.
- With an `edit` accepted share, tenant B could update recognized text. Annotation updates still affected zero rows, matching the product’s intentional shared-read-only spatial behavior.
- After removing the accepted share, all six graph layers immediately returned zero rows to tenant B.
- The transaction was rolled back and a separate residue query returned zero probe resources, links, recognition rows, annotations, and shares.

## Defects found and corrected during this gate

1. Concurrent user-corrected transcript text used a timestamp winner and could silently discard one correction. It now persists a conflict and requires an explicit choice.
2. A remote annotation deletion or newer graph could erase pending local annotation edits. Pending graphs now remain durable and blocked from upload until explicitly resolved.
3. Equal annotation revision with a later server timestamp could create a false conflict. Versioned graphs now use revision as the authority and timestamp only for legacy markers.
4. Selected-image annotation did not pass its workspace owner to the cloud adapter. It now uses the actual spatial document owner, and a production image-overlay test protects the integration.
5. Same-owner concurrent Paper/Canvas changes lacked a durable conflict decision and could accept the latest remote graph. Spatial markers/conflicts now survive reload, block unsafe editing, and require an explicit incoming/local choice.

## Deferred provider operation

Imported-audio provider transcription remains honestly unavailable because `OPENAI_API_KEY` is not configured. The authenticated server boundary, live capability gate, source validation, durable job path, correction handling, and unavailable UI remain present. A successful paid-provider request is an operational verification item for a later product decision; no mock result is counted as verification.

## Gate conclusion

The required non-AI Task 4 scope listed by the user is present in the current repository and has direct code, unit/integration, production-browser, backup, and live-RLS evidence. This is a Task 5 sub-gate result, not a final release-readiness conclusion; the remaining Task 5 data safety, recovery, multi-tab/offline, quota, PWA, stress, accessibility, and complete backend audits still apply.
