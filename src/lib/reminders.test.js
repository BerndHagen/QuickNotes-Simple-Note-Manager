import { describe, expect, it } from 'vitest'
import {
  collectWorkspaceReminders,
  completeReminder,
  createReminder,
  getNextReminderDate,
  REMINDER_STATUSES,
  reminderSourceForTask,
  reminderSourcesEqual,
  snoozeReminder,
  triggerReminder,
} from './reminders'

describe('getNextReminderDate', () => {
  it('advances missed daily reminders to the next future occurrence', () => {
    const next = getNextReminderDate(
      '2026-07-28T09:00:00.000Z',
      'daily',
      '2026-07-31T10:00:00.000Z'
    )
    expect(next.toISOString()).toBe('2026-08-01T09:00:00.000Z')
  })

  it('advances weekly reminders', () => {
    const next = getNextReminderDate(
      '2026-07-24T09:00:00.000Z',
      'weekly',
      '2026-07-31T10:00:00.000Z'
    )
    expect(next.toISOString()).toBe('2026-08-07T09:00:00.000Z')
  })

  it('clamps monthly reminders to the final day of shorter months', () => {
    const next = getNextReminderDate(
      '2026-01-31T09:00:00.000Z',
      'monthly',
      '2026-02-01T00:00:00.000Z'
    )
    expect(next.toISOString()).toBe('2026-02-28T09:00:00.000Z')
    const following = getNextReminderDate(
      next,
      'monthly',
      '2026-03-01T00:00:00.000Z',
      31
    )
    expect(following.getMonth()).toBe(2)
    expect(following.getDate()).toBe(31)
    expect(following.getHours()).toBe(next.getHours())
  })

  it('returns null for non-repeating or invalid reminders', () => {
    expect(getNextReminderDate('2026-07-31T09:00:00.000Z', 'none')).toBeNull()
    expect(getNextReminderDate('invalid', 'daily')).toBeNull()
  })

  it('keeps a stable canonical task source while a note is renamed', () => {
    const source = reminderSourceForTask({
      noteId: 'meeting-1',
      taskId: 'action-1',
      kind: 'meeting-action',
      title: 'Send the revised brief',
    })
    const reminder = createReminder({
      noteId: 'meeting-1',
      source,
      title: source.label,
      datetime: '2099-01-15T10:30:00.000Z',
      repeat: 'none',
    })
    const collected = collectWorkspaceReminders([{
      id: 'meeting-1',
      title: 'Renamed meeting',
      reminders: [reminder],
    }])

    expect(collected[0]).toMatchObject({
      noteId: 'meeting-1',
      noteTitle: 'Renamed meeting',
      source: { type: 'task', noteId: 'meeting-1', taskId: 'action-1', taskKind: 'meeting-action' },
    })
    expect(reminderSourcesEqual(collected[0].source, source)).toBe(true)
  })

  it('triggers, snoozes, and completes one reminder without losing its source', () => {
    const reminder = createReminder({
      noteId: 'note-1',
      title: 'Review notes',
      datetime: '2026-08-27T09:00:00.000Z',
    })
    const now = new Date('2026-08-27T10:00:00.000Z')
    const triggered = triggerReminder(reminder, now)
    expect(triggered.status).toBe(REMINDER_STATUSES.TRIGGERED)

    const snoozed = snoozeReminder(triggered, 15, now)
    expect(snoozed).toMatchObject({ status: REMINDER_STATUSES.SCHEDULED, notified: false })
    expect(snoozed.datetime).toBe('2026-08-27T10:15:00.000Z')
    expect(snoozed.source).toEqual(reminder.source)

    const completed = completeReminder(triggerReminder(snoozed, new Date('2026-08-27T10:16:00.000Z')), new Date('2026-08-27T10:16:00.000Z'))
    expect(completed.status).toBe(REMINDER_STATUSES.COMPLETED)
  })

  it('completes one recurring occurrence by scheduling only the next one', () => {
    const reminder = createReminder({
      noteId: 'note-1',
      datetime: '2026-08-27T09:00:00.000Z',
      repeat: 'daily',
    })
    const completed = completeReminder(reminder, new Date('2026-08-27T10:00:00.000Z'))
    expect(completed).toMatchObject({ status: REMINDER_STATUSES.SCHEDULED, repeat: 'daily' })
    expect(completed.datetime).toBe('2026-08-28T09:00:00.000Z')
  })
})
