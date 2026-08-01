import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, htmlToPlainText, markdownToHtml } from './noteTransfer'

describe('note transfer conversions', () => {
  it('preserves fenced code and task state when exporting HTML to Markdown', () => {
    const markdown = htmlToMarkdown(`
      <pre><code class="language-js">const value = \`literal\`;
console.log(value)</code></pre>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="true"><p>Shipped</p></li>
        <li data-type="taskItem" data-checked="false"><p>Review</p></li>
      </ul>
      <p>Use <code>npm test</code>.</p>
    `)

    expect(markdown).toContain('```js\nconst value = `literal`;\nconsole.log(value)\n```')
    expect(markdown).toContain('- [x] Shipped')
    expect(markdown).toContain('- [ ] Review')
    expect(markdown).toContain('Use `npm test`\\.')
  })

  it('protects code from inline formatting and creates the correct list types on import', () => {
    const html = markdownToHtml(`
\`\`\`js
const marker = "**not bold**";
\`\`\`

- [x] Complete
- [ ] Pending

1. First
2. Second
    `)

    const documentNode = new DOMParser().parseFromString(html, 'text/html')
    expect(documentNode.querySelector('pre code.language-js')?.textContent).toBe(
      'const marker = "**not bold**";'
    )
    expect(documentNode.querySelector('pre strong')).toBeNull()
    expect(documentNode.querySelectorAll('ul[data-type="taskList"] > li')).toHaveLength(2)
    expect(documentNode.querySelector('li[data-checked="true"]')?.textContent).toBe('Complete')
    expect(documentNode.querySelectorAll('ol > li')).toHaveLength(2)
  })

  it('round-trips escaped prose and code containing Markdown delimiters', () => {
    const source = '<p>Literal *stars* and punctuation.</p>' +
      '<p>Run <code>echo `value`</code>.</p>' +
      '<pre><code class="language-md">```nested```</code></pre>'
    const markdown = htmlToMarkdown(source)
    const restored = new DOMParser().parseFromString(markdownToHtml(markdown), 'text/html')

    expect(markdown).toContain('````md\n```nested```\n````')
    expect(restored.querySelectorAll('p')[0].textContent).toBe('Literal *stars* and punctuation.')
    expect(restored.querySelectorAll('p')[1].textContent).toBe('Run echo `value`.')
    expect(restored.querySelector('p code')?.textContent).toBe('echo `value`')
    expect(restored.querySelector('pre code')?.textContent).toBe('```nested```')
  })

  it('sanitizes generated HTML and does not create executable raw markup', () => {
    const html = markdownToHtml(
      '[unsafe](javascript:alert(1))\n\n<script>globalThis.compromised = true</script>'
    )
    const documentNode = new DOMParser().parseFromString(html, 'text/html')

    expect(documentNode.querySelector('script')).toBeNull()
    expect(documentNode.querySelector('a')?.hasAttribute('href')).toBe(false)
    expect(documentNode.body.textContent).toContain('<script>globalThis.compromised = true</script>')
  })

  it('extracts text only after sanitizing imported markup', () => {
    expect(htmlToPlainText('<p>Hello</p><script>bad()</script><p>world</p>')).toBe('Helloworld')
  })
})
