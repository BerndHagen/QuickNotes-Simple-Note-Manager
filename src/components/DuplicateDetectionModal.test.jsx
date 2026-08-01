import { describe, expect, it } from 'vitest'
import {
  calculateNoteSimilarity,
  findDuplicateGroups,
  getSimilarityReason,
  stripNoteHtml,
} from './DuplicateDetectionModal'

const note = (id, title, content, noteData = null) => ({
  id,
  title,
  content,
  noteData,
  noteType: noteData ? 'todo' : 'standard',
})
describe('duplicate note analysis', () => {
  it('does not treat every untitled note as a duplicate', () => {
    const first = note('one', '', '<p>Project launch details</p>')
    const second = note('two', null, '<p>Personal recipe collection</p>')

    expect(calculateNoteSimilarity(first, second)).toBeLessThan(0.7)
    expect(findDuplicateGroups([first, second])).toEqual([])
  })

  it('finds identical substantive content even when titles differ', () => {
    const content = '<p>Call the customer and confirm the delivery address.</p>'
    const groups = findDuplicateGroups([
      note('one', 'Customer follow-up', content),
      note('two', 'Delivery checklist', content),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].duplicates[0]).toMatchObject({
      note: expect.objectContaining({ id: 'two' }),
      reason: 'Identical content',
    })
  })

  it('compares focused-note data and tolerates incomplete imported records', () => {
    const structured = { tasks: [{ id: 'ignored', text: 'Prepare quarterly report' }] }
    const first = note('one', undefined, '', structured)
    const second = note('two', undefined, '', {
      tasks: [{ id: 'different-id', text: 'Prepare quarterly report' }],
    })

    expect(calculateNoteSimilarity(first, second)).toBeGreaterThanOrEqual(0.9)
    expect(getSimilarityReason(first, second)).toBe('Identical content')
  })

  it('extracts visible text without including executable or style content', () => {
    expect(stripNoteHtml('<p>Visible</p><script>hidden()</script><style>.hidden{}</style>'))
      .toBe('Visible')
  })
})
