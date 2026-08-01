import { escapeHtml, sanitizeNoteHtml } from './sanitizeHtml'

const escapeMarkdownText = (value) =>
  String(value || '')
    .replaceAll('\\', '\\\\')
    .replace(/([`*_[\]{}#+.!|>~-])/g, '\\$1')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const inlineCode = (value) => {
  const text = String(value || '')
  if (!text.includes('`')) return `\`${text}\``
  return `\`\` ${text} \`\``
}

const codeFence = (value) => {
  const longestRun = Math.max(0, ...(String(value || '').match(/`+/g) || []).map((run) => run.length))
  return '`'.repeat(Math.max(3, longestRun + 1))
}

/**
 * Converts sanitized editor HTML to portable Markdown without allowing text
 * nodes to become raw HTML. Code blocks and task items are handled before
 * their inline and generic-list counterparts by the DOM traversal itself.
 */
export function htmlToMarkdown(value) {
  if (!value) return ''

  const parser = new DOMParser()
  const documentNode = parser.parseFromString(
    `<body>${sanitizeNoteHtml(value)}</body>`,
    'text/html'
  )

  const renderChildren = (node) => Array.from(node.childNodes).map(renderNode).join('')

  function renderList(node, ordered) {
    const items = Array.from(node.children).filter((child) => child.tagName === 'LI')
    const lines = items.map((item, index) => {
      const checked = item.getAttribute('data-checked')
      const marker = checked == null
        ? ordered ? `${index + 1}.` : '-'
        : `- [${checked === 'true' ? 'x' : ' '}]`
      const content = renderChildren(item).trim().replace(/\n{2,}/g, ' ')
      return `${marker} ${content}`.trimEnd()
    })
    return `${lines.join('\n')}\n\n`
  }

  function renderNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.textContent)
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const tag = node.tagName.toLowerCase()
    const children = () => renderChildren(node)

    if (/^h[1-6]$/.test(tag)) {
      return `${'#'.repeat(Number(tag.slice(1)))} ${children().trim()}\n\n`
    }

    switch (tag) {
      case 'strong':
      case 'b':
        return `**${children()}**`
      case 'em':
      case 'i':
        return `*${children()}*`
      case 'u':
        return `_${children()}_`
      case 's':
      case 'strike':
        return `~~${children()}~~`
      case 'pre': {
        const code = node.querySelector('code')
        const text = code?.textContent || node.textContent || ''
        const language = code?.className.match(/(?:^|\s)language-([\w-]+)/)?.[1] || ''
        const fence = codeFence(text)
        return `${fence}${language}\n${text.replace(/\n$/, '')}\n${fence}\n\n`
      }
      case 'code':
        return node.parentElement?.tagName === 'PRE' ? node.textContent || '' : inlineCode(node.textContent)
      case 'a': {
        const href = node.getAttribute('href')
        return href ? `[${children()}](${href.replaceAll(')', '%29')})` : children()
      }
      case 'img': {
        const src = node.getAttribute('src')
        if (!src) return ''
        return `![${escapeMarkdownText(node.getAttribute('alt') || '')}](${src.replaceAll(')', '%29')})`
      }
      case 'ul':
        return renderList(node, false)
      case 'ol':
        return renderList(node, true)
      case 'blockquote':
        return `${children().trim().split('\n').map((line) => `> ${line}`).join('\n')}\n\n`
      case 'hr':
        return '---\n\n'
      case 'p':
        return `${children().trimEnd()}\n\n`
      case 'br':
        return '\n'
      case 'div':
        return `${children()}\n`
      case 'table':
        return `${Array.from(node.querySelectorAll('tr')).map((row) =>
          Array.from(row.children).map((cell) => renderChildren(cell).trim()).join(' | ')
        ).join('\n')}\n\n`
      default:
        return children()
    }
  }

  return renderChildren(documentNode.body).replace(/\n{3,}/g, '\n\n').trim()
}

const codeToken = (index) => `\uE000CODE${index}\uE001`
const inlineToken = (index) => `\uE000INLINE${index}\uE001`

const renderInlineMarkdown = (source) => {
  const inlineBlocks = []
  const escapedCharacters = []
  let html = source.replace(/\\([\\`*_[\]{}#+.!|>~-])/g, (_match, character) => {
    const token = `\uE000ESC${escapedCharacters.length}\uE001`
    escapedCharacters.push(character)
    return token
  })
  html = html.replace(/(`+)([^\n]*?)\1/g, (_match, _delimiter, code) => {
    const token = inlineToken(inlineBlocks.length)
    const normalizedCode = code.startsWith(' ') && code.endsWith(' ') && code.trim()
      ? code.slice(1, -1)
      : code
    inlineBlocks.push(`<code>${normalizedCode}</code>`)
    return token
  })

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>')

  inlineBlocks.forEach((block, index) => {
    html = html.replaceAll(inlineToken(index), block)
  })
  escapedCharacters.forEach((character, index) => {
    html = html.replaceAll(`\uE000ESC${index}\uE001`, character)
  })
  return html
}

const isBlockStart = (line) =>
  /^\uE000CODE\d+\uE001$/.test(line) ||
  /^#{1,6}\s+/.test(line) ||
  /^>\s?/.test(line) ||
  /^(?:---|\*\**)\s*$/.test(line) ||
  /^[-*+]\s+/.test(line) ||
  /^\d+\.\s+/.test(line)

/**
 * Converts the Markdown subset QuickNotes exports into editor HTML. Fenced
 * and inline code are tokenized before any emphasis or list processing, then
 * the completed document is sanitized before it crosses the import boundary.
 */
export function markdownToHtml(value) {
  if (!value) return ''

  const fencedBlocks = []
  let source = escapeHtml(String(value).replaceAll('\r\n', '\n'))
  source = source.replace(/(`{3,})([^\n`]*)\n([\s\S]*?)\1[ \t]*(?=\n|$)/g, (_match, _fence, language, code) => {
    const safeLanguage = language.trim().replace(/[^\w-]/g, '') || 'plaintext'
    const token = codeToken(fencedBlocks.length)
    fencedBlocks.push(
      `<pre><code class="language-${safeLanguage}">${code.replace(/\n$/, '')}</code></pre>`
    )
    return token
  })

  const lines = source.split('\n')
  const blocks = []

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    const codeMatch = line.match(/^\uE000CODE(\d+)\uE001$/)
    if (codeMatch) {
      blocks.push(fencedBlocks[Number(codeMatch[1])])
      index += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`)
      index += 1
      continue
    }

    if (/^(?:---|\*\**)$/.test(line)) {
      blocks.push('<hr />')
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(`<blockquote>${quote.map(renderInlineMarkdown).join('<br />')}</blockquote>`)
      continue
    }

    if (/^- \[[ xX]\]\s+/.test(line)) {
      const items = []
      while (index < lines.length) {
        const task = lines[index].trim().match(/^- \[([ xX])\]\s+(.+)$/)
        if (!task) break
        items.push(
          `<li data-type="taskItem" data-checked="${task[1].toLowerCase() === 'x'}">${renderInlineMarkdown(task[2])}</li>`
        )
        index += 1
      }
      blocks.push(`<ul data-type="taskList">${items.join('')}</ul>`)
      continue
    }

    if (/^[-*+]\s+/.test(line)) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].trim().match(/^[-*+]\s+(.+)$/)
        if (!item || /^- \[[ xX]\]\s+/.test(lines[index].trim())) break
        items.push(`<li>${renderInlineMarkdown(item[1])}</li>`)
        index += 1
      }
      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].trim().match(/^\d+\.\s+(.+)$/)
        if (!item) break
        items.push(`<li>${renderInlineMarkdown(item[1])}</li>`)
        index += 1
      }
      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index].trim())) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br />')}</p>`)
  }

  return sanitizeNoteHtml(blocks.join(''))
}

export function htmlToPlainText(value) {
  if (!value) return ''
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(
    `<body>${sanitizeNoteHtml(value)}</body>`,
    'text/html'
  )
  return documentNode.body.textContent || ''
}
