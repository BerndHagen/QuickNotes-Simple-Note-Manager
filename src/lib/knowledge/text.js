const WORD_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'word' })
  : null

export const normalizeKnowledgeText = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/\s+/gu, ' ')
  .trim()

export const foldKnowledgeText = (value) => normalizeKnowledgeText(value)
  .normalize('NFKD')
  .replace(/\p{Mark}+/gu, '')

export const tokenizeKnowledgeText = (value) => {
  const normalized = normalizeKnowledgeText(value)
  if (!normalized) return []

  const words = WORD_SEGMENTER
    ? [...WORD_SEGMENTER.segment(normalized)]
        .filter((entry) => entry.isWordLike)
        .map((entry) => entry.segment)
    : normalized.match(/[\p{Letter}\p{Number}]+(?:['’_-][\p{Letter}\p{Number}]+)*/gu) || []

  const tokens = []
  for (const word of words) {
    tokens.push(word)
    const folded = foldKnowledgeText(word)
    if (folded && folded !== word) tokens.push(folded)
  }
  return tokens
}

export const collectStructuredText = (value, options = {}) => {
  const maximumCharacters = options.maximumCharacters || 200_000
  const ignoredKeys = new Set(options.ignoredKeys || [
    'id',
    'userId',
    'ownerId',
    'syncStatus',
    '__quicknotes',
  ])
  const output = []
  let length = 0

  const append = (candidate) => {
    const text = String(candidate ?? '').trim()
    if (!text || length >= maximumCharacters) return
    const bounded = text.slice(0, maximumCharacters - length)
    output.push(bounded)
    length += bounded.length + 1
  }

  const visit = (candidate, depth = 0) => {
    if (candidate == null || depth > 16 || length >= maximumCharacters) return
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      append(candidate)
      return
    }
    if (typeof candidate === 'boolean') return
    if (Array.isArray(candidate)) {
      candidate.slice(0, 10_000).forEach((entry) => visit(entry, depth + 1))
      return
    }
    if (typeof candidate === 'object') {
      Object.entries(candidate).slice(0, 10_000).forEach(([key, entry]) => {
        if (!ignoredKeys.has(key)) visit(entry, depth + 1)
      })
    }
  }

  visit(value)
  return output.join(' ')
}

export const htmlToKnowledgeText = (html) => {
  const source = String(html || '')
  if (!source) return ''
  if (typeof DOMParser !== 'undefined') {
    const separated = source.replace(
      /<(br\s*\/?|\/(?:p|div|h[1-6]|li|blockquote|pre|tr))\s*>/giu,
      ' '
    )
    const parsed = new DOMParser().parseFromString(separated, 'text/html')
    parsed.querySelectorAll('script, style, noscript').forEach((node) => node.remove())
    return parsed.body.textContent
      ?.replace(/\s+/gu, ' ')
      .trim() || ''
  }
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/\s+/gu, ' ')
    .trim()
}
