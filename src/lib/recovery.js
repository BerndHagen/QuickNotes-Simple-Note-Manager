import { CONTENT_KINDS, CONTENT_SCHEMA_VERSION, migrateNoteContentMetadata } from './contentModel'

const SUPPORTED_CONTENT_KINDS = new Set(Object.values(CONTENT_KINDS))
const MAX_RECOVERY_DEPTH = 40
const MAX_RECOVERY_NODES = 100_000

const isPlainRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const invalidNoteReason = (note) => {
  if (!isPlainRecord(note)) return 'The note row is not an object.'
  if (typeof note.id !== 'string' || !note.id.trim()) return 'The note has no valid stable ID.'
  if (typeof note.title !== 'string') return 'The note title is not text.'
  if (typeof note.content !== 'string') return 'The note document body is not text.'
  if (typeof note.noteType !== 'undefined' && typeof note.noteType !== 'string') {
    return 'The note type is malformed.'
  }
  if (note.tags != null && (
    !Array.isArray(note.tags) || note.tags.some((tag) => typeof tag !== 'string')
  )) return 'The note tags are malformed.'
  if (note.noteData != null && !isPlainRecord(note.noteData)) {
    return 'The note structured content is malformed.'
  }
  if (note.contentKind != null && !SUPPORTED_CONTENT_KINDS.has(note.contentKind)) {
    return 'The note uses an unknown content kind.'
  }
  if (
    note.contentSchemaVersion != null &&
    (!Number.isInteger(note.contentSchemaVersion) || note.contentSchemaVersion < 1)
  ) return 'The note content schema version is malformed.'
  if (note.contentSchemaVersion > CONTENT_SCHEMA_VERSION) {
    return `The note requires content schema ${note.contentSchemaVersion}; this build supports schema ${CONTENT_SCHEMA_VERSION}.`
  }
  return null
}

/**
 * IndexedDB can contain structured-clone values which JSON cannot encode
 * directly (cycles, bigint, dates). Recovery state must itself remain safe to
 * persist, so retain a bounded JSON-compatible representation instead of
 * risking a second startup failure while preserving the malformed row.
 */
export const makeRecoverySafeValue = (input) => {
  const seen = new Map()
  let nodeCount = 0

  const visit = (value, path, depth) => {
    nodeCount += 1
    if (nodeCount > MAX_RECOVERY_NODES) return { $truncated: 'node-limit' }
    if (depth > MAX_RECOVERY_DEPTH) return { $truncated: 'depth-limit' }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number') return Number.isFinite(value) ? value : { $number: String(value) }
    if (typeof value === 'bigint') return { $bigint: String(value) }
    if (typeof value === 'undefined') return { $undefined: true }
    if (typeof value === 'function' || typeof value === 'symbol') return { $unsupported: typeof value }
    if (value instanceof Date) return { $date: value.toISOString() }
    if (value instanceof Blob) return { $blob: { type: value.type, size: value.size } }

    const previousPath = seen.get(value)
    if (previousPath) return { $ref: previousPath }
    seen.set(value, path)

    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, `${path}[${index}]`, depth + 1))
    }

    const output = {}
    for (const [key, child] of Object.entries(value)) {
      output[key] = visit(child, `${path}.${key}`, depth + 1)
    }
    return output
  }

  return visit(input, '$', 0)
}

export const partitionRecoverableNotes = (records) => {
  const notes = []
  const corruptedNotes = []
  const activeIds = new Set()

  for (const rawNote of Array.isArray(records) ? records : []) {
    const validationReason = invalidNoteReason(rawNote)
    const reason = !validationReason && activeIds.has(rawNote.id)
      ? 'The note duplicates another canonical note ID.'
      : validationReason
    if (!reason) {
      notes.push(migrateNoteContentMetadata(rawNote))
      activeIds.add(rawNote.id)
      continue
    }

    corruptedNotes.push({
      recoveryId: globalThis.crypto?.randomUUID?.() || `recovery-${Date.now()}-${corruptedNotes.length}`,
      entityType: 'note',
      entityId: typeof rawNote?.id === 'string' ? rawNote.id : null,
      reason,
      detectedAt: new Date().toISOString(),
      raw: makeRecoverySafeValue(rawNote),
    })
  }

  return { notes, corruptedNotes }
}

export const createRawRecoveryExport = (records, { ownerId = null } = {}) => ({
  format: 'quicknotes-raw-recovery',
  version: 1,
  exportedAt: new Date().toISOString(),
  ownerScope: ownerId ? 'active-workspace' : 'unknown-workspace',
  warning: 'This file can contain private note content. It is intended for technical recovery and is not a normal QuickNotes backup.',
  records: Array.isArray(records) ? records.map(makeRecoverySafeValue) : [],
})
