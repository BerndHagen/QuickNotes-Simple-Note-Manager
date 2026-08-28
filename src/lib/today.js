import { collectWorkspaceReminders, REMINDER_STATUSES } from './reminders'
import { collectWorkspaceTasks, getTodayKey, sortWorkspaceTasks } from './workspaceTasks'

const localDateTimeKey = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function collectTodayAgenda(notes, options = {}) {
  const today = options.today || getTodayKey()
  const currentNoteId = options.currentNoteId || null
  const activeNotes = (Array.isArray(notes) ? notes : []).filter((note) => note && !note.deleted && !note.archived)
  const dueTasks = sortWorkspaceTasks(collectWorkspaceTasks(activeNotes)).filter((task) =>
    !task.completed && task.dueDate && task.dueDate <= today
  )
  const reminders = collectWorkspaceReminders(activeNotes).filter((reminder) =>
    [REMINDER_STATUSES.SCHEDULED, REMINDER_STATUSES.TRIGGERED].includes(reminder.status) &&
    localDateTimeKey(reminder.datetime) <= today
  )
  const meetings = activeNotes
    .filter((note) => note.noteType === 'meeting' && note.noteData?.date === today)
    .sort((left, right) => String(left.noteData?.startTime || '99:99').localeCompare(String(right.noteData?.startTime || '99:99')))
  const recentNotes = activeNotes
    .filter((note) => note.id !== currentNoteId)
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0))
    .slice(0, 5)

  return { today, dueTasks, reminders, meetings, recentNotes }
}
