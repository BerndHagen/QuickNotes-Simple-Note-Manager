export const VERSION_CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000

const cloneNoteData = (value) => {
  if (value == null) return null

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Persisted note data is JSON-compatible; fall through for older browsers.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

const snapshotValue = (note, overrides, key, fallback) =>
  Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : note?.[key] ?? fallback

export const createVersionSnapshot = (note, overrides = {}) => ({
  id: snapshotValue(note, overrides, 'id', null),
  title: snapshotValue(note, overrides, 'title', ''),
  content: snapshotValue(note, overrides, 'content', ''),
  noteData: cloneNoteData(snapshotValue(note, overrides, 'noteData', null)),
  noteType: snapshotValue(note, overrides, 'noteType', 'standard'),
})

const snapshotKey = (snapshot) => JSON.stringify([
  snapshot.id,
  snapshot.title,
  snapshot.content,
  snapshot.noteType,
  snapshot.noteData,
])

export const versionSnapshotsEqual = (first, second) =>
  !!first && !!second && snapshotKey(first) === snapshotKey(second)

export const createVersionCheckpointTracker = (snapshot) => ({
  latest: createVersionSnapshot(snapshot),
  lastCheckpointAt: null,
})

/**
 * Advances an editing session and returns the state immediately before a
 * meaningful change whenever a recovery checkpoint is due.
 */
export const advanceVersionCheckpoint = (
  tracker,
  nextSnapshot,
  now = Date.now(),
  interval = VERSION_CHECKPOINT_INTERVAL_MS
) => {
  const next = createVersionSnapshot(nextSnapshot)

  if (!tracker?.latest || tracker.latest.id !== next.id) {
    return {
      tracker: createVersionCheckpointTracker(next),
      checkpoint: null,
    }
  }

  if (versionSnapshotsEqual(tracker.latest, next)) {
    return { tracker, checkpoint: null }
  }

  const checkpointDue =
    tracker.lastCheckpointAt == null || now - tracker.lastCheckpointAt >= interval

  return {
    tracker: {
      latest: next,
      lastCheckpointAt: checkpointDue ? now : tracker.lastCheckpointAt,
    },
    checkpoint: checkpointDue ? createVersionSnapshot(tracker.latest) : null,
  }
}
