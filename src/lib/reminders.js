/** Canonical, note-owned reminder records with stable source identities. */

export const REMINDER_SCHEMA_VERSION = 2
export const REMINDER_STATUSES = Object.freeze({
  SCHEDULED: 'scheduled',
  TRIGGERED: 'triggered',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed',
})

const VALID_REPEATS = new Set(['none', 'daily', 'weekly', 'monthly'])
const VALID_STATUSES = new Set(Object.values(REMINDER_STATUSES))
const cleanText = (value, maxLength = 240) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
const cleanId = (value) => cleanText(value, 160) || null
const validDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
const nextId = () => globalThis.crypto?.randomUUID?.() || `reminder_${Date.now()}_${Math.random().toString(36).slice(2)}`

export const normalizeReminderSource = (source, noteId) => {
  const ownerNoteId = cleanId(noteId)
  const value = source && typeof source === 'object' && !Array.isArray(source) ? source : {}
  const type = ['note', 'task', 'anchor'].includes(value.type) ? value.type : 'note'
  const normalized = {
    type,
    noteId: cleanId(value.noteId) || ownerNoteId,
  }
  if (type === 'task') {
    normalized.taskId = cleanId(value.taskId)
    normalized.taskKind = cleanId(value.taskKind)
    if (!normalized.taskId) {
      normalized.type = 'note'
      delete normalized.taskId
      delete normalized.taskKind
    }
  }
  if (type === 'anchor') {
    for (const key of ['anchorId', 'objectId', 'pageId', 'resourceId', 'recognitionId']) {
      const id = cleanId(value[key])
      if (id) normalized[key] = id
    }
    if (Number.isFinite(Number(value.timeMs))) normalized.timeMs = Math.max(0, Math.round(Number(value.timeMs)))
  }
  const label = cleanText(value.label, 180)
  if (label) normalized.label = label
  return normalized
}

export const reminderSourceForTask = (task) => normalizeReminderSource({
  type: 'task',
  noteId: task?.noteId,
  taskId: task?.taskId,
  taskKind: task?.kind,
  label: task?.title,
}, task?.noteId)

export const reminderSourceToKnowledgeTarget = (source) => {
  const value = normalizeReminderSource(source, source?.noteId)
  if (!value.noteId) return null
  return {
    noteId: value.noteId,
    ...(value.anchorId ? { anchorId: value.anchorId } : {}),
    ...(value.objectId ? { objectId: value.objectId } : {}),
    ...(value.pageId ? { pageId: value.pageId } : {}),
    ...(value.resourceId ? { resourceId: value.resourceId } : {}),
    ...(value.recognitionId ? { recognitionId: value.recognitionId } : {}),
    ...(value.timeMs != null ? { timeMs: value.timeMs } : {}),
  }
}

export const reminderSourcesEqual = (left, right) => {
  const a = normalizeReminderSource(left, left?.noteId)
  const b = normalizeReminderSource(right, right?.noteId)
  return a.type === b.type &&
    a.noteId === b.noteId &&
    (a.taskId || null) === (b.taskId || null) &&
    (a.taskKind || null) === (b.taskKind || null) &&
    (a.anchorId || null) === (b.anchorId || null) &&
    (a.objectId || null) === (b.objectId || null) &&
    (a.pageId || null) === (b.pageId || null) &&
    (a.resourceId || null) === (b.resourceId || null) &&
    (a.recognitionId || null) === (b.recognitionId || null) &&
    (a.timeMs ?? null) === (b.timeMs ?? null)
}

export const normalizeReminder = (value, noteId) => {
  const reminder = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const dueAt = validDate(reminder.datetime || reminder.dueAt)
  if (!dueAt) return null
  const repeat = VALID_REPEATS.has(reminder.repeat) ? reminder.repeat : 'none'
  const status = VALID_STATUSES.has(reminder.status)
    ? reminder.status
    : reminder.notified
      ? REMINDER_STATUSES.TRIGGERED
      : REMINDER_STATUSES.SCHEDULED
  const createdAt = validDate(reminder.createdAt)?.toISOString() || new Date().toISOString()
  const updatedAt = validDate(reminder.updatedAt)?.toISOString() || createdAt
  return {
    ...reminder,
    id: cleanId(reminder.id) || nextId(),
    schemaVersion: REMINDER_SCHEMA_VERSION,
    datetime: dueAt.toISOString(),
    repeat,
    ...(repeat === 'monthly' ? { repeatDay: Math.min(31, Math.max(1, Number(reminder.repeatDay) || dueAt.getDate())) } : {}),
    source: normalizeReminderSource(reminder.source, noteId),
    title: cleanText(reminder.title, 240),
    status,
    notified: status === REMINDER_STATUSES.TRIGGERED,
    createdAt,
    updatedAt,
  }
}

