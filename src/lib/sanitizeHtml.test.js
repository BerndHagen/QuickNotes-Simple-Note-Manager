import { describe, expect, it } from 'vitest'
import { escapeHtml, sanitizeNoteHtml } from './sanitizeHtml'

describe('sanitizeNoteHtml', () => {
  it('removes executable markup and unsafe URLs', () => {
    const result = sanitizeNoteHtml(
      '<p onclick="window.pwned=true">Safe</p>' +
      '<script>window.pwned=true</script>' +
      '<a href="javascript:window.pwned=true">bad link</a>' +
      '<img src="x" onerror="window.pwned=true">'
    )

    expect(result).toContain('<p>Safe</p>')
    expect(result).not.toMatch(/script|onclick|onerror|javascript:/i)
  })

  it('preserves editor task and table structure', () => {
    const result = sanitizeNoteHtml(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false">' +
      '<label><input type="checkbox"><span></span></label><div><p>Task</p></div></li></ul>' +
      '<table><tbody><tr><td>Cell</td></tr></tbody></table>'
    )

    expect(result).toContain('data-type="taskList"')
    expect(result).toContain('type="checkbox"')
    expect(result).toContain('<table>')
  })

  it('preserves stable knowledge identities as inert data attributes', () => {
    const result = sanitizeNoteHtml(
      '<h2 data-anchor-id="heading-1">Plan</h2>' +
      '<p><a class="note-link" href="#note/target?anchor=heading-2" data-note-id="target" data-note-anchor-id="heading-2">Target</a></p>'
    )
    expect(result).toContain('data-anchor-id="heading-1"')
    expect(result).toContain('data-note-id="target"')
    expect(result).toContain('data-note-anchor-id="heading-2"')
  })
})

describe('escapeHtml', () => {
  it('escapes text interpolated into generated documents', () => {
    expect(escapeHtml('<img title="x">&\'')).toBe(
      '&lt;img title=&quot;x&quot;&gt;&amp;&#39;'
    )
  })
})
