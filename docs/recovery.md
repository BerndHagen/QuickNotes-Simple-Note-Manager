# Recovery

## A save failed

Keep the tab open. The persistent error banner identifies browser storage as
the problem and does not pretend the edit was saved. Free device storage, use
**Try again** where offered, then create and verify a `.qnotes` backup.

## A note is corrupt

QuickNotes isolates malformed note rows instead of crashing the workspace or
rewriting the source. Use the corrupted-data banner to download the raw record
for support/recovery. Other valid notes remain usable.

## An attachment is missing

The attachment list keeps the broken reference visible and distinguishes
missing metadata from missing payload bytes. Do not remove it until checking
another synced device or backup. Removing a broken reference is an explicit,
confirmed action.

## A recording was interrupted

Recording audio is stored in bounded chunks. On restart QuickNotes offers to
recover or discard an interrupted session. If final assembly fails, the chunks
and session remain available; no partial canonical audio resource is claimed.

## Tabs disagree

Keep both tabs open and use the conflict banner. A stale editor draft is
checkpointed before accepting another tab's note. If a newer build upgraded
IndexedDB, the old tab stops editing and requires reload rather than writing
through an obsolete schema.

## Restore from backup

Follow [backup-restore.md](backup-restore.md). Import is additive and atomic.
Never clear the source until representative content and a second export from
the destination have been verified.