export const createReminder = ({ noteId, source, title, datetime, repeat = 'none' }) => {
  const now = new Date().toISOString()
  return normalizeReminder({
    id: nextId(),
    schemaVersion: REMINDER_SCHEMA_VERSION,
    datetime,
    repeat,
    source,
    title,
    status: REMINDER_STATUSES.SCHEDULED,
    notified: false,
    createdAt: now,
    updatedAt: now,
  }, noteId)
}

export const triggerReminder = (value, now = new Date()) => {
  const reminder = normalizeReminder(value, value?.source?.noteId)
  if (!reminder || reminder.status !== REMINDER_STATUSES.SCHEDULED || new Date(reminder.datetime) > now) return reminder
  return {
    ...reminder,
    status: REMINDER_STATUSES.TRIGGERED,
    notified: true,
    lastTriggeredAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

const finishOccurrence = (value, finalStatus, now = new Date()) => {
  const reminder = normalizeReminder(value, value?.source?.noteId)
  if (!reminder) return null
  const next = getNextReminderDate(reminder.datetime, reminder.repeat, now, reminder.repeatDay)
  if (next) {
    return {
      ...reminder,
      datetime: next.toISOString(),
      status: REMINDER_STATUSES.SCHEDULED,
      notified: false,
      lastCompletedAt: finalStatus === REMINDER_STATUSES.COMPLETED ? now.toISOString() : reminder.lastCompletedAt,
      lastDismissedAt: finalStatus === REMINDER_STATUSES.DISMISSED ? now.toISOString() : reminder.lastDismissedAt,
      updatedAt: now.toISOString(),
    }
  }
  return {
    ...reminder,
    status: finalStatus,
    notified: true,
    updatedAt: now.toISOString(),
  }
}

export const completeReminder = (value, now = new Date()) => finishOccurrence(value, REMINDER_STATUSES.COMPLETED, now)
export const dismissReminder = (value, now = new Date()) => finishOccurrence(value, REMINDER_STATUSES.DISMISSED, now)

export const snoozeReminder = (value, minutes = 10, now = new Date()) => {
  const reminder = normalizeReminder(value, value?.source?.noteId)
  if (!reminder) return null
  const boundedMinutes = Math.min(7 * 24 * 60, Math.max(1, Math.round(Number(minutes) || 10)))
  return {
    ...reminder,
    datetime: new Date(now.getTime() + boundedMinutes * 60_000).toISOString(),
    status: REMINDER_STATUSES.SCHEDULED,
    notified: false,
    snoozedFrom: reminder.datetime,
    lastSnoozedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

export const collectWorkspaceReminders = (notes) => {
  const rows = []
  for (const note of Array.isArray(notes) ? notes : []) {
    if (!note || note.deleted || note.archived) continue
    for (const value of Array.isArray(note.reminders) ? note.reminders : []) {
      const reminder = normalizeReminder(value, note.id)
      if (!reminder) continue
      rows.push({
        ...reminder,
        noteId: note.id,
        noteTitle: note.title || 'Untitled note',
        sourceLabel: reminder.source.label || (reminder.source.type === 'task' ? 'Task reminder' : 'Note reminder'),
      })
    }
  }
  return rows.sort((left, right) => Date.parse(left.datetime) - Date.parse(right.datetime) || left.id.localeCompare(right.id))
}

/**
 * `getNextReminderDate` advances a repeating reminder past `after`, and returns
 * null for one-time reminders. Monthly repeats keep the original day of the
 * month, clamped to the length of shorter months, so the 31st does not drift.
 */

const addOneMonth = (date, preferredDay) => {
  date.setDate(1)
  date.setMonth(date.getMonth() + 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(preferredDay, lastDay))
}

export const getNextReminderDate = (
  datetime,
  repeat,
  after = new Date(),
  preferredDay = undefined
) => {
  const next = new Date(datetime)
  const boundary = new Date(after)
  if (Number.isNaN(next.getTime()) || Number.isNaN(boundary.getTime())) return null
  if (!['daily', 'weekly', 'monthly'].includes(repeat)) return null

  const monthlyDay = preferredDay || next.getDate()
  let safety = 0
  while (next <= boundary && safety < 10000) {
    if (repeat === 'daily') next.setDate(next.getDate() + 1)
    if (repeat === 'weekly') next.setDate(next.getDate() + 7)
    if (repeat === 'monthly') addOneMonth(next, monthlyDay)
    safety += 1
  }

  return next > boundary ? next : null
}
