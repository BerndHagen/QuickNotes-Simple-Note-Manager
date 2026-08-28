# AI architecture

QuickNotes intelligence is capability-based and optional. `IntelligenceProviderRegistry` defines separate contracts for handwriting, OCR, PDF text, transcription, math, embeddings, translation, and generative assistance. Each provider declares a stable ID, capability, processing location, offline support, model identity, language support, and transfer-consent requirement.

React surfaces call QuickNotes services, never vendor SDKs directly. Policy resolution prefers allowed local providers and does not silently fall back to external processing. Provider failures use safe typed categories and raw remote responses are not stored in note data.

## Current providers

- Local Tesseract printed-text OCR.
- Local PDF.js native text extraction.
- Browser-managed WICG handwriting recognition where supported.
- Browser-managed live speech recognition where supported.
- Optional external `whisper-1` audio-file transcription through an authenticated Supabase Edge Function. A live server capability check keeps the action hidden when the server-held provider secret/model is unavailable.

No generative assistant, grounded Q&A provider, semantic embedding provider, or math recognizer is shipped. Reserved interfaces are architectural boundaries, not advertised functionality.

The audio-file provider is the first external capability implementation. The browser sends canonical source identity rather than provider credentials or an arbitrary upload. The Task 4 capture adapter durably synchronizes the source, the server revalidates the owner/source graph and checksum, and the persisted intelligence job commits only bounded, attributable transcript segments. A deployed function without a validated server secret is treated as unavailable, not as a configured feature.

## Generative safety contract

Future generative actions must be contextual—not a permanent assistant panel—and must disclose selected scope, provider, processing location, and transfer. Output must be bounded and untrusted, shown as a draft/diff, and applied through canonical editor transactions only after review. AI must not autonomously delete content, change sharing, create tasks/tags/links, or overwrite user-corrected recognition.

Provider secrets belong in authenticated server-side functions. They must not enter client environment variables, note content, IndexedDB jobs, logs, backups, or source control.
