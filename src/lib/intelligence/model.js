import { generateId } from '../utils'

export const INTELLIGENCE_SCHEMA_VERSION = 1

export const RECOGNITION_TYPES = Object.freeze([
  'handwriting',
  'ocr',
  'pdfText',
  'transcript',
])

export const RECOGNITION_SOURCE_KINDS = Object.freeze(['ink', 'image', 'pdf', 'audio'])
export const RECOGNITION_STATUSES = Object.freeze(['current', 'stale', 'superseded'])
export const PROCESSING_LOCATIONS = Object.freeze(['local', 'browserManaged', 'external'])

export const INTELLIGENCE_LIMITS = Object.freeze({
  MAX_RECOGNIZED_TEXT_LENGTH: 200_000,
  MAX_SOURCE_OBJECTS: 5_000,
  MAX_ID_LENGTH: 128,
  MAX_PROVIDER_LABEL_LENGTH: 160,
  MAX_LANGUAGE_LENGTH: 35,
  MAX_SOURCE_TIME_MS: 7 * 24 * 60 * 60 * 1000,
  MAX_COORDINATE: 1_000_000,
})

const TYPE_SOURCE_COMPATIBILITY = Object.freeze({
  handwriting: new Set(['ink']),
  ocr: new Set(['image', 'pdf']),
  pdfText: new Set(['pdf']),
  transcript: new Set(['audio']),
})

const boundedString = (value, maximum, { required = false } = {}) => {
  const normalized = String(value ?? '')
  if (required && !normalized) throw new Error('Recognition data is missing a required value.')
  if (normalized.length > maximum) throw new Error('Recognition data exceeds a safe text limit.')
  return normalized
}

const optionalId = (value) => {
  if (value == null || value === '') return null
  return boundedString(value, INTELLIGENCE_LIMITS.MAX_ID_LENGTH, { required: true })
}

const normalizeDate = (value, fallback) => {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value
  return fallback
}

const normalizeSourceObjectIds = (values = []) => {
  if (!Array.isArray(values) || values.length > INTELLIGENCE_LIMITS.MAX_SOURCE_OBJECTS) {
    throw new Error('Recognition references too many source objects.')
  }
  return [...new Set(values.map(optionalId).filter(Boolean))].sort()
}

const normalizeRegion = (region) => {
  if (region == null) return null
  if (!region || typeof region !== 'object' || Array.isArray(region)) {
    throw new Error('Recognition contains an invalid source region.')
  }
  const normalized = {}
  for (const key of ['x', 'y', 'width', 'height']) {
    const number = Number(region[key])
    if (!Number.isFinite(number) || Math.abs(number) > INTELLIGENCE_LIMITS.MAX_COORDINATE) {
      throw new Error('Recognition contains an invalid source region.')
    }
    normalized[key] = number
  }
  if (normalized.width < 0 || normalized.height < 0) {
    throw new Error('Recognition contains an invalid source region.')
  }
  return normalized
}

const normalizeTimeRange = (range) => {
  if (range == null) return null
  const startMs = Number(range?.startMs)
  const endMs = Number(range?.endMs)
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs < 0 ||
    endMs < startMs ||
    endMs > INTELLIGENCE_LIMITS.MAX_SOURCE_TIME_MS
  ) throw new Error('Recognition contains an invalid source time range.')
  return { startMs, endMs }
}

const normalizeConfidence = (value) => {
  if (value == null) return null
  const confidence = Number(value)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Recognition confidence must be between zero and one.')
  }
  return confidence
}

export function createRecognizedContent(input) {
  const now = new Date().toISOString()
  const type = input?.type
  const sourceKind = input?.sourceKind
  if (!RECOGNITION_TYPES.includes(type) || !RECOGNITION_SOURCE_KINDS.includes(sourceKind)) {
    throw new Error('Recognition has an unsupported type or source.')
  }
  if (!TYPE_SOURCE_COMPATIBILITY[type].has(sourceKind)) {
    throw new Error('Recognition type does not match its source material.')
  }
  const machineText = boundedString(
    input.machineText ?? input.text,
    INTELLIGENCE_LIMITS.MAX_RECOGNIZED_TEXT_LENGTH,
    { required: true }
  )
  const text = boundedString(
    input.text ?? machineText,
    INTELLIGENCE_LIMITS.MAX_RECOGNIZED_TEXT_LENGTH,
    { required: true }
  )
  const sourceResourceId = optionalId(input.sourceResourceId)
  const sourceObjectIds = normalizeSourceObjectIds(input.sourceObjectIds)
  if (sourceKind === 'ink' && sourceObjectIds.length === 0) {
    throw new Error('Handwriting recognition must reference its source ink.')
  }
  if (['image', 'pdf', 'audio'].includes(sourceKind) && !sourceResourceId) {
    throw new Error('Recognition must reference its source resource.')
  }

  const record = {
    id: optionalId(input.id) || generateId(),
    ownerId: optionalId(input.ownerId),
    noteId: optionalId(input.noteId),
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    sourceKind,
    sourceResourceId,
    sourceObjectIds,
    sourcePageId: optionalId(input.sourcePageId),
    sourcePageNumber: input.sourcePageNumber == null ? null : Number(input.sourcePageNumber),
    sourceRegion: normalizeRegion(input.sourceRegion),
    sourceTimeRange: normalizeTimeRange(input.sourceTimeRange),
    type,
    machineText,
    text,
    confidence: normalizeConfidence(input.confidence),
    providerId: boundedString(input.providerId, INTELLIGENCE_LIMITS.MAX_PROVIDER_LABEL_LENGTH, { required: true }),
    modelId: boundedString(input.modelId || 'unspecified', INTELLIGENCE_LIMITS.MAX_PROVIDER_LABEL_LENGTH),
    modelVersion: boundedString(input.modelVersion || 'unspecified', INTELLIGENCE_LIMITS.MAX_PROVIDER_LABEL_LENGTH),
    processingLocation: input.processingLocation,
    language: boundedString(input.language || '', INTELLIGENCE_LIMITS.MAX_LANGUAGE_LENGTH) || null,
    sourceFingerprint: boundedString(input.sourceFingerprint, 512, { required: true }),
    status: input.status || 'current',
    userEdited: Boolean(input.userEdited),
    editedAt: input.userEdited ? normalizeDate(input.editedAt, now) : null,
    createdAt: normalizeDate(input.createdAt, now),
    generatedAt: normalizeDate(input.generatedAt, now),
    updatedAt: normalizeDate(input.updatedAt, now),
  }
  assertRecognizedContent(record)
  return record
}

