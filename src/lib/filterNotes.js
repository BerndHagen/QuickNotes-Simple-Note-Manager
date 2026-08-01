import { htmlToPlainText } from './utils'

export const STARRED_FILTER = '__starred__'

/**
 * Cache of plain-text projections of note HTML, keyed by note id and
 * invalidated when the HTML changes.
 *
 * `htmlToPlainText` builds a detached DOM node, so searching without a
 * cache re-parsed every note's HTML on every keystroke.
 */
const plainTextCache = new Map()

const collectStructuredText = (value, parts, seen) => {
  if (value == null) return
  if (typeof value === 'string' || typeof value === 'number') {
    parts.push(String(value))
    return
  }
  if (typeof value !== 'object' || seen.has(value)) return

  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredText(item, parts, seen))
  } else {
    Object.values(value).forEach((item) => collectStructuredText(item, parts, seen))
  }
}

export const getSearchableText = (note) => {
  const cached = plainTextCache.get(note.id)
  if (
    cached &&
    cached.contentSource === note.content &&
    cached.structuredSource === note.noteData
  ) {
    return cached.text
  }

  const structuredParts = []
  collectStructuredText(note.noteData, structuredParts, new WeakSet())
  const text = [htmlToPlainText(note.content || ''), ...structuredParts].join(' ').toLowerCase()
  plainTextCache.set(note.id, {
    contentSource: note.content,
    structuredSource: note.noteData,
    text,
  })
  return text
}

export const clearSearchCache = () => plainTextCache.clear()

/**
 * The single filtering implementation behind the note list, global search
 * and the store selector, so the three can never disagree about what a
 * query or a view matches.
 *
 * Body text is matched against the plain-text projection rather than the
 * stored HTML, so a query like "div" or "span" does not match every
 * formatted note.
 */
export const filterNotes = (
  notes,
  { folderId = null, tagFilter = null, query = '', scope = 'active' } = {}
) => {
  const normalisedQuery = query.trim().toLowerCase()

  return notes.filter((note) => {
    if (scope === 'active' && (note.deleted || note.archived)) return false
    if (scope === 'trash' && !note.deleted) return false
    if (scope === 'archive' && (!note.archived || note.deleted)) return false

    if (tagFilter === STARRED_FILTER) {
      if (!note.starred) return false
    } else if (tagFilter && !note.tags?.includes(tagFilter)) {
      return false
    }

    if (folderId && note.folderId !== folderId) return false

    if (normalisedQuery) {
      const inTitle = (note.title || '').toLowerCase().includes(normalisedQuery)
      const inTags = note.tags?.some((tag) => tag.toLowerCase().includes(normalisedQuery))
      // Only fall back to the expensive body search when cheaper fields miss.
      if (!inTitle && !inTags && !getSearchableText(note).includes(normalisedQuery)) return false
    }

    return true
  })
}
