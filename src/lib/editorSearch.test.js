import { describe, expect, it } from 'vitest'
import { createEditorSearchPattern, findEditorMatches } from './editorSearch'

const documentWith = (...nodes) => ({
  descendants(callback) {
    nodes.forEach(({ text, pos }) => callback({ isText: true, text }, pos))
  },
})

describe('editor search', () => {
  it('treats plain text metacharacters literally', () => {
    const { pattern, error } = createEditorSearchPattern('a+b')
    const result = findEditorMatches(documentWith({ text: 'a+b ab', pos: 1 }), pattern)

    expect(error).toBe('')
    expect(result.matches).toEqual([{ from: 1, to: 4, text: 'a+b' }])
  })

  it('finds a word split by adjacent formatting nodes', () => {
    const { pattern } = createEditorSearchPattern('hello')
    const result = findEditorMatches(
      documentWith(
        { text: 'he', pos: 4 },
        { text: 'llo', pos: 6 },
        { text: 'hello', pos: 15 }
      ),
      pattern
    )

    expect(result.matches).toEqual([
      { from: 4, to: 9, text: 'hello' },
      { from: 15, to: 20, text: 'hello' },
    ])
  })

  it('uses Unicode-aware whole-word boundaries', () => {
    const { pattern } = createEditorSearchPattern('cafe', { wholeWord: true })
    const result = findEditorMatches(documentWith({ text: 'decafe cafe café', pos: 1 }), pattern)

    expect(result.matches).toEqual([{ from: 8, to: 12, text: 'cafe' }])
  })

  it('reports invalid and zero-width regular expressions', () => {
    expect(createEditorSearchPattern('(', { useRegex: true }).error).toBe(
      'Enter a valid regular expression.'
    )

    const { pattern } = createEditorSearchPattern('(?=a)', { useRegex: true })
    expect(findEditorMatches(documentWith({ text: 'a', pos: 1 }), pattern)).toEqual({
      matches: [],
      error: 'Patterns that match an empty position are not supported.',
    })
  })
})