export function assertRecognizedContent(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Recognition data is invalid.')
  }
  if (Number(record.schemaVersion) !== INTELLIGENCE_SCHEMA_VERSION) {
    throw new Error(
      Number(record.schemaVersion) > INTELLIGENCE_SCHEMA_VERSION
        ? 'Recognition data was created by a newer QuickNotes version.'
        : 'Recognition data has an unsupported schema version.'
    )
  }
  if (!optionalId(record.id) || !optionalId(record.ownerId) || !optionalId(record.noteId)) {
    throw new Error('Recognition is missing its owner or note identity.')
  }
  if (!RECOGNITION_TYPES.includes(record.type) || !RECOGNITION_SOURCE_KINDS.includes(record.sourceKind)) {
    throw new Error('Recognition has an unsupported type or source.')
  }
  if (!TYPE_SOURCE_COMPATIBILITY[record.type].has(record.sourceKind)) {
    throw new Error('Recognition type does not match its source material.')
  }
  normalizeSourceObjectIds(record.sourceObjectIds)
  normalizeRegion(record.sourceRegion)
  normalizeTimeRange(record.sourceTimeRange)
  normalizeConfidence(record.confidence)
  if (record.sourcePageNumber != null && (!Number.isInteger(record.sourcePageNumber) || record.sourcePageNumber < 1 || record.sourcePageNumber > 100_000)) {
    throw new Error('Recognition contains an invalid page number.')
  }
  if (record.sourceKind === 'ink' && record.sourceObjectIds.length === 0) {
    throw new Error('Handwriting recognition must reference its source ink.')
  }
  if (['image', 'pdf', 'audio'].includes(record.sourceKind) && !optionalId(record.sourceResourceId)) {
    throw new Error('Recognition must reference its source resource.')
  }
  boundedString(record.machineText, INTELLIGENCE_LIMITS.MAX_RECOGNIZED_TEXT_LENGTH, { required: true })
  boundedString(record.text, INTELLIGENCE_LIMITS.MAX_RECOGNIZED_TEXT_LENGTH, { required: true })
  boundedString(record.providerId, INTELLIGENCE_LIMITS.MAX_PROVIDER_LABEL_LENGTH, { required: true })
  boundedString(record.sourceFingerprint, 512, { required: true })
  if (!PROCESSING_LOCATIONS.includes(record.processingLocation)) {
    throw new Error('Recognition has an invalid processing location.')
  }
  if (!RECOGNITION_STATUSES.includes(record.status)) throw new Error('Recognition has an invalid status.')
  for (const date of ['createdAt', 'generatedAt', 'updatedAt']) {
    if (!Number.isFinite(Date.parse(record[date]))) throw new Error('Recognition contains an invalid timestamp.')
  }
  if (record.userEdited && !Number.isFinite(Date.parse(record.editedAt))) {
    throw new Error('Corrected recognition is missing its edit timestamp.')
  }
  return true
}

export function correctRecognizedContent(record, text, updatedAt = new Date().toISOString()) {
  assertRecognizedContent(record)
  const corrected = {
    ...record,
    text: boundedString(text, INTELLIGENCE_LIMITS.MAX_RECOGNIZED_TEXT_LENGTH, { required: true }),
    userEdited: true,
    editedAt: normalizeDate(updatedAt, new Date().toISOString()),
    updatedAt: normalizeDate(updatedAt, new Date().toISOString()),
  }
  assertRecognizedContent(corrected)
  return corrected
}

export function mergeRecognitionRerun(existing, next) {
  assertRecognizedContent(existing)
  assertRecognizedContent(next)
  if (existing.ownerId !== next.ownerId || existing.noteId !== next.noteId || existing.type !== next.type) {
    throw new Error('A recognition rerun cannot change owner, note, or recognition type.')
  }
  const merged = {
    ...next,
    id: existing.id,
    createdAt: existing.createdAt,
    text: existing.userEdited ? existing.text : next.machineText,
    userEdited: existing.userEdited,
    editedAt: existing.userEdited ? existing.editedAt : null,
  }
  assertRecognizedContent(merged)
  return merged
}

export function markRecognizedContentStale(record, updatedAt = new Date().toISOString()) {
  assertRecognizedContent(record)
  return { ...record, status: 'stale', updatedAt: normalizeDate(updatedAt, new Date().toISOString()) }
}
