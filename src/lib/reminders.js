/**
 * Reminder scheduling.
 *
 * `getNextReminderDate` advances a repeating reminder past `after`, and returns
 * null for one-time reminders. Monthly repeats keep the original day of the
 * month, clamped to the length of shorter months, so the 31st does not drift
 * forward through February.
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
