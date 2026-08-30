import { describe, expect, it } from 'vitest'
import { getDocumentStatistics } from './documentStatistics'

describe('getDocumentStatistics', () => {
  it('keeps semantic boundaries between adjacent rich-text blocks', () => {
    const stats = getDocumentStatistics({
      content: '<h1>Steam Games</h1><p>Halo Infinite</p><ul><li>Nier Automata</li><li>Horizon Zero Dawn</li></ul>',
      tags: [],
    })

    expect(stats.plainText).toBe('Steam Games Halo Infinite Nier Automata Horizon Zero Dawn')
    expect(stats.words).toBe(9)
    expect(stats.characters).toBe(57)
    expect(stats.charactersWithoutSpaces).toBe(49)
  })

  it('counts structure without changing the visible text definition', () => {
    const stats = getDocumentStatistics({
      content: '<h2>Plan</h2><p>Read <a href="https://example.com">the brief</a>.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true">Done</li></ul>',
      tags: ['work'],
    })

    expect(stats.words).toBe(5)
    expect(stats.headingCount).toBe(1)
    expect(stats.linkCount).toBe(1)
    expect(stats.checklistTotal).toBe(1)
    expect(stats.checklistDone).toBe(1)
    expect(stats.tagCount).toBe(1)
  })

  it('returns honest zeroes for an empty document', () => {
    expect(getDocumentStatistics({ content: '', tags: [] })).toMatchObject({
      words: 0,
      characters: 0,
      charactersWithoutSpaces: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
    })
  })
})
