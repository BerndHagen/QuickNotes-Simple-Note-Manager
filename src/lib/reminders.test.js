import { describe, expect, it } from 'vitest'
import { getNextReminderDate } from './reminders'

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
})
