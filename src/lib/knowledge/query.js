import { normalizeKnowledgeText } from './text.js'

const FILTER_PATTERN = /(?:^|\s)(type|kind|tag|folder|is|before|after):(?:"([^"]+)"|(\S+))/giu
const VALID_IS_FILTERS = new Set(['starred', 'pinned', 'archived', 'trash', 'shared'])

export const parseKnowledgeQuery = (input) => {
  const raw = String(input || '').slice(0, 2_000)
  const filters = {
    noteTypes: [],
    contentKinds: [],
    tags: [],
    folders: [],
    states: [],
    before: null,
    after: null,
  }
  const consumed = []
  let match
  while ((match = FILTER_PATTERN.exec(raw))) {
    const [full, field, quoted, plain] = match
    const value = normalizeKnowledgeText(quoted || plain)
    consumed.push([match.index, match.index + full.length])
    if (!value) continue
    if (field.toLowerCase() === 'type') filters.noteTypes.push(value)
    else if (field.toLowerCase() === 'kind') filters.contentKinds.push(value)
    else if (field.toLowerCase() === 'tag') filters.tags.push(value)
    else if (field.toLowerCase() === 'folder') filters.folders.push(value)
    else if (field.toLowerCase() === 'is' && VALID_IS_FILTERS.has(value)) filters.states.push(value)
    else if (field.toLowerCase() === 'before') filters.before = value
    else if (field.toLowerCase() === 'after') filters.after = value
  }

  let remaining = raw
  for (const [start, end] of consumed.reverse()) remaining = `${remaining.slice(0, start)} ${remaining.slice(end)}`
  const phrases = []
  remaining = remaining.replace(/"([^"]+)"/gu, (_, phrase) => {
    const normalized = normalizeKnowledgeText(phrase)
    if (normalized) phrases.push(normalized)
    return ` ${phrase} `
  })
  const text = normalizeKnowledgeText(remaining)

  return {
    raw,
    text,
    phrases: [...new Set(phrases)],
    filters: Object.fromEntries(Object.entries(filters).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...new Set(value)] : value,
    ])),
  }
}

export const searchDocumentMatchesFilters = (document, filters = {}) => {
  if (filters.noteType && document.noteType !== filters.noteType) return false
  if (filters.noteTypes?.length && !filters.noteTypes.includes(normalizeKnowledgeText(document.noteType))) return false
  if (filters.contentKinds?.length && !filters.contentKinds.includes(normalizeKnowledgeText(document.contentKind))) return false
  if (filters.tags?.length) {
    const tags = new Set((document.tags || []).map(normalizeKnowledgeText))
    if (!filters.tags.every((tag) => tags.has(tag))) return false
  }
  if (filters.folders?.length && !filters.folders.includes(normalizeKnowledgeText(document.folderName))) return false
  if (filters.states?.includes('starred') && !document.starred) return false
  if (filters.states?.includes('pinned') && !document.pinned) return false
  if (filters.states?.includes('archived') && !document.archived) return false
  if (filters.states?.includes('trash') && !document.deleted) return false
  if (filters.states?.includes('shared') && !document.shared) return false
  if (!filters.states?.includes('trash') && document.deleted) return false
  if (!filters.states?.includes('archived') && document.archived) return false
  const updated = Date.parse(document.updatedAt)
  if (filters.before && Number.isFinite(updated) && updated >= Date.parse(filters.before)) return false
  if (filters.after && Number.isFinite(updated) && updated < Date.parse(filters.after)) return false
  return true
}
