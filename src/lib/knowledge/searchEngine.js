import MiniSearch from 'minisearch'
import { parseKnowledgeQuery, searchDocumentMatchesFilters } from './query.js'
import { foldKnowledgeText, tokenizeKnowledgeText } from './text.js'

export const SEARCH_FIELDS = Object.freeze([
  'title',
  'headingsText',
  'tagsText',
  'objectText',
  'bodyText',
  'recognizedText',
  'resourceText',
  'metadataText',
])

const FIELD_BOOST = Object.freeze({
  title: 8,
  headingsText: 5,
  tagsText: 3.5,
  objectText: 2.6,
  bodyText: 1.6,
  recognizedText: 1.35,
  resourceText: 1.1,
  metadataText: 0.8,
})

const matchField = (document, parsed) => {
  const needles = parsed.phrases.length > 0
    ? parsed.phrases.map(foldKnowledgeText)
    : tokenizeKnowledgeText(parsed.text).map(foldKnowledgeText)
  if (needles.length === 0) return 'recent'
  const containsQuery = (value) => {
    const folded = foldKnowledgeText(value)
    return needles.every((needle) => folded.includes(needle))
  }
  if (containsQuery(document.title)) return 'title'
  if (containsQuery(document.headingsText)) return 'heading'
  if (containsQuery(document.tagsText)) return 'tag'
  if (containsQuery(document.objectText)) return 'object'
  if (containsQuery(document.bodyText)) return 'content'
  if (containsQuery(document.recognizedText)) return 'recognized'
  if (containsQuery(document.resourceText)) return 'attachment'
  return 'metadata'
}

const compactSnippet = (text, parsed, maximum = 180) => {
  const value = String(text || '').replace(/\s+/gu, ' ').trim()
  if (!value) return ''
  const normalized = foldKnowledgeText(value)
  const candidates = [...parsed.phrases, ...tokenizeKnowledgeText(parsed.text)].map(foldKnowledgeText)
  let index = -1
  let matchLength = 0
  for (const candidate of candidates) {
    const found = normalized.indexOf(candidate)
    if (found !== -1 && (index === -1 || found < index)) {
      index = found
      matchLength = candidate.length
    }
  }
  if (index === -1) return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value
  const start = Math.max(0, index - Math.floor((maximum - matchLength) / 2))
  const end = Math.min(value.length, start + maximum)
  return `${start > 0 ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`
}

const resultContext = (document, parsed) => {
  const field = matchField(document, parsed)
  const heading = field === 'heading'
    ? document.headings?.find((candidate) => {
        const value = foldKnowledgeText(candidate.text)
        return parsed.phrases.some((phrase) => value.includes(foldKnowledgeText(phrase))) ||
          tokenizeKnowledgeText(parsed.text).some((term) => value.includes(foldKnowledgeText(term)))
      })
    : null
  const location = ['object', 'attachment', 'recognized'].includes(field)
    ? document.locations?.find((candidate) => {
        const value = foldKnowledgeText(candidate.text)
        return parsed.phrases.some((phrase) => value.includes(foldKnowledgeText(phrase))) ||
          tokenizeKnowledgeText(parsed.text).some((term) => value.includes(foldKnowledgeText(term)))
      })
    : null
  const source = field === 'title'
    ? document.title
    : field === 'heading'
      ? heading?.text || document.headingsText
      : field === 'tag'
        ? document.tagsText
        : field === 'object'
          ? document.objectText
          : field === 'recognized'
            ? document.recognizedText
          : field === 'attachment'
            ? document.resourceText
            : field === 'metadata'
              ? document.metadataText
              : document.bodyText || document.objectText || document.metadataText
  return {
    matchField: field,
    snippet: compactSnippet(source, parsed),
    target: heading?.anchorId
      ? { noteId: document.noteId, anchorId: heading.anchorId }
      : location?.kind === 'recognition'
        ? {
            noteId: document.noteId,
            objectId: location.objectId || null,
            recognitionId: location.recognitionId || null,
            resourceId: location.resourceId || null,
            pageId: location.pageId || null,
            pageNumber: location.pageNumber || null,
            timeMs: location.timeMs ?? null,
            region: location.region || null,
          }
        : location?.objectId
          ? { noteId: document.noteId, objectId: location.objectId }
        : { noteId: document.noteId },
  }
}

