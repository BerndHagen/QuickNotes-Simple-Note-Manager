import { describe, expect, it } from 'vitest'
import { applyTemplateVariables, createNoteInputFromTemplate } from './noteTemplates'

describe('note templates', () => {
  it('expands stable local date, time, and title variables', () => {
    const now = new Date(2026, 7, 24, 9, 5)
    expect(applyTemplateVariables('{{date}} {{time}} {{title}}', { title: 'Plan', now }))
      .toBe('2026-08-24 09:05 Plan')
  })

  it('applies variables to document and structured template data', () => {
    const input = createNoteInputFromTemplate({
      name: 'Meeting',
      titleTemplate: '{{date}} · {{title}}',
      content: '<p>{{title}}</p>',
      noteType: 'meeting',
      noteData: { agenda: [{ text: 'Discuss {{title}}' }] },
      tags: ['meeting'],
    }, 'Roadmap', new Date(2026, 7, 24, 9, 5))

    expect(input.title).toBe('2026-08-24 · Roadmap')
    expect(input.content).toContain('2026-08-24 · Roadmap')
    expect(input.noteData.agenda[0].text).toContain('2026-08-24 · Roadmap')
    expect(input.tags).toEqual(['meeting'])
  })
})
