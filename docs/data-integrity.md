# Data integrity architecture

## Canonical and derived data

Canonical data includes notes/catalogs, note versions, Paper/Canvas and
annotation graphs, immutable resource identities and payloads, note-resource
links, recognition output plus corrections/provenance, recording recovery
chunks, reminders, and source locators. Search documents, knowledge links,
semantic rows, indexes, transient jobs, and UI state are derived or
orchestration data and may be rebuilt without changing canonical content.

## Transaction boundaries

- Note/catalog mutation plus owner outbox entry.
- Paper/Canvas command, affected rows, recognition invalidation, resource
  collection decision, note timestamp, and spatial outbox entries.
- Annotation graph mutation plus annotation outbox entries.
- Attachment metadata, payload, note link, and capture outbox entries.
- Recording chunk/session progress and final resource assembly.
- Complete backup import graph, remapped references, and initial outbox.
- Permanent note deletion across note, versions, indexes, spatial/annotation,
  capture, resource, recording, and queued-operation domains.

Quota or validation failure aborts these transactions. Resource collection is
reference-aware across note links, spatial placements, recognition provenance,
and annotations. Suspected broken/orphan state is reported rather than repaired
automatically.

## Validation and forward safety

Canonical inputs have explicit schema versions, bounded counts/sizes/text and
finite geometry. Unknown future spatial/backup schemas are rejected rather
than guessed. Corrupt derived search rows are discarded and deterministically
rebuilt. Corrupt canonical notes are isolated with raw export.

The read-only integrity audit in Settings checks missing metadata/payloads,
payloads without metadata, references to missing notes, detached spatial and
annotation rows, detached recording chunks, and unreferenced resources. Its
result is diagnostic; destructive repair needs a separately reviewed action.
