# Audio recording and transcription

Audio recording uses `getUserMedia` and `MediaRecorder` after an explicit user action. Chunks are committed to IndexedDB every five seconds so an interrupted recording can be recovered or discarded. Stop finalizes one bounded audio resource; cancel stops every media track and deletes the unsaved session.

## Live transcript

Where browser `SpeechRecognition` is available, a user can opt into a live transcript before recording. This provider is classified as **browser-managed** because the browser or operating system may send microphone audio to a service. It requires **External allowed** privacy mode and explicit consent for that recording session.

Final speech results become bounded `RecognizedContent` segments linked to the audio resource with approximate capture-time start/end positions. Interim text is transient. Playback lists timestamped segments; selecting a segment seeks the audio, and lexical search opens the recording at the stored start time. Corrections retain timestamps and provider provenance.

## Imported and previously recorded audio

QuickNotes has an optional, restartable external provider for attached audio files. The client first verifies a live server capability, then exposes the action only for a signed-in user when all of the following are true:

- Recognition privacy is **External allowed**.
- The current operation's disclosure checkbox is confirmed.
- The source is canonical audio linked to the current note and is no larger than 24 MB.
- The authenticated `transcribe-audio` Supabase Edge Function confirms its server-held OpenAI provider credential and `whisper-1` model are available.

The browser sends only note/resource identity to the function. The capture adapter uploads the canonical source first; the function revalidates the authenticated owner, note-resource link, Storage path, MIME type, byte size, and SHA-256 fingerprint before it reads the private object. Provider credentials never enter the browser, IndexedDB, jobs, backups, logs, or source control.

The provider returns bounded segment timestamps through `verbose_json`. QuickNotes validates the result against the source fingerprint and atomically replaces the current machine transcript. Time-overlapping segments retain stable recognition identities, user corrections, and correction ownership; obsolete segments become superseded. The original audio is never rewritten.

The persisted job contains source IDs, a fingerprint, language choice, provider identity, and operation-scoped consent—not audio bytes or credentials. Queued/running work is recovered after reload. Switching accounts suspends the prior owner's in-memory work back to its durable queue and activates only the selected owner's jobs. Cancellation aborts the browser request and prevents a result from being committed, although an upstream provider request that has already started may still finish remotely.

Timestamped transcript rows use the existing lexical search, source navigation, correction editor, canonical Todo creation, capture cloud synchronization, and backup/import paths. No separate transcript format is introduced.

## Deployment and limits

- Configure `OPENAI_API_KEY` only as a Supabase Edge Function secret. The UI stays unavailable if the live capability probe cannot validate it.
- The function accepts MP3, MP4/M4A, WAV, WebM, OGG, AAC, and FLAC sources up to 24 MB. Larger canonical recordings remain attached and playable but cannot use this provider.
- Server-side quota accounting allows at most 10 requests and 150 MB per authenticated user per clock hour. The quota table contains no note or transcript content, has RLS enabled, exposes no policies to browser roles, and its claim function is executable only by `service_role`.
- Responses are limited to 2,000 segments and 200,000 transcript characters before local recognition limits are applied.
- The provider model is currently the provider-managed `whisper-1` alias rather than a pinned model revision.

The connected Supabase project has the rate-limit migration and authenticated Edge Function deployed. A successful real provider call is not yet recorded in repository verification because the current tooling cannot inspect/set the Edge Function secret and no authenticated test workspace credentials were available. This is an operational verification/configuration limitation, not a simulated client action: when capability validation fails, QuickNotes shows an unavailable explanation and no transcription button.

## Shared transcript behavior and limitations

Transcript text can be explicitly converted into a canonical Todo task with a stable recognition/resource/time source locator. QuickNotes never infers tasks from arbitrary speech.

- Browser speech recognition support, language coverage, network behavior, and accuracy are platform-dependent.
- Live browser segment times are capture-time approximations because the Web Speech API does not expose authoritative audio timecodes.
- External audio-file transcription requires connectivity, a signed-in cloud workspace, explicit per-operation consent, and an operational server-held provider secret. Off and Local-only modes never invoke it.
- Diarization, speaker naming, audio editing, and chunked transcription above 24 MB are not implemented.
