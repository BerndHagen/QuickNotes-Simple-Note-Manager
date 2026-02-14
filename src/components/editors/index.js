
export { NOTE_TYPES, NOTE_TYPE_CONFIG, CATEGORIES, getDefaultData, generateId } from './noteTypes'
export { default as TodoListEditor } from './TodoListEditor'
export { default as ProjectPlannerEditor } from './ProjectPlannerEditor'
export { default as MeetingNotesEditor } from './MeetingNotesEditor'
export { default as JournalEditor } from './JournalEditor'
export { default as BrainstormEditor } from './BrainstormEditor'
export { default as ShoppingListEditor } from './ShoppingListEditor'
export { default as WeeklyPlannerEditor } from './WeeklyPlannerEditor'
import TodoListEditor from './TodoListEditor'
import ProjectPlannerEditor from './ProjectPlannerEditor'
import MeetingNotesEditor from './MeetingNotesEditor'
import JournalEditor from './JournalEditor'
import BrainstormEditor from './BrainstormEditor'
import ShoppingListEditor from './ShoppingListEditor'
import WeeklyPlannerEditor from './WeeklyPlannerEditor'
import { NOTE_TYPES } from './noteTypes'
export const NOTE_TYPE_EDITORS = {
  [NOTE_TYPES.TODO_LIST]: TodoListEditor,
  [NOTE_TYPES.PROJECT]: ProjectPlannerEditor,
  [NOTE_TYPES.MEETING]: MeetingNotesEditor,
  [NOTE_TYPES.JOURNAL]: JournalEditor,
  [NOTE_TYPES.BRAINSTORM]: BrainstormEditor,
  [NOTE_TYPES.SHOPPING]: ShoppingListEditor,
  [NOTE_TYPES.WEEKLY]: WeeklyPlannerEditor,
}
export function getEditorForNoteType(noteType) {
  return NOTE_TYPE_EDITORS[noteType] || null
}
export function hasSpecializedEditor(noteType) {
  return noteType && noteType !== NOTE_TYPES.STANDARD && NOTE_TYPE_EDITORS[noteType] !== undefined
}
