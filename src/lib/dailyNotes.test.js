import { describe, expect, it } from 'vitest'
import { createDailyNoteInput, findDailyNote, getDailyNoteDateKey } from './dailyNotes'

describe('daily notes', () => {
  const date = new Date(2026, 7, 24, 9, 30)

  it('uses a local calendar key rather than a UTC boundary', () => {
    expect(getDailyNoteDateKey(date)).toBe('2026-08-24')
  })

  it('reopens the active journal for a date', () => {
    const match = { id: 'today', noteType: 'journal', noteData: { date: '2026-08-24' } }
    expect(findDailyNote([match], date)).toBe(match)
    expect(findDailyNote([{ ...match, archived: true }], date)).toBeNull()
  })

  it('creates localized daily note metadata without discarding defaults', () => {
    expect(createDailyNoteInput(date, { mood: null }, 'en-US')).toEqual({
      title: 'Monday, August 24, 2026',
      noteType: 'journal',
      folderId: null,
      noteData: { mood: null, date: '2026-08-24', dailyNote: true },
    })
  })
})
