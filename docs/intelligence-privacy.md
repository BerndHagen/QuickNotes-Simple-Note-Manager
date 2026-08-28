# Intelligence privacy

Recognition settings are owner-scoped and stored locally. The three modes are:

- **Off:** no recognition provider may run. Normal notes, Paper, Canvas, resources, and Task 3 lexical search continue to work.
- **Local only (default):** local providers and native extraction may run. Browser-managed and external operations explain that they are unavailable.
- **External allowed:** browser-managed or external providers may run only after the current operation presents a disclosure and the user confirms it.

`confirmExternalEveryTime` is enforced by normalization and cannot be disabled. Enabling external processing does not grant standing access to the notebook.

## Processing labels

- **Local:** user source data is processed in the QuickNotes browser context. Model/language files may still be downloaded.
- **Browser-managed:** the browser or operating system controls processing and may use a service. QuickNotes cannot honestly claim it is on-device.
- **External:** QuickNotes deliberately transfers the disclosed input to a configured remote provider through an authenticated server boundary.

Current local providers are Tesseract OCR and PDF.js text extraction. Current browser-managed providers are supported browser handwriting and live speech-recognition APIs. The optional external provider transcribes a selected canonical audio file through an authenticated Supabase Edge Function only after a live capability check and per-operation confirmation. Its vendor credential is a server-held Edge Function secret; an absent or invalid secret produces an unavailable state and no action.

## Data minimization

Operations use the selected image, PDF pages, ink strokes, or recording session—not the whole library. Provider jobs persist stable source IDs and safe errors, not binary input, credentials, or raw provider responses. Recognized output is bounded, validated, and stored with provider provenance. Derived search projections are owner-scoped and rebuildable.

For audio-file transcription, the existing capture synchronizer uploads the canonical source before the authenticated function runs. The function verifies the owner, note-resource link, private Storage path, size, MIME type, and checksum, then applies a per-user server-side quota. Off and Local-only modes never invoke that path. Cancelling prevents a remote result from being committed locally, but it cannot guarantee cancellation of provider processing that has already begun.

Supabase capture tables and the private `quicknotes-resources` bucket use authenticated owner/note policies. The bucket path starts with the authenticated user ID. The dedicated capture adapter authenticates Storage uploads with the current Supabase session, keeps binary data out of the database outbox, validates checksums on hydration, and synchronizes recognition corrections without changing provider provenance. This content synchronization is separate from recognition processing policy: choosing Local only prevents external recognition fallback, but an authenticated cloud workspace may still synchronize canonical files and user data through the normal QuickNotes sync feature.

If a provider fails or consent is denied, the source remains usable and no empty recognition record is created.
