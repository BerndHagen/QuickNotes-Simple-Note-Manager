# Data safety

QuickNotes is local-first. An edit is considered saved only after its canonical
rows and any required durable sync operation commit to IndexedDB. Cloud status
is separate: **Saved on this device** does not mean **Synced**.

## What protects work

- Document/catalog writes and their outbox mutations share an IndexedDB
  transaction. Paper, Canvas, annotation, capture, recording, and resource
  operations use their own atomic transactions.
- Failed writes leave visible error state. QuickNotes does not report a failed
  persistence promise as saved.
- Cloud work uses owner-scoped durable queues. Acknowledgement removes only the
  exact immutable mutation that completed, so a later coalesced edit survives
  an older response.
- Document and catalog conflicts require an explicit local/incoming choice.
  User-corrected recognition outranks machine-only output. Annotation conflicts
  remain blocked until reviewed.
- Corrupt notes and missing attachment payloads remain visible as recovery
  problems. The Data settings page runs a read-only integrity audit; it does
  not silently delete suspected orphans.

## What users should still do

Browser storage can be cleared or evicted. Request persistent storage in
Settings when available and keep periodic `.qnotes` archives outside the
browser profile. After a restore, inspect representative notes, ink, resources,
transcripts, reminders, and history before deleting the original.

Provider-produced OCR/transcripts are derived data. Original ink, images,
PDFs, and audio remain canonical. External provider features stay unavailable
unless privacy mode, per-operation consent, authentication, and a live server
capability check all permit the operation.
