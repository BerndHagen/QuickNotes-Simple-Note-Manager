import { describe, expect, it } from 'vitest'
import { getNextRecurrenceDate, normalizeRecurrence, toggleTaskWithRecurrence } from './taskRecurrence'

describe('task recurrence', () => {
  it('clamps monthly recurrence at the end of shorter months', () => {
    expect(getNextRecurrenceDate('2026-01-31', { frequency: 'monthly', interval: 1 })).toBe('2026-02-28')
  })

  it('skips weekends for weekday recurrence', () => {
    expect(getNextRecurrenceDate('2026-08-28', { frequency: 'weekdays', interval: 1 })).toBe('2026-08-31')
  })

  it('creates the next occurrence while retaining completed history', () => {
    const tasks = [{
      id: 'task-1',
      text: 'Review metrics',
      dueDate: '2026-08-24',
      completed: false,
      recurrence: { frequency: 'weekly', interval: 2 },
      subtasks: [{ id: 'sub-1', text: 'Export', completed: true }],
    }]
    const result = toggleTaskWithRecurrence(tasks, 'task-1', {
      createId: () => 'task-2',
      now: new Date(2026, 7, 24, 10),
    })

    expect(result[0]).toMatchObject({ id: 'task-2', dueDate: '2026-09-07', completed: false })
    expect(result[0].subtasks[0].completed).toBe(false)
    expect(result[1]).toMatchObject({ id: 'task-1', completed: true })
  })

  it('rejects unknown and excessive rules', () => {
    expect(normalizeRecurrence({ frequency: 'hourly', interval: 1 })).toBeNull()
    expect(normalizeRecurrence({ frequency: 'daily', interval: 90 })).toEqual({ frequency: 'daily', interval: 1 })
  })
})
