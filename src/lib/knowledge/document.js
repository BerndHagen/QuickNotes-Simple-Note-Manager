import { normalizeContentDescriptor } from '../contentModel'
import { collectStructuredText, htmlToKnowledgeText, normalizeKnowledgeText } from './text'

export const KNOWLEDGE_SCHEMA_VERSION = 2
export const MAX_SEARCHABLE_TEXT_LENGTH = 200_000

const DERIVED_TEXT_FIELDS = [
  'title',
  'headingsText',
  'tagsText',
  'bodyText',
  'objectText',
  'resourceText',
  'recognizedText',
  'metadataText',
  'searchableText',
]

export const isValidSearchDocument = (document, ownerId = null) => Boolean(
  document &&
  typeof document.noteId === 'string' && document.noteId.length > 0 && document.noteId.length <= 128 &&
  typeof document.ownerId === 'string' && (!ownerId || document.ownerId === ownerId) &&
  document.schemaVersion === KNOWLEDGE_SCHEMA_VERSION &&
  typeof document.sourceFingerprint === 'string' && document.sourceFingerprint.length <= 10_000 &&
  DERIVED_TEXT_FIELDS.every((field) =>
    typeof document[field] === 'string' && document[field].length <= MAX_SEARCHABLE_TEXT_LENGTH + 80_000
  ) &&
  Array.isArray(document.headings) && document.headings.length <= 10_000 &&
  Array.isArray(document.locations) && document.locations.length <= 20_000 &&
  Array.isArray(document.tags) && document.tags.length <= 100
)

const bounded = (value, maximum = MAX_SEARCHABLE_TEXT_LENGTH) => String(value ?? '').slice(0, maximum)
const joined = (values) => values.filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim()

