const FREQUENCIES = new Set(['daily', 'weekdays', 'weekly', 'monthly', 'yearly'])

const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

export const normalizeRecurrence = (value) => {
  if (!value || !FREQUENCIES.has(value.frequency)) return null
  const interval = Number(value.interval)
  return {
    frequency: value.frequency,
    interval: Number.isInteger(interval) && interval >= 1 && interval <= 30 ? interval : 1,
  }
}

export const getNextRecurrenceDate = (dueDate, recurrence, completedAt = null) => {
  const rule = normalizeRecurrence(recurrence)
  if (!rule) return null
  const completionDate = completedAt ? new Date(completedAt) : null
  const scheduledDate = parseDateKey(dueDate)
  const base = scheduledDate && (!completionDate || scheduledDate > completionDate)
    ? scheduledDate
    : completionDate || new Date()
  if (Number.isNaN(base.getTime())) return null
  base.setHours(12, 0, 0, 0)

  if (rule.frequency === 'daily') {
    base.setDate(base.getDate() + rule.interval)
  } else if (rule.frequency === 'weekdays') {
    let remaining = rule.interval
    while (remaining > 0) {
      base.setDate(base.getDate() + 1)
      if (base.getDay() !== 0 && base.getDay() !== 6) remaining -= 1
    }
  } else if (rule.frequency === 'weekly') {
    base.setDate(base.getDate() + 7 * rule.interval)
  } else if (rule.frequency === 'monthly') {
    const originalDay = base.getDate()
    const targetMonth = base.getMonth() + rule.interval
    const lastDay = new Date(base.getFullYear(), targetMonth + 1, 0).getDate()
    base.setDate(1)
    base.setMonth(targetMonth)
    base.setDate(Math.min(originalDay, lastDay))
  } else if (rule.frequency === 'yearly') {
    const month = base.getMonth()
    const day = base.getDate()
    const targetYear = base.getFullYear() + rule.interval
    const lastDay = new Date(targetYear, month + 1, 0).getDate()
    base.setDate(1)
    base.setFullYear(targetYear)
    base.setMonth(month)
    base.setDate(Math.min(day, lastDay))
  }

  return formatDateKey(base)
}

/**
 * Completes an ordinary task in place. For a recurring task it also inserts
 * the next open occurrence, preserving notes, subtasks, priority and rule.
 */
export const toggleTaskWithRecurrence = (
  tasks,
  taskId,
  { createId, now = new Date() } = {}
) => {
  const list = Array.isArray(tasks) ? tasks : []
  const task = list.find((item) => item?.id === taskId)
  if (!task) return list

  if (task.completed) {
    return list.map((item) => item?.id === taskId
      ? { ...item, completed: false, completedAt: null }
      : item)
  }

  const completedAt = now.toISOString()
  const completedTasks = list.map((item) => item?.id === taskId
    ? { ...item, completed: true, completedAt }
    : item)
  const recurrence = normalizeRecurrence(task.recurrence)
  if (!recurrence) return completedTasks

  const nextTask = {
    ...task,
    id: createId?.() || globalThis.crypto?.randomUUID?.() || `${Date.now()}-recurring`,
    completed: false,
    completedAt: null,
    dueDate: getNextRecurrenceDate(task.dueDate, recurrence, now),
    createdAt: completedAt,
    recurrence,
    subtasks: (Array.isArray(task.subtasks) ? task.subtasks : []).map((subtask) => ({
      ...subtask,
      completed: false,
    })),
  }
  return [nextTask, ...completedTasks]
}

export const RECURRENCE_LABELS = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}
