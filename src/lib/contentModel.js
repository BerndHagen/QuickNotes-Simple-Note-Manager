export const CONTENT_KINDS = Object.freeze({
  DOCUMENT: 'document',
  STRUCTURED: 'structured',
  PAPER: 'paper',
  CANVAS: 'canvas',
})

export const CONTENT_SCHEMA_VERSION = 1

const VALID_CONTENT_KINDS = new Set(Object.values(CONTENT_KINDS))
const STRUCTURED_NOTE_TYPES = new Set([
  'todo',
  'project',
  'meeting',
  'journal',
  'brainstorm',
  'shopping',
  'weekly',
])

export function contentKindForNoteType(noteType) {
  if (noteType === 'paper') return CONTENT_KINDS.PAPER
  if (noteType === 'canvas') return CONTENT_KINDS.CANVAS
  if (STRUCTURED_NOTE_TYPES.has(noteType)) return CONTENT_KINDS.STRUCTURED
  return CONTENT_KINDS.DOCUMENT
}

export function normalizeContentDescriptor(note = {}) {
  const contentKind = VALID_CONTENT_KINDS.has(note.contentKind)
    ? note.contentKind
    : contentKindForNoteType(note.noteType)
  const contentSchemaVersion = Number.isInteger(note.contentSchemaVersion) && note.contentSchemaVersion > 0
    ? note.contentSchemaVersion
    : CONTENT_SCHEMA_VERSION
  return { contentKind, contentSchemaVersion }
}

export function migrateNoteContentMetadata(note) {
  if (!note || typeof note !== 'object') return note
  const descriptor = normalizeContentDescriptor(note)
  if (
    note.contentKind === descriptor.contentKind &&
    note.contentSchemaVersion === descriptor.contentSchemaVersion
  ) return note
  return { ...note, ...descriptor }
}

export function isSpatialContentKind(kind) {
  return kind === CONTENT_KINDS.PAPER || kind === CONTENT_KINDS.CANVAS
}

/**
 * Supabase's current note table has a JSON note_data extension point. Keep
 * the canonical descriptor there until dedicated cloud spatial tables land.
 * Spatial payloads themselves never go into this object.
 */
export function addContentDescriptorToNoteData(noteData, note) {
  const descriptor = normalizeContentDescriptor(note)
  const value = noteData && typeof noteData === 'object' && !Array.isArray(noteData)
    ? noteData
    : {}
  return {
    ...value,
    __quicknotes: descriptor,
  }
}

export function extractContentDescriptorFromNoteData(noteType, rawNoteData) {
  const value = rawNoteData && typeof rawNoteData === 'object' && !Array.isArray(rawNoteData)
    ? rawNoteData
    : {}
  const { __quicknotes: metadata, ...noteData } = value
  const descriptor = normalizeContentDescriptor({ noteType, ...metadata })
  return {
    ...descriptor,
    noteData: Object.keys(noteData).length > 0 ? noteData : null,
  }
}

