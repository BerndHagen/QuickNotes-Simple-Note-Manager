import { afterEach, describe, it, expect, vi } from 'vitest'
import { debounce, formatNoteDate, groupNotesByDate, truncateText, htmlToPlainText } from './utils'

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

describe('formatNoteDate', () => {
  it('renders relative time by default', () => {
    expect(formatNoteDate(new Date().toISOString(), 'en', 'relative')).toBe('Just now')
  })

  it('renders an absolute date when the setting asks for one', () => {
    const result = formatNoteDate('2026-01-05T10:00:00.000Z', 'en', 'absolute')
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/2026/)
    expect(result).not.toMatch(/ago/)
  })

  it('returns an empty string for a missing date', () => {
    expect(formatNoteDate(null)).toBe('')
  })
})

describe('groupNotesByDate', () => {
  const notes = [
    { id: 'p', pinned: true, updatedAt: daysAgo(40) },
    { id: 't', updatedAt: new Date().toISOString() },
    { id: 'y', updatedAt: daysAgo(1) },
    { id: 'w', updatedAt: daysAgo(4) },
    { id: 'o', updatedAt: daysAgo(40) },
  ]

  it('buckets notes into pinned and recency sections', () => {
    const groups = groupNotesByDate(notes, { sort: 'updated-desc' })
    expect(groups.map((g) => g.id)).toEqual(['pinned', 'today', 'yesterday', 'week', 'earlier'])
    expect(groups[0].notes.map((n) => n.id)).toEqual(['p'])
    expect(groups[1].notes.map((n) => n.id)).toEqual(['t'])
  })

  it('omits empty sections', () => {
    const groups = groupNotesByDate([{ id: 'a', updatedAt: new Date().toISOString() }], {
      sort: 'updated-desc',
    })
    expect(groups.map((g) => g.id)).toEqual(['today'])
  })

  it('does not group when the sort order is not chronological', () => {
    const groups = groupNotesByDate(notes, { sort: 'title-asc' })
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBeNull()
    expect(groups[0].notes).toHaveLength(notes.length)
  })

  it('uses translated section labels when provided', () => {
    const groups = groupNotesByDate([{ id: 'a', updatedAt: new Date().toISOString() }], {
      sort: 'updated-desc',
      labels: { today: 'Heute' },
    })
    expect(groups[0].label).toBe('Heute')
  })
})

describe('text helpers', () => {
  it('truncates only when longer than the limit', () => {
    expect(truncateText('short', 20)).toBe('short')
    expect(truncateText('a'.repeat(30), 10)).toBe(`${'a'.repeat(10)}...`)
    expect(truncateText('', 10)).toBe('')
  })

  it('strips markup down to readable text', () => {
    expect(htmlToPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
    expect(htmlToPlainText('')).toBe('')
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes the latest pending call immediately', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const debounced = debounce(callback, 400)

    debounced('note-a', 'First title')
    expect(callback).not.toHaveBeenCalled()

    debounced.flush()
    expect(callback).toHaveBeenCalledWith('note-a', 'First title')
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('can cancel a pending call', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const debounced = debounce(callback, 400)

    debounced('pending')
    debounced.cancel()
    vi.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()
  })
})
