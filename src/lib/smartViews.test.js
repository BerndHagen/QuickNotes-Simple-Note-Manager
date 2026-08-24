import { describe, expect, it } from 'vitest'
import {
  deriveNoteDefaultsFromSmartView,
  matchesSmartView,
  normalizeSmartViewCriteria,
} from './smartViews'

const note = {
  id: 'note-1',
  title: 'Quarterly plan',
  content: '<p>Launch checklist</p>',
  tags: ['work', 'important'],
  folderId: 'folder-work',
  noteType: 'standard',
  starred: true,
  pinned: false,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-23T10:00:00.000Z',
}

describe('smart views', () => {
  it('combines rules using all or any semantics', () => {
    const rules = [
      { id: '1', field: 'tag', operator: 'contains', value: 'work' },
      { id: '2', field: 'starred', operator: 'is', value: true },
    ]
    expect(matchesSmartView(note, { criteria: { match: 'all', rules } })).toBe(true)
    expect(matchesSmartView(note, {
      criteria: { match: 'all', rules: [...rules, { id: '3', field: 'pinned', operator: 'is', value: true }] },
    })).toBe(false)
    expect(matchesSmartView(note, {
      criteria: { match: 'any', rules: [{ id: '3', field: 'title', operator: 'contains', value: 'plan' }] },
    })).toBe(true)
  })

  it('supports relative date rules with an injected clock', () => {
    expect(matchesSmartView(note, {
      criteria: {
        match: 'all',
        rules: [{ id: '1', field: 'updatedAt', operator: 'within_days', value: 3 }],
      },
    }, { now: Date.parse('2026-08-24T10:00:00.000Z') })).toBe(true)
  })

  it('matches the current multi-reminder model without requiring a legacy reminder field', () => {
    const noteWithReminders = {
      ...note,
      reminders: [
        { id: 'past', datetime: '2026-08-24T08:00:00.000Z', notified: false },
        { id: 'future', datetime: '2026-08-25T08:00:00.000Z', notified: false },
        { id: 'sent', datetime: '2026-08-20T08:00:00.000Z', notified: true },
      ],
    }
    const at = { now: Date.parse('2026-08-24T10:00:00.000Z') }
    expect(matchesSmartView(noteWithReminders, {
      criteria: { rules: [{ id: '1', field: 'reminder', operator: 'is_set' }] },
    }, at)).toBe(true)
    expect(matchesSmartView(noteWithReminders, {
      criteria: { rules: [{ id: '1', field: 'reminder', operator: 'is_overdue' }] },
    }, at)).toBe(true)
    expect(matchesSmartView(noteWithReminders, {
      criteria: { rules: [{ id: '1', field: 'reminder', operator: 'is_upcoming' }] },
    }, at)).toBe(true)
  })

  it('derives safe defaults only from required positive rules', () => {
    expect(deriveNoteDefaultsFromSmartView({
      criteria: {
        match: 'all',
        rules: [
          { id: '1', field: 'folder', operator: 'is', value: 'folder-work' },
          { id: '2', field: 'tag', operator: 'contains', value: 'Important' },
          { id: '3', field: 'starred', operator: 'is', value: true },
        ],
      },
    })).toEqual({ folderId: 'folder-work', tags: ['important'], starred: true })
  })

  it('repairs malformed criteria to a usable bounded shape', () => {
    const criteria = normalizeSmartViewCriteria({ match: 'invalid', rules: [] })
    expect(criteria.match).toBe('all')
    expect(criteria.scope).toBe('active')
    expect(criteria.rules).toHaveLength(1)
  })
})
