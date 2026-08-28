# Sync behavior

QuickNotes works without Supabase. A local workspace never uploads. In a cloud
workspace, canonical data is written locally first and uploaded later through
bounded owner-scoped queues.

## Status and retry

- **Saving** means a local persistence promise is in progress.
- **Saved on this device** means IndexedDB committed.
- **Pending/Offline** means durable local work still needs cloud delivery.
- **Synced** means the current queued mutation was acknowledged.
- **Conflict** or **Sync failed** requires review or retry; it is not success.

Reconnect, a visible online tab, manual sync, and relevant Realtime signals can
trigger another attempt. Duplicate delivery is expected: stable IDs and
upserts/deletes make normal replay idempotent. Queue acknowledgement compares
immutable mutation IDs so out-of-order completions cannot erase newer work.

## Conflict boundaries

Documents and catalog records never use a remote timestamp alone to discard a
pending local value. QuickNotes presents both sides. Accepting an incoming note
creates a local recovery checkpoint first. Recognition corrections and
annotation graphs have domain-specific review rules.

An update that meets a remote deletion is also a conflict: accepting incoming
accepts the deletion, while keeping local intentionally recreates the stable-ID
row. A user-confirmed permanent deletion is the tombstone exception. It wins
over unreviewed remote edits and removes the full canonical graph; the destructive
confirmation states this policy. Ordinary Trash and restore remain normal note
updates and therefore use the usual conflict review.

Paper/Canvas rows use stable page/object/resource IDs and a separate spatial
adapter; capture resources and annotations likewise do not pass through the
main note synchronizer. Same-owner spatial sync records the last accepted
remote revision. If another device advances or deletes that graph while local
operations wait, upload pauses and the editor requires an incoming/local
choice. Keeping local rebases pending stable-ID operations while merging
untouched remote pages/objects. Shared spatial surfaces remain deliberately
read-only for collaborators and are not marketed as realtime collaborative
editing.

Signing out with pending cloud work is refused until reconnect/sync succeeds.
Switching workspace owners waits for current writes, preserves separate
owner-scoped caches, and prevents background intelligence results from crossing
owners. Closing a local workspace in one tab closes it in peer tabs after each
peer has attempted to persist its in-memory draft.
