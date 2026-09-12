export function enqueueCollaborationConflict(state, conflict) {
  const conflicts = [
    ...(state.collaborationConflicts || []).filter(
      (candidate) => candidate.noteId !== conflict.noteId
    ),
    conflict,
  ]
  return {
    collaborationConflicts: conflicts,
    // Compatibility alias for older selectors and persisted test fixtures.
    // New UI resolves its note from the full queue.
    collaborationConflict: conflicts[0] || null,
  }
}

export function clearCollaborationConflict(state, noteId) {
  const conflicts = (state.collaborationConflicts || []).filter(
    (candidate) => candidate.noteId !== noteId
  )
  return {
    collaborationConflicts: conflicts,
    collaborationConflict: conflicts[0] || null,
  }
}
