import { lazy } from 'react'
import { NOTE_TYPES } from './noteTypes'

/**
 * Workspace implementations are intentionally registered through static lazy
 * imports. Note-type metadata is used throughout the shell and must not pull
 * every editor into the initial application chunk.
 */
export const NOTE_TYPE_EDITORS = {
  [NOTE_TYPES.TODO_LIST]: lazy(() => import('./TodoListEditor')),
  [NOTE_TYPES.PROJECT]: lazy(() => import('./ProjectPlannerEditor')),
  [NOTE_TYPES.MEETING]: lazy(() => import('./MeetingNotesEditor')),
  [NOTE_TYPES.JOURNAL]: lazy(() => import('./JournalEditor')),
  [NOTE_TYPES.BRAINSTORM]: lazy(() => import('./BrainstormEditor')),
  [NOTE_TYPES.SHOPPING]: lazy(() => import('./ShoppingListEditor')),
  [NOTE_TYPES.WEEKLY]: lazy(() => import('./WeeklyPlannerEditor')),
  [NOTE_TYPES.PAPER]: lazy(() => import('./PaperEditor')),
  [NOTE_TYPES.CANVAS]: lazy(() => import('./CanvasEditor')),
}

export function getEditorForNoteType(noteType) {
  return NOTE_TYPE_EDITORS[noteType] || null
}

export function hasSpecializedEditor(noteType) {
  return Boolean(noteType && noteType !== NOTE_TYPES.STANDARD && NOTE_TYPE_EDITORS[noteType])
}