const createIndex = () => new MiniSearch({
  idField: 'noteId',
  fields: SEARCH_FIELDS,
  storeFields: ['noteId'],
  tokenize: tokenizeKnowledgeText,
  processTerm: (term) => term,
  searchOptions: {
    boost: FIELD_BOOST,
    combineWith: 'AND',
  },
})

export const createKnowledgeSearchEngine = (initialDocuments = []) => {
  let index = createIndex()
  const documents = new Map()

  const replaceAll = (nextDocuments) => {
    index = createIndex()
    documents.clear()
    const valid = (nextDocuments || []).filter((document) => document?.noteId)
    valid.forEach((document) => documents.set(document.noteId, document))
    if (valid.length > 0) index.addAll(valid)
  }

  const upsert = (document) => {
    if (!document?.noteId) return
    if (documents.has(document.noteId)) index.replace(document)
    else index.add(document)
    documents.set(document.noteId, document)
  }

  const remove = (noteId) => {
    const current = documents.get(noteId)
    if (!current) return
    index.discard(noteId)
    documents.delete(noteId)
  }

  const search = (input, options = {}) => {
    const parsed = typeof input === 'string' ? parseKnowledgeQuery(input) : input
    const filters = {
      ...parsed.filters,
      ...(options.noteType && options.noteType !== 'all' ? { noteType: options.noteType } : {}),
    }
    const limit = Math.max(1, Math.min(Number(options.limit) || 60, 200))

    if (!parsed.text && parsed.phrases.length === 0) {
      return [...documents.values()]
        .filter((document) => searchDocumentMatchesFilters(document, filters))
        .sort((left, right) => {
          if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
          return Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.noteId.localeCompare(right.noteId)
        })
        .slice(0, Math.min(limit, 12))
        .map((document) => ({
          ...document,
          score: 0,
          matchField: 'recent',
          snippet: document.bodyText || document.objectText || document.metadataText,
          target: { noteId: document.noteId },
        }))
    }

    const queryText = parsed.text || parsed.phrases.join(' ')
    const results = index.search(queryText, {
      boost: FIELD_BOOST,
      combineWith: 'AND',
      prefix: (term) => term.length >= 2,
      fuzzy: (term) => term.length >= 5 ? Math.min(0.2, 2 / term.length) : false,
      filter: ({ noteId }) => {
        const document = documents.get(noteId)
        return Boolean(document && searchDocumentMatchesFilters(document, filters))
      },
    })

    return results
      .map((result) => {
        const document = documents.get(result.id)
        if (!document) return null
        const normalizedSearchable = foldKnowledgeText(document.searchableText)
        if (parsed.phrases.some((phrase) => !normalizedSearchable.includes(foldKnowledgeText(phrase)))) return null
        const exactTitle = foldKnowledgeText(document.title) === foldKnowledgeText(queryText)
        const phraseBoost = parsed.phrases.reduce(
          (score, phrase) => score + (foldKnowledgeText(document.title).includes(foldKnowledgeText(phrase)) ? 12 : 5),
          0
        )
        const stateBoost = (document.pinned ? 0.35 : 0) + (document.starred ? 0.2 : 0)
        return {
          ...document,
          ...resultContext(document, parsed),
          score: result.score + phraseBoost + stateBoost + (exactTitle ? 20 : 0),
          matchedTerms: result.terms || [],
        }
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score ||
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
        left.noteId.localeCompare(right.noteId))
      .slice(0, limit)
  }

  replaceAll(initialDocuments)
  return { replaceAll, upsert, remove, search, size: () => documents.size }
}
