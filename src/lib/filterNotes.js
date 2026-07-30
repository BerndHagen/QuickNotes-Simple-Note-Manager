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

export const getSearchableText = (note) => {
  const cached = plainTextCache.get(note.id)
  if (cached && cached.source === note.content) return cached.text
  const text = htmlToPlainText(note.content || '').toLowerCase()
  plainTextCache.set(note.id, { source: note.content, text })
  return text
}

export const clearSearchCache = () => plainTextCache.clear()

/**
 * The single filtering implementation for the note list, global search
 * and the store selector.
 *
 * Previously the store and NotesList each had their own version. They
 * disagreed in two ways that were visible to users: the store's copy
 * had no `__starred__` case (so the Favourites view would have returned
 * every note) and it searched the raw HTML, so a query like "div" or
 * "span" matched every formatted note.
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
