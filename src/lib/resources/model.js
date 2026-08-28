import { generateId } from '../utils'

export const RESOURCE_SCHEMA_VERSION = 1

export const RESOURCE_LIMITS = Object.freeze({
  MAX_FILE_NAME_LENGTH: 240,
  MAX_PDF_BYTES: 150 * 1024 * 1024,
  MAX_AUDIO_BYTES: 500 * 1024 * 1024,
  MAX_AUDIO_DURATION_MS: 7 * 24 * 60 * 60 * 1000,
  MAX_PDF_PAGES: 10_000,
})

export const NOTE_RESOURCE_ROLES = Object.freeze(['attachment', 'recording'])

const PDF_MIME_TYPES = new Set(['application/pdf'])
const AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
])

const baseMimeType = (value) => String(value || '').trim().toLowerCase().split(';', 1)[0]

const boundedId = (value, label) => {
  const id = String(value || '')
  if (!id || id.length > 128) throw new Error(`${label} is invalid.`)
  return id
}

const validDate = (value, fallback = new Date().toISOString()) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback

export function resourceKindForMimeType(mimeType) {
  const normalized = baseMimeType(mimeType)
  if (PDF_MIME_TYPES.has(normalized)) return 'pdf'
  if (AUDIO_MIME_TYPES.has(normalized)) return 'audio'
  return null
}

export function sanitizeResourceFileName(value, kind = 'attachment') {
  const fallback = kind === 'audio' ? 'Recording' : 'Document.pdf'
  const name = [...String(value || fallback)]
    .map((character) => character.charCodeAt(0) <= 31 || '<>:"/\\|?*'.includes(character) ? '_' : character)
    .join('')
    .trim()
  return (name || fallback).slice(0, RESOURCE_LIMITS.MAX_FILE_NAME_LENGTH)
}

const assertByteSize = (kind, value) => {
  const byteSize = Number(value)
  const maximum = kind === 'pdf' ? RESOURCE_LIMITS.MAX_PDF_BYTES : RESOURCE_LIMITS.MAX_AUDIO_BYTES
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > maximum) {
    throw new Error(`${kind === 'pdf' ? 'PDF' : 'Audio'} resources must be between 1 byte and ${Math.round(maximum / 1024 / 1024)} MB.`)
  }
  return byteSize
}

export function createCanonicalResource(input) {
  const timestamp = validDate(input?.createdAt)
  const mimeType = String(input?.mimeType || '').trim().toLowerCase()
  const kind = input?.kind || resourceKindForMimeType(mimeType)
  if (!['pdf', 'audio'].includes(kind) || resourceKindForMimeType(mimeType) !== kind) {
    throw new Error('Only supported PDF and audio resources can be attached here.')
  }
  const resource = {
    id: input.id || generateId(),
    ownerId: input.ownerId,
    schemaVersion: RESOURCE_SCHEMA_VERSION,
    kind,
    mimeType,
    fileName: sanitizeResourceFileName(input.fileName, kind),
    byteSize: Number(input.byteSize),
    checksum: String(input.checksum || ''),
    source: input.source || (kind === 'audio' ? 'import' : 'attachment'),
    durationMs: input.durationMs == null ? null : Number(input.durationMs),
    pageCount: input.pageCount == null ? null : Number(input.pageCount),
    createdAt: timestamp,
    updatedAt: validDate(input.updatedAt, timestamp),
  }
  assertCanonicalResource(resource)
  return resource
}

export function assertCanonicalResource(resource) {
  if (!resource || Number(resource.schemaVersion) !== RESOURCE_SCHEMA_VERSION) {
    throw new Error('The resource metadata has an unsupported schema version.')
  }
  boundedId(resource.id, 'Resource identity')
  boundedId(resource.ownerId, 'Resource owner')
  if (!['pdf', 'audio'].includes(resource.kind) || resourceKindForMimeType(resource.mimeType) !== resource.kind) {
    throw new Error('The resource has an unsupported type.')
  }
  assertByteSize(resource.kind, resource.byteSize)
  if (!resource.fileName || resource.fileName !== sanitizeResourceFileName(resource.fileName, resource.kind)) {
    throw new Error('The resource file name is invalid.')
  }
  if (resource.checksum && !/^(sha256:[\da-f]{64}|fnv1a32:[\da-f]{8})$/u.test(resource.checksum)) {
    throw new Error('The resource checksum is invalid.')
  }
  if (resource.kind === 'audio' && resource.durationMs != null && (
    !Number.isFinite(resource.durationMs) || resource.durationMs < 0 || resource.durationMs > RESOURCE_LIMITS.MAX_AUDIO_DURATION_MS
  )) throw new Error('The audio duration is invalid.')
  if (resource.kind === 'pdf' && resource.pageCount != null && (
    !Number.isInteger(resource.pageCount) || resource.pageCount < 1 || resource.pageCount > RESOURCE_LIMITS.MAX_PDF_PAGES
  )) throw new Error('The PDF page count is invalid.')
  for (const key of ['createdAt', 'updatedAt']) {
    if (!Number.isFinite(Date.parse(resource[key]))) throw new Error('The resource timestamp is invalid.')
  }
  return true
}

export function createNoteResourceLink(input) {
  const timestamp = validDate(input?.createdAt)
  const link = {
    id: input.id || generateId(),
    ownerId: input.ownerId,
    noteId: input.noteId,
    resourceId: input.resourceId,
    role: input.role || 'attachment',
    label: String(input.label || '').slice(0, RESOURCE_LIMITS.MAX_FILE_NAME_LENGTH) || null,
    createdAt: timestamp,
    updatedAt: validDate(input.updatedAt, timestamp),
  }
  assertNoteResourceLink(link)
  return link
}

export function assertNoteResourceLink(link) {
  if (!link || !NOTE_RESOURCE_ROLES.includes(link.role)) throw new Error('The note resource link is invalid.')
  boundedId(link.id, 'Resource link identity')
  boundedId(link.ownerId, 'Resource link owner')
  boundedId(link.noteId, 'Resource link note')
  boundedId(link.resourceId, 'Resource link source')
  if (link.label != null && (typeof link.label !== 'string' || link.label.length > RESOURCE_LIMITS.MAX_FILE_NAME_LENGTH)) {
    throw new Error('The resource link label is invalid.')
  }
  for (const key of ['createdAt', 'updatedAt']) {
    if (!Number.isFinite(Date.parse(link[key]))) throw new Error('The resource link timestamp is invalid.')
  }
  return true
}

export function assertResourceBlob(row, metadata = null) {
  if (!row || !(row.data instanceof Blob)) throw new Error('The resource payload is missing or invalid.')
  boundedId(row.resourceId, 'Resource payload identity')
  boundedId(row.ownerId, 'Resource payload owner')
  if (!Number.isInteger(row.byteSize) || row.byteSize !== row.data.size || row.byteSize <= 0) {
    throw new Error('The resource payload size does not match its metadata.')
  }
  if (baseMimeType(row.mimeType) !== baseMimeType(row.data.type)) throw new Error('The resource payload type is invalid.')
  if (metadata && (
    metadata.id !== row.resourceId ||
    metadata.ownerId !== row.ownerId ||
    metadata.byteSize !== row.byteSize ||
    baseMimeType(metadata.mimeType) !== baseMimeType(row.mimeType)
  )) throw new Error('The resource payload does not match its metadata.')
  if (!Number.isFinite(Date.parse(row.updatedAt))) throw new Error('The resource payload timestamp is invalid.')
  return true
}
