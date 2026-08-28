# Backup and restore

QuickNotes exports a complete workspace as a `.qnotes` archive. The archive is intended for disaster recovery and transfer between QuickNotes installations; it is not a live synchronization format.

## What a complete archive contains

- Documents and structured notes, folders, tags, Smart Views, and note templates.
- Task, reminder, Meeting, and recognized-content source references stored in canonical note data.
- Paper and Canvas documents, pages, objects, ink, and shared image resources.
- Image/PDF annotation documents, pages, and objects.
- Canonical image, PDF, and audio resource metadata and bytes, note-resource links, transcripts/OCR/handwriting recognition, and user corrections.
- Up to the retained 30 recovery versions for each note. A signed-in export
  merges the local cache with every server-retained version it can read.

Search documents, knowledge indexes, semantic indexes, sync queues, transient jobs, sessions, and UI state are deliberately excluded. They are derived or device-specific and are rebuilt from canonical content after import.

## Integrity and limits

The current archive container is `QNARCH01` with workspace schema version 6. Its bounded JSON header contains a manifest and ordered binary inventory. Resource payloads remain binary rather than expanding into base64. Every binary segment is checked against its declared byte length and SHA-256 checksum before an import can begin.

Import rejects:

- an unknown container or future schema version;
- truncated, reordered, missing, additional, or trailing binary data;
- checksum, MIME type, size, count, identity, or reference mismatches;
- invalid nesting, unsupported record types, unsafe structured keys, or values above the documented workspace limits.

The archive reader caps the metadata header at 100 MB and the complete binary container at 1 GB. The import picker permits a `.qnotes` file up to 1.1 GB so framing overhead does not reject a valid maximum-size archive. Browser/device storage can impose a lower practical limit; quota failures are surfaced and do not partially commit the workspace.

Legacy QuickNotes JSON backups remain readable for migration. They are capped at 10 MB per file and 25 MB for a multi-file import. JSON is not the recommended complete backup format because embedded binary resources expand substantially.

## Restore behavior

Import is an all-or-nothing IndexedDB transaction. Validation, ID allocation, and reference remapping finish before any workspace row is written. If a row or outbox write fails, all imported catalog, spatial, annotation, recognition, resource, version, and workspace-snapshot writes roll back.

Imported content is added as a copy to the open workspace:

- note, folder, spatial, annotation, recognition, resource, and version references receive remapped identities;
- internal note/object/page/resource/task-source links are rewritten to those identities;
- existing workspace content is not overwritten;
- importing the same archive twice intentionally creates two independent copies.

After a successful cloud-workspace import, canonical records are pending local changes and synchronize through their normal dependency-ordered adapters. Import never trusts an archived owner ID or sync status.

## Recovery procedure

1. In Settings, choose **Export data** and keep the resulting `.qnotes` file outside the browser profile.
2. To test a backup, open the intended destination workspace and choose **Import**.
3. Select one `.qnotes` archive. QuickNotes validates the complete archive before showing a successful result.
4. Inspect representative Document, structured, Paper/Canvas, attachment/annotation, transcript, task/reminder, and version-history content.
5. For a cloud workspace, keep the app open until pending synchronization has completed. The archive remains the recovery source if the network fails.

Do not delete the source workspace or its archive merely because the import dialog completed. For high-value data, verify the restored content and a second export from the destination first.

## Current operational boundary

A signed-in export fetches the complete RLS-authorized remote version history
in bounded pages, merges it with local recovery rows, and only then assembles
the archive. If that history cannot be fetched, export fails before creating a
download and explains that no partial archive was produced. A local workspace
has no remote history and exports its retained local versions directly.

The archive is assembled in browser memory before download. The documented
1 GB format ceiling is therefore not a promise that every device can export a
workspace of that size; available memory, browser Blob limits, and free local
storage can impose a lower practical ceiling.
