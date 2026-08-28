import { generateId } from './utils'

export const TASK_SOURCE_SCHEMA_VERSION = 1
export const MAX_CAPTURED_TASK_TEXT_LENGTH = 1_000

const ID_LIMIT = 128
const RECOGNITION_TYPES = new Set(['handwriting', 'ocr', 'pdfText', 'transcript'])
const SOURCE_KINDS = new Set(['ink', 'image', 'pdf', 'audio'])
const PRIORITIES = new Set(['high', 'medium', 'low', 'none'])

const cleanId = (value) => {
  const id = typeof value === 'string' ? value.trim() : ''
  return id && id.length <= ID_LIMIT ? id : null
}

const cleanRegion = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const region = {}
  for (const key of ['x', 'y', 'width', 'height']) {
    const number = Number(value[key])
    if (!Number.isFinite(number) || Math.abs(number) > 1_000_000) return null
    region[key] = number
  }
  return region.width >= 0 && region.height >= 0 ? region : null
}

const cleanPositiveInteger = (value) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 && number <= 100_000 ? number : null
}

const cleanTime = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 7 * 24 * 60 * 60 * 1000
    ? number
    : null
}

const cleanDateKey = (value) => {
  if (value == null || value === '') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3])
    ? String(value)
    : null
}

/**
 * Copy only the stable navigation identity into a task. The full provenance
 * remains in RecognizedContent, avoiding thousands of stroke ids in noteData.
 */
export function createRecognitionTaskSource(recognition) {
  const noteId = cleanId(recognition?.noteId)
  const recognitionId = cleanId(recognition?.id)
  if (!noteId || !recognitionId) throw new Error('A recognized source is required to create a task.')
  if (!RECOGNITION_TYPES.has(recognition.type) || !SOURCE_KINDS.has(recognition.sourceKind)) {
    throw new Error('The recognized source type is not supported for task capture.')
  }

  return {
    schemaVersion: TASK_SOURCE_SCHEMA_VERSION,
    kind: 'recognizedContent',
    noteId,
    recognitionId,
    recognitionType: recognition.type,
    sourceKind: recognition.sourceKind,
    resourceId: cleanId(recognition.sourceResourceId),
    objectId: cleanId(recognition.sourceObjectIds?.[0]),
    pageId: cleanId(recognition.sourcePageId),
    pageNumber: cleanPositiveInteger(recognition.sourcePageNumber),
    timeMs: cleanTime(recognition.sourceTimeRange?.startMs),
    region: cleanRegion(recognition.sourceRegion),
  }
}

/** Safely read an imported/legacy task source without breaking task views. */
export function normalizeTaskSource(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Number(value.schemaVersion) !== TASK_SOURCE_SCHEMA_VERSION ||
    value.kind !== 'recognizedContent'
  ) return null

  const noteId = cleanId(value.noteId)
  const recognitionId = cleanId(value.recognitionId)
  if (!noteId || !recognitionId) return null
  if (!RECOGNITION_TYPES.has(value.recognitionType) || !SOURCE_KINDS.has(value.sourceKind)) return null

  return {
    schemaVersion: TASK_SOURCE_SCHEMA_VERSION,
    kind: 'recognizedContent',
    noteId,
    recognitionId,
    recognitionType: value.recognitionType,
    sourceKind: value.sourceKind,
    resourceId: cleanId(value.resourceId),
    objectId: cleanId(value.objectId),
    pageId: cleanId(value.pageId),
    pageNumber: cleanPositiveInteger(value.pageNumber),
    timeMs: cleanTime(value.timeMs),
    region: cleanRegion(value.region),
  }
}

export function taskSourceToKnowledgeTarget(value) {
  const source = normalizeTaskSource(value)
  if (!source) return null
  return {
    noteId: source.noteId,
    recognitionId: source.recognitionId,
    resourceId: source.resourceId,
    objectId: source.objectId,
    pageId: source.pageId,
    pageNumber: source.pageNumber,
    timeMs: source.timeMs,
    region: source.region,
  }
}

export function createCanonicalTaskFromRecognition(input, options = {}) {
  const text = String(input?.text || '').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('Enter the task to create.')
  if (text.length > MAX_CAPTURED_TASK_TEXT_LENGTH) {
    throw new Error(`Tasks created from recognition are limited to ${MAX_CAPTURED_TASK_TEXT_LENGTH} characters.`)
  }
  const dueDate = cleanDateKey(input?.dueDate)
  if (input?.dueDate && !dueDate) throw new Error('Choose a valid due date.')
  const now = options.now || new Date().toISOString()
  return {
    id: options.createId?.() || generateId(),
    text,
    completed: false,
    priority: PRIORITIES.has(input?.priority) ? input.priority : 'none',
    dueDate,
    starred: false,
    subtasks: [],
    notes: '',
    recurrence: null,
    createdAt: now,
    completedAt: null,
    source: createRecognitionTaskSource(input.recognition),
  }
}

export function describeTaskSource(value) {
  const source = normalizeTaskSource(value)
  if (!source) return ''
  if (source.recognitionType === 'transcript') return 'Transcript segment'
  if (source.recognitionType === 'handwriting') return 'Recognized handwriting'
  if (source.sourceKind === 'pdf') return source.pageNumber ? `PDF page ${source.pageNumber}` : 'PDF text'
  return 'Image OCR'
}