export const extractDocumentHeadings = (html) => {
  const source = String(html || '')
  if (!source || typeof DOMParser === 'undefined') return []
  const parsed = new DOMParser().parseFromString(source, 'text/html')
  return [...parsed.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .map((heading, index) => ({
      anchorId: heading.getAttribute('data-anchor-id') || null,
      level: Number(heading.tagName.slice(1)),
      text: heading.textContent?.replace(/\s+/gu, ' ').trim() || '',
      order: index,
    }))
    .filter((heading) => heading.text)
}

const spatialText = (objects = [], resources = [], notesById = new Map()) => {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
  const objectParts = []
  const resourceParts = []
  const locations = []

  for (const object of objects) {
    if (!object || object.kind === 'stroke') continue
    if (['text', 'sticky', 'indexCard'].includes(object.kind)) {
      const text = joined([object.data?.title, object.data?.text, object.data?.label])
      objectParts.push(text)
      if (text) locations.push({
        kind: 'object',
        objectId: object.id,
        pageId: object.pageId || null,
        objectKind: object.kind,
        text: bounded(text, 10_000),
      })
    } else if (object.kind === 'noteLink') {
      const target = notesById.get(object.data?.targetNoteId)
      const text = joined([object.data?.label, target?.title])
      objectParts.push(text)
      if (text) locations.push({
        kind: 'object',
        objectId: object.id,
        pageId: object.pageId || null,
        objectKind: object.kind,
        text: bounded(text, 10_000),
      })
    }
    if (object.kind === 'image' && object.data?.resourceId) {
      const resource = resourceById.get(object.data.resourceId)
      const text = joined([resource?.name, resource?.fileName, resource?.mimeType, resource?.altText])
      resourceParts.push(text)
      if (text) locations.push({
        kind: 'resource',
        objectId: object.id,
        pageId: object.pageId || null,
        resourceId: resource?.id || object.data.resourceId,
        text: bounded(text, 10_000),
      })
    }
  }

  return {
    objectText: bounded(joined(objectParts)),
    resourceText: bounded(joined(resourceParts), 50_000),
    locations,
  }
}

const recognizedText = (rows = []) => {
  const current = rows
    .filter((row) => row?.status === 'current' && typeof row.text === 'string' && row.text.trim())
    .sort((left, right) => {
      const leftPage = left.sourcePageNumber ?? Number.MAX_SAFE_INTEGER
      const rightPage = right.sourcePageNumber ?? Number.MAX_SAFE_INTEGER
      const leftTime = left.sourceTimeRange?.startMs ?? Number.MAX_SAFE_INTEGER
      const rightTime = right.sourceTimeRange?.startMs ?? Number.MAX_SAFE_INTEGER
      return leftPage - rightPage || leftTime - rightTime || left.id.localeCompare(right.id)
    })
  return {
    text: bounded(joined(current.map((row) => row.text)), 150_000),
    locations: current.map((row) => ({
      kind: 'recognition',
      recognitionId: row.id,
      recognitionType: row.type,
      objectId: row.sourceObjectIds?.[0] || null,
      objectIds: row.sourceObjectIds || [],
      pageId: row.sourcePageId || null,
      resourceId: row.sourceResourceId || null,
      pageNumber: row.sourcePageNumber || null,
      timeMs: row.sourceTimeRange?.startMs ?? null,
      timeRange: row.sourceTimeRange || null,
      region: row.sourceRegion || null,
      text: bounded(row.text, 20_000),
    })),
  }
}

export const createSearchDocument = ({
  ownerId,
  note,
  folder = null,
  spatialObjects = [],
  resources = [],
  recognizedContent = [],
  notesById = new Map(),
}) => {
  if (!ownerId || !note?.id) throw new Error('A workspace owner and note identity are required.')
  const descriptor = normalizeContentDescriptor(note)
  const headings = descriptor.contentKind === 'document'
    ? extractDocumentHeadings(note.content)
    : []
  const documentBody = descriptor.contentKind === 'document'
    ? htmlToKnowledgeText(note.content)
    : ''
  const structuredBody = descriptor.contentKind === 'structured' || note.noteType === 'brainstorm'
    ? collectStructuredText(note.noteData, { maximumCharacters: MAX_SEARCHABLE_TEXT_LENGTH })
    : ''
  const spatial = ['paper', 'canvas'].includes(descriptor.contentKind)
    ? spatialText(spatialObjects, resources, notesById)
    : { objectText: '', resourceText: '', locations: [] }
  const recognized = recognizedText(recognizedContent)
  const title = bounded(note.title || 'Untitled note', 500)
  const tags = Array.isArray(note.tags) ? note.tags.map((tag) => bounded(tag, 100)).slice(0, 100) : []
  const metadataText = bounded(joined([
    folder?.name,
    note.noteType,
    descriptor.contentKind,
    note.starred ? 'starred favorite' : '',
    note.pinned ? 'pinned' : '',
  ]), 10_000)
  const bodyText = bounded(joined([documentBody, structuredBody]))
  const headingsText = bounded(headings.map((heading) => heading.text).join(' '), 50_000)
  const tagsText = bounded(tags.join(' '), 10_000)

  return {
    ownerId,
    noteId: String(note.id),
    id: String(note.id),
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    sourceRevision: String(note.updatedAt || note.createdAt || ''),
    title,
    titleNormalized: normalizeKnowledgeText(title),
    contentKind: descriptor.contentKind,
    noteType: note.noteType || 'standard',
    headings,
    locations: [
      ...headings.map((heading) => ({
        kind: 'heading',
        anchorId: heading.anchorId,
        text: heading.text,
        level: heading.level,
      })),
      ...spatial.locations,
      ...recognized.locations,
    ],
    headingsText,
    tags,
    tagsText,
    folderId: note.folderId || null,
    folderName: folder?.name || '',
    bodyText,
    objectText: spatial.objectText,
    resourceText: spatial.resourceText,
    recognizedText: recognized.text,
    metadataText,
    searchableText: bounded(joined([
      title,
      headingsText,
      tagsText,
      bodyText,
      spatial.objectText,
      spatial.resourceText,
      recognized.text,
      metadataText,
    ]), MAX_SEARCHABLE_TEXT_LENGTH + 80_000),
    starred: Boolean(note.starred),
    pinned: Boolean(note.pinned),
    deleted: Boolean(note.deleted),
    archived: Boolean(note.archived),
    shared: Boolean(note.isShared),
    createdAt: note.createdAt || null,
    updatedAt: note.updatedAt || note.createdAt || new Date(0).toISOString(),
  }
}
