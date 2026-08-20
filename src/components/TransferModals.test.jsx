import { describe, expect, it } from 'vitest'
import {
  buildHtmlExportDocument,
  buildMarkdownExport,
  getExportableContent,
  getLiveNotes,
} from './ExportModal'
import { parseFile } from './ImportModal'

describe('safe note export', () => {
  it('uses the same live-note set for the displayed count and export operation', () => {
    const live = { id: 'live', title: 'Live note' }
    expect(getLiveNotes([live, { id: 'trash', deleted: true }])).toEqual([live])
  })

  it('sanitizes standard and specialized content before serialization', () => {
    const standard = getExportableContent({
      noteType: 'standard',
      content: '<p>Safe</p><img src="x" onerror="alert(1)"><script>alert(2)</script>',
    })
    const focused = getExportableContent({
      noteType: 'todo',
      noteData: { tasks: [{ text: '<img src=x onerror=alert(1)><script>bad()</script>' }] },
    })

    for (const content of [standard, focused]) {
      expect(content).not.toMatch(/<script|onerror/i)
    }
  })

  it('escapes title and tags and sanitizes the final standalone HTML document', () => {
    const note = {
      title: '</title><script>globalThis.compromised=true</script>',
      tags: ['safe', '"><img src=x onerror=alert(1)>'],
    }
    const html = buildHtmlExportDocument(
      note,
      '<p>Body</p><img src="x" onerror="alert(2)"><script>alert(3)</script>'
    )
    const documentNode = new DOMParser().parseFromString(html, 'text/html')

    expect(documentNode.querySelectorAll('script')).toHaveLength(0)
    expect(documentNode.querySelector('[onerror]')).toBeNull()
    expect(documentNode.querySelector('meta[http-equiv="Content-Security-Policy"]')).not.toBeNull()
    expect(documentNode.title).toBe(note.title)
    expect(documentNode.querySelector('h1')?.textContent).toBe(note.title)
    expect(documentNode.querySelectorAll('.tag')).toHaveLength(2)
  })

  it('prevents a Markdown heading or tag from becoming raw HTML', () => {
    const markdown = buildMarkdownExport(
      { title: '<script>alert(1)</script>', tags: ['<img src=x onerror=alert(2)>'] },
      '<p>Safe</p>'
    )

    expect(markdown).not.toContain('<script>')
    expect(markdown).not.toContain('<img')
    expect(markdown).toContain('&lt;script&gt;')
  })

})

describe('safe note import', () => {
  it('round-trips escaped Markdown metadata without interpreting it as HTML', async () => {
    const note = { title: 'Angle <review>', tags: ['security-review'] }
    const markdown = buildMarkdownExport(note, '<p>Verified</p>')
    const parsed = await parseFile(
      new File([markdown], 'review.md', { type: 'text/markdown' })
    )

    expect(parsed.title).toBe(note.title)
    expect(parsed.tags).toEqual(note.tags)
    expect(parsed.content).toBe('<p>Verified</p>')
  })

  it('round-trips title, tags, and supported formatting through standalone HTML', async () => {
    const note = { title: 'Research & review', tags: ['alpha', 'security'] }
    const content = '<h2>Findings</h2><p><strong>Verified</strong> result.</p>'
    const exported = buildHtmlExportDocument(note, content)
    const parsed = await parseFile(new File([exported], 'research.html', { type: 'text/html' }))

    expect(parsed.title).toBe(note.title)
    expect(parsed.tags).toEqual(note.tags)
    expect(parsed.content).toBe(content)
  })

  it('removes executable HTML while preserving safe imported content', async () => {
    const parsed = await parseFile(new File([
      '<html><head><title>Safe title</title></head><body data-tags="safe">' +
      '<p>Keep me</p><img src="x" onerror="globalThis.compromised=true">' +
      '<script>globalThis.compromised=true</script></body></html>',
    ], 'hostile.html', { type: 'text/html' }))

    expect(parsed.title).toBe('Safe title')
    expect(parsed.tags).toEqual(['safe'])
    expect(parsed.content).toContain('<p>Keep me</p>')
    expect(parsed.content).not.toMatch(/<script|onerror/i)
  })

  it('recognizes and validates a complete JSON workspace backup', async () => {
    const parsed = await parseFile(new File([
      JSON.stringify({
        format: 'quicknotes-workspace-backup',
        schemaVersion: 1,
        notes: [{ id: 'n1', title: 'Restored note', content: '<p>Body</p>' }],
        folders: [],
        tags: [],
      }),
    ], 'quicknotes-backup.json', { type: 'application/json' }))

    expect(parsed).toMatchObject({
      kind: 'workspace',
      backup: { notes: [{ id: 'n1', title: 'Restored note' }] },
    })
  })
})
