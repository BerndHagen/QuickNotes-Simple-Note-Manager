import { MAX_FOLDER_NAME_LENGTH, limitNoteTitle, normalizeTagName } from './dataValidation'
import { sanitizeNoteHtml } from './sanitizeHtml'
import { normalizeContentDescriptor } from './contentModel'
import {
  assertSpatialPayload,
  assertSpatialResource,
  SPATIAL_LIMITS,
  SPATIAL_SCHEMA_VERSION,
} from './spatial/model'
import {
  assertRecognizedContent,
  createRecognizedContent,
  INTELLIGENCE_SCHEMA_VERSION,
} from './intelligence/model'
import {
  assertCanonicalResource,
  assertNoteResourceLink,
  assertResourceBlob,
  RESOURCE_SCHEMA_VERSION,
} from './resources/model'
import { normalizeTaskSource } from './taskSources'
import { normalizeReminder } from './reminders'
import { checksumBlob } from './resources/checksum'

export const WORKSPACE_BACKUP_FORMAT = 'quicknotes-workspace-backup'
export const WORKSPACE_BACKUP_VERSION = 6
export const WORKSPACE_ARCHIVE_MIME_TYPE = 'application/vnd.quicknotes.archive'
export const WORKSPACE_ARCHIVE_EXTENSION = 'qnotes'
export const QUICKNOTES_APPLICATION_VERSION = '3.0.1'

const ARCHIVE_MAGIC = 'QNARCH01'
const ARCHIVE_PREFIX_BYTES = 12
const MAX_ARCHIVE_HEADER_BYTES = 100 * 1024 * 1024

const MAX_BACKUP_NOTES = 10_000
const MAX_BACKUP_FOLDERS = 1_000
const MAX_BACKUP_TAGS = 1_000
const MAX_BACKUP_SAVED_VIEWS = 250
const MAX_BACKUP_TEMPLATES = 500
const MAX_BACKUP_RESOURCES = 2_000
const MAX_BACKUP_RECOGNITION_ROWS = 20_000
const MAX_BACKUP_RESOURCE_BYTES = 500 * 1024 * 1024
const MAX_BACKUP_TOTAL_BINARY_BYTES = 1024 * 1024 * 1024
const MAX_JSON_DEPTH = 40
const MAX_JSON_NODES = 100_000
const NOTE_TYPES = new Set([
  'standard',
  'todo',
  'project',
  'meeting',
  'journal',
  'brainstorm',
  'shopping',
  'weekly',
  'paper',
  'canvas',
])
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const SAFE_COLOR = /^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/i
const BACKUP_COLLECTION_KEYS = [
  'notes',
  'noteVersions',
  'folders',
  'tags',
  'savedViews',
  'noteTemplates',
  'spatialDocuments',
  'spatialPages',
  'spatialObjects',
  'spatialAnnotations',
  'spatialAnnotationPages',
  'spatialAnnotationObjects',
  'resources',
  'canonicalResources',
  'noteResources',
  'resourcePayloads',
  'recognizedContent',
]

const cloneJsonValue = (value, state = { nodes: 0 }, depth = 0) => {
  state.nodes += 1
  if (state.nodes > MAX_JSON_NODES) throw new Error('The backup contains too much structured data.')
  if (depth > MAX_JSON_DEPTH) throw new Error('The backup contains excessively nested data.')

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item, state, depth + 1))
  }
  if (typeof value === 'object') {
    const clone = {}
    for (const [key, child] of Object.entries(value)) {
      if (UNSAFE_OBJECT_KEYS.has(key)) continue
      clone[key] = cloneJsonValue(child, state, depth + 1)
    }
    return clone
  }
  return null
}

const validDate = (value, fallback = null) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback

const safeColor = (value, fallback = '#6b7280') =>
  typeof value === 'string' && SAFE_COLOR.test(value) ? value : fallback

const copyNoteForBackup = (note) => ({
  id: note.id,
  title: note.title || '',
  content: note.content || '',
  folderId: note.folderId || null,
  tags: Array.isArray(note.tags) ? [...note.tags] : [],
  starred: Boolean(note.starred),
  pinned: Boolean(note.pinned),
  deleted: Boolean(note.deleted),
  deletedAt: note.deletedAt || null,
  archived: Boolean(note.archived),
  archivedAt: note.archivedAt || null,
  noteType: note.noteType || 'standard',
  noteData: cloneJsonValue(note.noteData ?? null),
  ...normalizeContentDescriptor(note),
  reminder: note.reminder || null,
  reminders: cloneJsonValue(Array.isArray(note.reminders) ? note.reminders : []),
  order: Number.isFinite(note.order) ? note.order : null,
  createdAt: note.createdAt || null,
  updatedAt: note.updatedAt || null,
})

const noteVersionBackupKey = (version) => {
  if (version?.snapshotHash) return `${version.noteId}:hash:${version.snapshotHash}`
  const noteData = typeof version?.noteData === 'string'
    ? version.noteData
    : JSON.stringify(version?.noteData ?? null)
  return JSON.stringify([
    version?.noteId,
    version?.createdAt || version?.created_at || null,
    version?.title || '',
    version?.content || '',
    version?.noteType || version?.note_type || 'standard',
    noteData,
  ])
}

export function mergeWorkspaceNoteVersionsForBackup(...sources) {
  const byNote = new Map()
  for (const version of sources.flat()) {
    if (!version || typeof version.noteId !== 'string' || !version.noteId) continue
    const versions = byNote.get(version.noteId) || new Map()
    const key = noteVersionBackupKey(version)
    if (!versions.has(key)) versions.set(key, version)
    byNote.set(version.noteId, versions)
  }
  return [...byNote.values()].flatMap((versions) => [...versions.values()]
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
    .slice(0, 30))
}

export function createWorkspaceBackup(
  {
    notes = [],
    noteVersions = [],
    folders = [],
    tags = [],
    savedViews = [],
    noteTemplates = [],
    spatialDocuments = [],
    spatialPages = [],
    spatialObjects = [],
    spatialAnnotations = [],
    spatialAnnotationPages = [],
    spatialAnnotationObjects = [],
    resources = [],
    canonicalResources = [],
    noteResources = [],
    resourcePayloads = [],
    recognizedContent = [],
  },
  exportedAt
) {
  const backup = {
    format: WORKSPACE_BACKUP_FORMAT,
    schemaVersion: WORKSPACE_BACKUP_VERSION,
    exportedAt: validDate(exportedAt) || new Date().toISOString(),
    notes: notes.map(copyNoteForBackup),
    noteVersions: noteVersions.map((version) => ({
      noteId: version.noteId,
      title: version.title || '',
      content: version.content || '',
      noteType: version.noteType || 'standard',
      ...(Object.prototype.hasOwnProperty.call(version, 'noteData')
        ? { noteData: typeof version.noteData === 'string' ? version.noteData : JSON.stringify(cloneJsonValue(version.noteData)) }
        : {}),
      createdAt: version.createdAt || null,
    })),
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name || '',
      icon: folder.icon || 'Folder',
      color: folder.color || '#6b7280',
      parentId: folder.parentId || null,
      createdAt: folder.createdAt || null,
      updatedAt: folder.updatedAt || null,
    })),
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name || '',
      color: tag.color || '#6b7280',
      createdAt: tag.createdAt || null,
      updatedAt: tag.updatedAt || null,
    })),
    savedViews: savedViews.map((view) => ({
      id: view.id,
      name: view.name || '',
      icon: view.icon || 'ListFilter',
      color: view.color || '#0f766e',
      criteria: cloneJsonValue(view.criteria),
      order: Number.isFinite(view.order) ? view.order : null,
      createdAt: view.createdAt || null,
      updatedAt: view.updatedAt || null,
    })),
    noteTemplates: noteTemplates.map((template) => ({
      id: template.id,
      name: template.name || '',
      description: template.description || '',
      noteType: template.noteType || 'standard',
      titleTemplate: template.titleTemplate || template.name || 'Untitled note',
      content: template.content || '',
      noteData: cloneJsonValue(template.noteData ?? null),
      tags: Array.isArray(template.tags) ? [...template.tags] : [],
      favorite: Boolean(template.favorite),
      createdAt: template.createdAt || null,
      updatedAt: template.updatedAt || null,
    })),
    spatialDocuments: spatialDocuments.map((record) => cloneJsonValue(record)),
    spatialPages: spatialPages.map((record) => cloneJsonValue(record)),
    spatialObjects: spatialObjects.map((record) => cloneJsonValue(record)),
    spatialAnnotations: spatialAnnotations.map((record) => cloneJsonValue(record)),
    spatialAnnotationPages: spatialAnnotationPages.map((record) => cloneJsonValue(record)),
    spatialAnnotationObjects: spatialAnnotationObjects.map((record) => cloneJsonValue(record)),
    resources: resources.map((record) => cloneJsonValue(record)),
    canonicalResources: canonicalResources.map((record) => cloneJsonValue(record)),
    noteResources: noteResources.map((record) => cloneJsonValue(record)),
    resourcePayloads: resourcePayloads.map((record) => cloneJsonValue(record)),
    recognizedContent: recognizedContent.map((record) => cloneJsonValue(record)),
  }
  backup.manifest = {
    application: 'QuickNotes',
    applicationVersion: QUICKNOTES_APPLICATION_VERSION,
    createdAt: backup.exportedAt,
    counts: Object.fromEntries(BACKUP_COLLECTION_KEYS.map((key) => [key, backup[key].length])),
    resources: backup.canonicalResources.map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      mimeType: resource.mimeType,
      byteSize: resource.byteSize,
      checksum: resource.checksum || null,
    })),
    spatialResources: backup.resources.map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      mimeType: resource.mimeType,
      byteSize: resource.byteSize,
    })),
  }
  return backup
}

const dataUrlToBlob = (data, mimeType, byteSize) => {
  const prefix = `data:${mimeType};base64,`
  if (typeof data !== 'string' || !data.startsWith(prefix)) {
    throw new Error('A spatial image has invalid backup data.')
  }
  let binary
  try {
    binary = atob(data.slice(prefix.length))
  } catch {
    throw new Error('A spatial image is not valid base64 data.')
  }
  if (binary.length !== byteSize) throw new Error('A spatial image payload is incomplete.')
  const bytes = new Uint8Array(byteSize)
  for (let index = 0; index < byteSize; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

const blobToDataUrl = async (blob, mimeType) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks = []
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)))
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`
}

export async function createWorkspaceArchive(input, exportedAt) {
  const payloads = Array.isArray(input.resourcePayloads) ? input.resourcePayloads : []
  const metadataById = new Map((input.canonicalResources || []).map((resource) => [resource.id, resource]))
  let totalBytes = 0
  const archivePayloads = []
  const binaryParts = []
  for (let index = 0; index < payloads.length; index += 1) {
    const payload = payloads[index]
    const metadata = metadataById.get(payload?.resourceId)
    if (!metadata || !(payload.data instanceof Blob)) {
      throw new Error('A backup attachment is missing its binary payload.')
    }
    if (payload.data.size !== metadata.byteSize || payload.mimeType !== metadata.mimeType) {
      throw new Error(`The attachment "${metadata.fileName}" does not match its backup metadata.`)
    }
    const checksum = await checksumBlob(payload.data)
    if (metadata.checksum && checksum !== metadata.checksum) {
      throw new Error(`The attachment "${metadata.fileName}" is corrupt and cannot be archived.`)
    }
    totalBytes += payload.data.size
    if (totalBytes > MAX_BACKUP_TOTAL_BINARY_BYTES) {
      throw new Error('The backup binary resources exceed the archive limit.')
    }
    archivePayloads.push({
      scope: 'canonical',
      resourceId: payload.resourceId,
      mimeType: payload.mimeType,
      byteSize: payload.data.size,
      checksum,
      archiveIndex: index,
    })
    binaryParts.push(payload.data)
  }
  if (archivePayloads.length !== metadataById.size) {
    throw new Error('Every attachment must have exactly one binary payload.')
  }

  const spatialResources = []
  for (const resource of input.resources || []) {
    const byteSize = Number(resource.byteSize)
    if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_BACKUP_RESOURCE_BYTES) {
      throw new Error('A spatial image has invalid backup metadata.')
    }
    const blob = dataUrlToBlob(resource.data, resource.mimeType, byteSize)
    const checksum = await checksumBlob(blob)
    const archiveIndex = archivePayloads.length
    archivePayloads.push({
      scope: 'spatial',
      resourceId: resource.id,
      mimeType: resource.mimeType,
      byteSize,
      checksum,
      archiveIndex,
    })
    binaryParts.push(blob)
    totalBytes += byteSize
    if (totalBytes > MAX_BACKUP_TOTAL_BINARY_BYTES) {
      throw new Error('The backup binary resources exceed the archive limit.')
    }
    spatialResources.push({ ...resource, data: null, archiveIndex })
  }

  const backup = createWorkspaceBackup({
    ...input,
    resources: spatialResources,
    resourcePayloads: archivePayloads.filter((payload) => payload.scope === 'canonical'),
  }, exportedAt)
  backup.archive = {
    format: 'quicknotes-binary-archive',
    version: 1,
    payloadBytes: totalBytes,
    payloads: archivePayloads,
  }
  const header = new TextEncoder().encode(JSON.stringify(backup))
  if (header.byteLength > MAX_ARCHIVE_HEADER_BYTES) throw new Error('The backup manifest is too large to archive safely.')
  const prefix = new Uint8Array(ARCHIVE_PREFIX_BYTES)
  prefix.set(new TextEncoder().encode(ARCHIVE_MAGIC), 0)
  new DataView(prefix.buffer).setUint32(ARCHIVE_MAGIC.length, header.byteLength, true)
  return new Blob([prefix, header, ...binaryParts], {
    type: WORKSPACE_ARCHIVE_MIME_TYPE,
  })
}

export function parseWorkspaceBackup(source) {
  let backup
  try {
    backup = typeof source === 'string' ? JSON.parse(source) : source
  } catch {
    throw new Error('This is not a valid JSON backup.')
  }

  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('The backup must contain a workspace object.')
  }
  if (backup.format && backup.format !== WORKSPACE_BACKUP_FORMAT) {
    throw new Error('This JSON file is not a QuickNotes workspace backup.')
  }
  if (
    backup.schemaVersion != null &&
    (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1)
  ) {
    throw new Error('The backup schema version is invalid.')
  }
  if (backup.schemaVersion > WORKSPACE_BACKUP_VERSION) {
    throw new Error('This backup was created by a newer QuickNotes version.')
  }
  if (!Array.isArray(backup.notes)) throw new Error('The backup does not contain a notes list.')
  if (backup.noteVersions != null && !Array.isArray(backup.noteVersions)) {
    throw new Error('The backup version-history list is invalid.')
  }
  if (backup.folders != null && !Array.isArray(backup.folders)) {
    throw new Error('The backup folder list is invalid.')
  }
  if (backup.tags != null && !Array.isArray(backup.tags)) {
    throw new Error('The backup tag list is invalid.')
  }
  if (backup.savedViews != null && !Array.isArray(backup.savedViews)) {
    throw new Error('The backup smart view list is invalid.')
  }
  if (backup.noteTemplates != null && !Array.isArray(backup.noteTemplates)) {
    throw new Error('The backup template list is invalid.')
  }
  if (backup.spatialDocuments != null && !Array.isArray(backup.spatialDocuments)) {
    throw new Error('The backup spatial document list is invalid.')
  }
  if (backup.spatialPages != null && !Array.isArray(backup.spatialPages)) {
    throw new Error('The backup spatial page list is invalid.')
  }
  if (backup.spatialObjects != null && !Array.isArray(backup.spatialObjects)) {
    throw new Error('The backup spatial object list is invalid.')
  }
  if (backup.spatialAnnotations != null && !Array.isArray(backup.spatialAnnotations)) {
    throw new Error('The backup annotation layer list is invalid.')
  }
  if (backup.spatialAnnotationPages != null && !Array.isArray(backup.spatialAnnotationPages)) {
    throw new Error('The backup annotation page list is invalid.')
  }
  if (backup.spatialAnnotationObjects != null && !Array.isArray(backup.spatialAnnotationObjects)) {
    throw new Error('The backup annotation object list is invalid.')
  }
  if (backup.resources != null && !Array.isArray(backup.resources)) {
    throw new Error('The backup resource list is invalid.')
  }
  if (backup.canonicalResources != null && !Array.isArray(backup.canonicalResources)) {
    throw new Error('The backup attachment list is invalid.')
  }
  if (backup.noteResources != null && !Array.isArray(backup.noteResources)) {
    throw new Error('The backup note-resource link list is invalid.')
  }
  if (backup.resourcePayloads != null && !Array.isArray(backup.resourcePayloads)) {
    throw new Error('The backup binary resource list is invalid.')
  }
  if (backup.recognizedContent != null && !Array.isArray(backup.recognizedContent)) {
    throw new Error('The backup recognized-content list is invalid.')
  }

  const parsed = {
    notes: backup.notes,
    noteVersions: backup.noteVersions || [],
    folders: backup.folders || [],
    tags: backup.tags || [],
    savedViews: backup.savedViews || [],
    noteTemplates: backup.noteTemplates || [],
    spatialDocuments: backup.spatialDocuments || [],
    spatialPages: backup.spatialPages || [],
    spatialObjects: backup.spatialObjects || [],
    spatialAnnotations: backup.spatialAnnotations || [],
    spatialAnnotationPages: backup.spatialAnnotationPages || [],
    spatialAnnotationObjects: backup.spatialAnnotationObjects || [],
    resources: backup.resources || [],
    canonicalResources: backup.canonicalResources || [],
    noteResources: backup.noteResources || [],
    resourcePayloads: backup.resourcePayloads || [],
    recognizedContent: backup.recognizedContent || [],
  }
  if (parsed.notes.length > MAX_BACKUP_NOTES) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_NOTES.toLocaleString()} notes.`)
  }
  if (parsed.noteVersions.length > MAX_BACKUP_NOTES * 30) {
    throw new Error('The backup contains too many note-history versions.')
  }
  if (parsed.folders.length > MAX_BACKUP_FOLDERS) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_FOLDERS.toLocaleString()} folders.`)
  }
  if (parsed.tags.length > MAX_BACKUP_TAGS) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_TAGS.toLocaleString()} tags.`)
  }
  if (parsed.savedViews.length > MAX_BACKUP_SAVED_VIEWS) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_SAVED_VIEWS} smart views.`)
  }
  if (parsed.noteTemplates.length > MAX_BACKUP_TEMPLATES) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_TEMPLATES} templates.`)
  }
  if (parsed.spatialDocuments.length > MAX_BACKUP_NOTES) {
    throw new Error('The backup contains too many spatial documents.')
  }
  if (parsed.spatialPages.length > MAX_BACKUP_NOTES * SPATIAL_LIMITS.MAX_PAGES) {
    throw new Error('The backup contains too many Paper pages.')
  }
  if (parsed.spatialObjects.length > MAX_BACKUP_NOTES * SPATIAL_LIMITS.MAX_OBJECTS_PER_NOTE) {
    throw new Error('The backup contains too many spatial objects.')
  }
  if (parsed.spatialAnnotations.length > MAX_BACKUP_RESOURCES) {
    throw new Error('The backup contains too many annotation layers.')
  }
  if (parsed.spatialAnnotationPages.length > MAX_BACKUP_RESOURCES * SPATIAL_LIMITS.MAX_PAGES) {
    throw new Error('The backup contains too many annotation pages.')
  }
  if (parsed.spatialAnnotationObjects.length > MAX_BACKUP_RESOURCES * SPATIAL_LIMITS.MAX_OBJECTS_PER_NOTE) {
    throw new Error('The backup contains too many annotation objects.')
  }
  if (parsed.resources.length > MAX_BACKUP_RESOURCES) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_RESOURCES.toLocaleString()} resources.`)
  }
  if (parsed.canonicalResources.length > MAX_BACKUP_RESOURCES || parsed.noteResources.length > MAX_BACKUP_RESOURCES * 4) {
    throw new Error('The backup contains too many attached resources or note links.')
  }
  if (parsed.resourcePayloads.length > MAX_BACKUP_RESOURCES) {
    throw new Error('The backup contains too many binary resource payloads.')
  }
  if (parsed.recognizedContent.length > MAX_BACKUP_RECOGNITION_ROWS) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_RECOGNITION_ROWS.toLocaleString()} recognition results.`)
  }
  if (
    parsed.notes.length +
    parsed.noteVersions.length +
    parsed.folders.length +
    parsed.tags.length +
    parsed.savedViews.length +
    parsed.noteTemplates.length === 0
    && parsed.spatialDocuments.length === 0
    && parsed.spatialPages.length === 0
    && parsed.spatialObjects.length === 0
    && parsed.spatialAnnotations.length === 0
    && parsed.spatialAnnotationPages.length === 0
    && parsed.spatialAnnotationObjects.length === 0
    && parsed.resources.length === 0
    && parsed.canonicalResources.length === 0
    && parsed.noteResources.length === 0
    && parsed.resourcePayloads.length === 0
    && parsed.recognizedContent.length === 0
  ) {
    throw new Error('The backup is empty.')
  }
  if (Number(backup.schemaVersion || 0) >= 6) assertBackupManifest(backup, parsed)
  return parsed
}

const assertBackupManifest = (backup, parsed) => {
  if (backup.format !== WORKSPACE_BACKUP_FORMAT) throw new Error('The backup format identifier is missing.')
  const manifest = backup.manifest
  if (!manifest || manifest.application !== 'QuickNotes' || typeof manifest.applicationVersion !== 'string') {
    throw new Error('The backup manifest is missing or invalid.')
  }
  if (!validDate(manifest.createdAt) || manifest.createdAt !== backup.exportedAt) {
    throw new Error('The backup manifest creation time is invalid.')
  }
  for (const key of BACKUP_COLLECTION_KEYS) {
    if (!Number.isInteger(manifest.counts?.[key]) || manifest.counts[key] !== parsed[key].length) {
      throw new Error(`The backup manifest count for ${key} does not match its contents.`)
    }
  }
  if (!Array.isArray(manifest.resources) || manifest.resources.length !== parsed.canonicalResources.length) {
    throw new Error('The backup resource inventory does not match its contents.')
  }
  const resources = new Map(parsed.canonicalResources.map((resource) => [resource.id, resource]))
  for (const inventory of manifest.resources) {
    const resource = resources.get(inventory?.id)
    if (
      !resource ||
      inventory.kind !== resource.kind ||
      inventory.mimeType !== resource.mimeType ||
      inventory.byteSize !== resource.byteSize ||
      (inventory.checksum || null) !== (resource.checksum || null)
    ) throw new Error('The backup resource inventory contains inconsistent metadata.')
  }
  if (!Array.isArray(manifest.spatialResources) || manifest.spatialResources.length !== parsed.resources.length) {
    throw new Error('The backup spatial resource inventory does not match its contents.')
  }
  const spatialResources = new Map(parsed.resources.map((resource) => [resource.id, resource]))
  for (const inventory of manifest.spatialResources) {
    const resource = spatialResources.get(inventory?.id)
    if (
      !resource ||
      inventory.kind !== resource.kind ||
      inventory.mimeType !== resource.mimeType ||
      inventory.byteSize !== resource.byteSize
    ) throw new Error('The backup spatial resource inventory contains inconsistent metadata.')
  }
}

export async function parseWorkspaceArchive(source) {
  if (!(source instanceof Blob)) throw new Error('A QuickNotes archive file is required.')
  if (source.size < ARCHIVE_PREFIX_BYTES || source.size > MAX_BACKUP_TOTAL_BINARY_BYTES + MAX_ARCHIVE_HEADER_BYTES + ARCHIVE_PREFIX_BYTES) {
    throw new Error('The QuickNotes archive size is invalid.')
  }
  const prefix = new Uint8Array(await source.slice(0, ARCHIVE_PREFIX_BYTES).arrayBuffer())
  const magic = new TextDecoder().decode(prefix.subarray(0, ARCHIVE_MAGIC.length))
  if (magic !== ARCHIVE_MAGIC) throw new Error('This file is not a QuickNotes archive.')
  const headerLength = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength)
    .getUint32(ARCHIVE_MAGIC.length, true)
  if (headerLength <= 0 || headerLength > MAX_ARCHIVE_HEADER_BYTES || ARCHIVE_PREFIX_BYTES + headerLength > source.size) {
    throw new Error('The QuickNotes archive header is corrupt.')
  }
  let header
  try {
    header = JSON.parse(await source.slice(ARCHIVE_PREFIX_BYTES, ARCHIVE_PREFIX_BYTES + headerLength).text())
  } catch {
    throw new Error('The QuickNotes archive manifest is not valid JSON.')
  }
  if (header.archive?.format !== 'quicknotes-binary-archive' || header.archive?.version !== 1) {
    throw new Error('The QuickNotes archive container is unsupported.')
  }
  const parsed = parseWorkspaceBackup(header)
  if (!Array.isArray(header.archive.payloads)) throw new Error('The QuickNotes archive payload inventory is missing.')
  const payloads = [...header.archive.payloads].sort((left, right) => left.archiveIndex - right.archiveIndex)
  let offset = ARCHIVE_PREFIX_BYTES + headerLength
  const hydratedPayloads = new Map()
  const hydratedSpatialResources = new Map()
  for (let index = 0; index < payloads.length; index += 1) {
    const payload = payloads[index]
    if (
      payload.archiveIndex !== index ||
      !Number.isInteger(payload.byteSize) ||
      payload.byteSize <= 0 ||
      typeof payload.mimeType !== 'string'
    ) throw new Error('The QuickNotes archive resource inventory is invalid.')
    const end = offset + payload.byteSize
    if (end > source.size) throw new Error('The QuickNotes archive contains a truncated attachment.')
    const blob = source.slice(offset, end, payload.mimeType)
    const checksum = await checksumBlob(blob)
    if (checksum !== payload.checksum) throw new Error('A QuickNotes archive attachment failed checksum verification.')
    if (payload.scope === 'canonical') {
      hydratedPayloads.set(payload.resourceId, { ...payload, data: blob })
    } else if (payload.scope === 'spatial') {
      hydratedSpatialResources.set(payload.resourceId, await blobToDataUrl(blob, payload.mimeType))
    } else {
      throw new Error('The QuickNotes archive contains an unsupported payload scope.')
    }
    offset = end
  }
  if (offset !== source.size || Number(header.archive.payloadBytes) !== offset - ARCHIVE_PREFIX_BYTES - headerLength) {
    throw new Error('The QuickNotes archive has missing or unexpected binary data.')
  }
  if (
    hydratedPayloads.size !== parsed.canonicalResources.length ||
    hydratedSpatialResources.size !== parsed.resources.length
  ) throw new Error('The QuickNotes archive resource graph is incomplete.')
  return {
    ...parsed,
    resourcePayloads: parsed.canonicalResources.map((resource) => hydratedPayloads.get(resource.id)),
    resources: parsed.resources.map((resource) => ({
      ...resource,
      data: hydratedSpatialResources.get(resource.id),
    })),
  }
}

const uniqueFolderName = (value, usedNames) => {
  const rawName = typeof value === 'string' ? value.trim() : ''
  const base = (rawName || 'Imported folder').slice(0, MAX_FOLDER_NAME_LENGTH)
  if (!usedNames.has(base.toLowerCase())) {
    usedNames.add(base.toLowerCase())
    return base
  }

  let index = 1
  while (true) {
    const suffix = index === 1 ? ' (imported)' : ` (imported ${index})`
    const candidate = `${base.slice(0, MAX_FOLDER_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`
    if (!usedNames.has(candidate.toLowerCase())) {
      usedNames.add(candidate.toLowerCase())
      return candidate
    }
    index += 1
  }
}

const collectUniqueRecords = (records, type) => {
  const seen = new Set()
  return records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`The backup contains an invalid ${type} at position ${index + 1}.`)
    }
    const id = typeof record.id === 'string' && record.id ? record.id : `${type}-${index}`
    if (seen.has(id)) throw new Error(`The backup contains a duplicate ${type} identifier.`)
    seen.add(id)
    return { ...record, id }
  })
}

const decodeResourcePayload = (payload, metadata, ownerId, timestamp) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('A backup binary resource payload is invalid.')
  }
  const byteSize = Number(payload.byteSize)
  if (
    !Number.isInteger(byteSize) ||
    byteSize <= 0 ||
    byteSize > MAX_BACKUP_RESOURCE_BYTES ||
    byteSize !== metadata.byteSize
  ) throw new Error('A backup binary resource payload has an invalid size.')
  let blob
  if (payload.data instanceof Blob) {
    if (payload.data.size !== byteSize || payload.data.type !== metadata.mimeType) {
      throw new Error('A backup binary resource payload is incomplete or has the wrong type.')
    }
    blob = payload.data
  } else {
    const prefix = `data:${metadata.mimeType};base64,`
    if (
      typeof payload.data !== 'string' ||
      !payload.data.startsWith(prefix) ||
      payload.data.length > Math.ceil(byteSize * 4 / 3) + prefix.length + 8
    ) throw new Error('A backup binary resource payload has invalid data.')
    let binary
    try {
      binary = atob(payload.data.slice(prefix.length))
    } catch {
      throw new Error('A backup binary resource payload is not valid base64 data.')
    }
    if (binary.length !== byteSize) throw new Error('A backup binary resource payload is incomplete.')
    const bytes = new Uint8Array(byteSize)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    blob = new Blob([bytes], { type: metadata.mimeType })
  }
  const row = {
    resourceId: metadata.id,
    ownerId,
    data: blob,
    byteSize,
    mimeType: metadata.mimeType,
    updatedAt: timestamp,
  }
  assertResourceBlob(row, metadata)
  return row
}

const hasFolderCycle = (folderId, parentId, parents) => {
  const visited = new Set([folderId])
  let current = parentId
  while (current && parents.has(current)) {
    if (visited.has(current)) return true
    visited.add(current)
    current = parents.get(current)
  }
  return false
}

// A strict subset of editor HTML is safe without parsing: zero or more plain
// paragraphs containing no markup, attributes, or entities. Keeping this
// deliberately narrow makes large ordinary archives practical while every
// richer or ambiguous document still passes through DOMPurify below.
const SAFE_PLAIN_PARAGRAPH_HTML = /^(?:<p>[^<>&]*<\/p>)*$/u

const remapInternalNoteLinks = (html, noteIdMap) => {
  const source = String(html || '')
  if (SAFE_PLAIN_PARAGRAPH_HTML.test(source)) return source
  if (!source || noteIdMap.size === 0) return sanitizeNoteHtml(source)
  const documentNode = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')

  for (const link of documentNode.body.querySelectorAll('a')) {
    const dataId = link.getAttribute('data-note-id')
    const href = link.getAttribute('href') || ''
    const hrefId = href.startsWith('note://') ? href.slice('note://'.length) : null
    const sourceId = dataId || hrefId
    const mappedId = sourceId ? noteIdMap.get(sourceId) : null
    if (!mappedId) continue
    link.setAttribute('data-note-id', mappedId)
    link.setAttribute('href', '#')
  }

  return sanitizeNoteHtml(documentNode.body.innerHTML)
}

const remapRecognitionSource = (sourceValue, maps) => {
  const source = normalizeTaskSource(sourceValue)
  if (!source) return null
  const mapped = {
    ...source,
    noteId: maps.noteIdMap.get(source.noteId),
    recognitionId: maps.recognitionIdMap.get(source.recognitionId),
    resourceId: source.resourceId ? maps.resourceIdMap.get(source.resourceId) : null,
    objectId: source.objectId ? maps.objectIdMap.get(source.objectId) : null,
    pageId: source.pageId ? maps.pageIdMap.get(source.pageId) : null,
  }
  if (
    !mapped.noteId ||
    !mapped.recognitionId ||
    (source.resourceId && !mapped.resourceId) ||
    (source.objectId && !mapped.objectId) ||
    (source.pageId && !mapped.pageId)
  ) throw new Error('A captured task references missing recognition source content.')
  return mapped
}

const remapSourceBearingItems = (items, maps) => (Array.isArray(items) ? items : []).map((item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item
  const source = remapRecognitionSource(item.source, maps)
  return source ? { ...item, source } : item
})

const remapRecognizedTaskSources = (note, maps) => {
  if (!note.noteData || typeof note.noteData !== 'object') return note.noteData
  if (note.noteType === 'todo') {
    return { ...note.noteData, tasks: remapSourceBearingItems(note.noteData.tasks, maps) }
  }
  if (note.noteType === 'meeting') {
    return {
      ...note.noteData,
      actionItems: remapSourceBearingItems(note.noteData.actionItems, maps),
      decisions: remapSourceBearingItems(note.noteData.decisions, maps),
    }
  }
  return note.noteData
}

const remapReminderSources = (values, noteId, maps) => (Array.isArray(values) ? values : []).map((value) => {
  const reminder = normalizeReminder(value, value?.source?.noteId || noteId)
  if (!reminder) throw new Error('A reminder contains an invalid due date.')
  const source = reminder.source
  const sourceNoteId = value?.source?.noteId
  const mappedSourceNoteId = sourceNoteId ? maps.noteIdMap.get(sourceNoteId) : noteId
  if (!mappedSourceNoteId) throw new Error('A reminder references a missing source note.')
  const mapped = {
    ...source,
    noteId: mappedSourceNoteId,
  }
  for (const [key, map] of [
    ['recognitionId', maps.recognitionIdMap],
    ['resourceId', maps.resourceIdMap],
    ['objectId', maps.objectIdMap],
    ['pageId', maps.pageIdMap],
  ]) {
    if (!source[key]) continue
    mapped[key] = map.get(source[key])
    if (!mapped[key]) throw new Error('A reminder references missing source content.')
  }
  return { ...reminder, source: mapped }
})

export async function prepareWorkspaceImport(
  source,
  existingWorkspace,
  { createId, now = new Date().toISOString() }
) {
  if (typeof createId !== 'function') throw new Error('An ID generator is required.')
  const backup = parseWorkspaceBackup(source)
  const sourceFolders = collectUniqueRecords(backup.folders, 'folder')
  const sourceNotes = collectUniqueRecords(backup.notes, 'note')
  const sourceViews = collectUniqueRecords(backup.savedViews, 'smart view')
  const sourceTemplates = collectUniqueRecords(backup.noteTemplates, 'template')
  const timestamp = validDate(now) || new Date().toISOString()
  const nextId = () => {
    const id = createId()
    if (typeof id !== 'string' || !id) throw new Error('The ID generator returned an invalid value.')
    return id
  }

  const usedFolderNames = new Set(
    (existingWorkspace.folders || []).map((folder) => String(folder.name || '').trim().toLowerCase())
  )
  const folderIdMap = new Map(sourceFolders.map((folder) => [folder.id, nextId()]))
  const sourceParents = new Map(
    sourceFolders.map((folder) => [folder.id, typeof folder.parentId === 'string' ? folder.parentId : null])
  )
  const folders = sourceFolders.map((folder) => {
    const sourceParentId = sourceParents.get(folder.id)
    const parentId =
      sourceParentId &&
      folderIdMap.has(sourceParentId) &&
      !hasFolderCycle(folder.id, sourceParentId, sourceParents)
        ? folderIdMap.get(sourceParentId)
        : null
    return {
      id: folderIdMap.get(folder.id),
      name: uniqueFolderName(folder.name, usedFolderNames),
      icon: typeof folder.icon === 'string' ? folder.icon.slice(0, 50) || 'Folder' : 'Folder',
      color: safeColor(folder.color),
      parentId,
      createdAt: validDate(folder.createdAt, timestamp),
      updatedAt: timestamp,
      syncStatus: 'pending',
    }
  })

  const sourceTagColors = new Map()
  for (const tag of backup.tags) {
    if (!tag || typeof tag !== 'object' || Array.isArray(tag)) continue
    try {
      const name = normalizeTagName(tag.name)
      if (!sourceTagColors.has(name)) sourceTagColors.set(name, safeColor(tag.color))
    } catch {
      // Invalid tag records are ignored unless a valid note references them.
    }
  }

  const tagNames = new Set(sourceTagColors.keys())
  const normalizedNoteTags = new Map()
  for (const note of sourceNotes) {
    const names = []
    for (const value of Array.isArray(note.tags) ? note.tags : []) {
      try {
        const name = normalizeTagName(value)
        if (!names.includes(name)) names.push(name)
        tagNames.add(name)
      } catch {
        // Skip tags that cannot be represented by the current workspace schema.
      }
    }
    normalizedNoteTags.set(note.id, names)
  }

  const existingTagNames = new Set(
    (existingWorkspace.tags || []).map((tag) => String(tag.name || '').trim().toLowerCase())
  )
  const tags = Array.from(tagNames)
    .filter((name) => !existingTagNames.has(name))
    .map((name) => ({
      id: nextId(),
      name,
      color: sourceTagColors.get(name) || '#6b7280',
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    }))

  const noteIdMap = new Map(sourceNotes.map((note) => [note.id, nextId()]))
  const notes = sourceNotes.map((note) => ({
    id: noteIdMap.get(note.id),
    title: limitNoteTitle(note.title, 'Untitled Note'),
    content: remapInternalNoteLinks(note.content || '', noteIdMap),
    folderId: typeof note.folderId === 'string' ? folderIdMap.get(note.folderId) || null : null,
    tags: normalizedNoteTags.get(note.id),
    starred: Boolean(note.starred),
    pinned: Boolean(note.pinned),
    deleted: Boolean(note.deleted),
    deletedAt: note.deleted ? validDate(note.deletedAt, timestamp) : null,
    archived: Boolean(note.archived),
    archivedAt: note.archived ? validDate(note.archivedAt, timestamp) : null,
    noteType: NOTE_TYPES.has(note.noteType) ? note.noteType : 'standard',
    noteData: cloneJsonValue(note.noteData ?? null),
    ...normalizeContentDescriptor({
      noteType: NOTE_TYPES.has(note.noteType) ? note.noteType : 'standard',
      contentKind: note.contentKind,
      contentSchemaVersion: note.contentSchemaVersion,
    }),
    reminder: validDate(note.reminder),
    reminders: cloneJsonValue(Array.isArray(note.reminders) ? note.reminders : []),
    order: Number.isFinite(note.order) ? note.order : null,
    createdAt: validDate(note.createdAt, timestamp),
    updatedAt: timestamp,
    syncStatus: 'pending',
  }))

  const noteVersions = backup.noteVersions.map((version, index) => {
    if (!version || typeof version !== 'object' || Array.isArray(version)) {
      throw new Error(`The backup contains an invalid note version at position ${index + 1}.`)
    }
    const noteId = noteIdMap.get(version.noteId)
    if (!noteId) throw new Error('A note-history version references a missing note.')
    let noteData
    if (Object.prototype.hasOwnProperty.call(version, 'noteData')) {
      try {
        const parsedData = typeof version.noteData === 'string' ? JSON.parse(version.noteData) : version.noteData
        noteData = JSON.stringify(cloneJsonValue(parsedData))
      } catch {
        throw new Error('A note-history version contains invalid structured data.')
      }
    }
    return {
      ownerId: null,
      noteId,
      title: limitNoteTitle(version.title, ''),
      content: sanitizeNoteHtml(version.content || ''),
      noteType: NOTE_TYPES.has(version.noteType) ? version.noteType : 'standard',
      ...(noteData === undefined ? {} : { noteData }),
      createdAt: validDate(version.createdAt, timestamp),
    }
  })

  const usedViewNames = new Set(
    (existingWorkspace.savedViews || []).map((view) => String(view.name || '').trim().toLowerCase())
  )
  const savedViews = sourceViews.map((view, index) => {
    const criteria = cloneJsonValue(view.criteria || { match: 'all', scope: 'active', rules: [] })
    if (Array.isArray(criteria?.rules)) {
      criteria.rules = criteria.rules.map((rule) => (
        rule?.field === 'folder' && typeof rule.value === 'string'
          ? { ...rule, value: folderIdMap.get(rule.value) || '' }
          : rule
      ))
    }
    return {
      id: nextId(),
      name: uniqueFolderName(view.name || 'Imported smart view', usedViewNames).slice(0, 80),
      icon: typeof view.icon === 'string' ? view.icon.slice(0, 50) || 'ListFilter' : 'ListFilter',
      color: safeColor(view.color, '#0f766e'),
      criteria,
      order: Number.isFinite(view.order) ? view.order : index,
      createdAt: validDate(view.createdAt, timestamp),
      updatedAt: timestamp,
      syncStatus: 'pending',
    }
  })

  const usedTemplateNames = new Set(
    (existingWorkspace.noteTemplates || []).map((template) => String(template.name || '').trim().toLowerCase())
  )
  const noteTemplates = sourceTemplates.map((template) => ({
    id: nextId(),
    name: uniqueFolderName(template.name || 'Imported template', usedTemplateNames).slice(0, 80),
    description: String(template.description || '').slice(0, 500),
    noteType: NOTE_TYPES.has(template.noteType) ? template.noteType : 'standard',
    titleTemplate: limitNoteTitle(template.titleTemplate, template.name || 'Untitled note'),
    content: sanitizeNoteHtml(template.content || ''),
    noteData: cloneJsonValue(template.noteData ?? null),
    tags: Array.isArray(template.tags)
      ? [...new Set(template.tags.map((tag) => {
          try { return normalizeTagName(tag) } catch { return null }
        }).filter(Boolean))].slice(0, 50)
      : [],
    favorite: Boolean(template.favorite),
    createdAt: validDate(template.createdAt, timestamp),
    updatedAt: timestamp,
    syncStatus: 'pending',
  }))

  const sourceSpatialDocuments = collectUniqueRecords(backup.spatialDocuments, 'spatial document')
  const sourceSpatialPages = collectUniqueRecords(backup.spatialPages, 'spatial page')
  const sourceSpatialObjects = collectUniqueRecords(backup.spatialObjects, 'spatial object')
  const sourceResources = collectUniqueRecords(backup.resources, 'resource')
  const resourceIdMap = new Map(sourceResources.map((resource) => [resource.id, nextId()]))
  const pageIdMap = new Map(sourceSpatialPages.map((page) => [page.id, nextId()]))
  const objectIdMap = new Map(sourceSpatialObjects.map((object) => [object.id, nextId()]))
  const spatialDocumentNoteIds = new Set()
  for (const document of sourceSpatialDocuments) {
    if (spatialDocumentNoteIds.has(document.noteId)) throw new Error('The backup contains duplicate spatial documents for one note.')
    spatialDocumentNoteIds.add(document.noteId)
  }
  const spatialDocuments = sourceSpatialDocuments.map((document) => {
    const noteId = noteIdMap.get(document.noteId)
    if (!noteId || !['paper', 'canvas'].includes(document.kind)) {
      throw new Error('A spatial document references an invalid note.')
    }
    if (Number(document.schemaVersion || 1) > SPATIAL_SCHEMA_VERSION) {
      throw new Error('A spatial document was created by a newer QuickNotes version.')
    }
    const importedNote = notes.find((note) => note.id === noteId)
    if (importedNote?.contentKind !== document.kind) {
      throw new Error('A spatial document does not match its note content type.')
    }
    return {
      ...cloneJsonValue(document),
      noteId,
      ownerId: null,
      schemaVersion: SPATIAL_SCHEMA_VERSION,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
  const spatialKindsByNoteId = new Map(spatialDocuments.map((document) => [document.noteId, document.kind]))
  const spatialPages = sourceSpatialPages.map((page) => {
    const noteId = noteIdMap.get(page.noteId)
    if (!noteId || spatialKindsByNoteId.get(noteId) !== 'paper') {
      throw new Error('A Paper page references an invalid spatial document.')
    }
    return {
      ...cloneJsonValue(page),
      id: pageIdMap.get(page.id),
      noteId,
      ownerId: null,
      schemaVersion: SPATIAL_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
  const spatialPageIds = new Set(spatialPages.map((page) => page.id))
  const allowedObjectKinds = new Set(['stroke', 'shape', 'text', 'sticky', 'indexCard', 'noteLink', 'image'])
  const spatialObjects = sourceSpatialObjects.map((object) => {
    const noteId = noteIdMap.get(object.noteId)
    const kind = spatialKindsByNoteId.get(noteId)
    const pageId = object.pageId ? pageIdMap.get(object.pageId) : null
    if (!noteId || !allowedObjectKinds.has(object.kind) || (kind === 'paper' && !spatialPageIds.has(pageId))) {
      throw new Error('A spatial object contains an invalid reference or type.')
    }
    const data = cloneJsonValue(object.data || {})
    if (object.kind === 'stroke' && (!Array.isArray(data.points) || data.points.length > SPATIAL_LIMITS.MAX_POINTS_PER_STROKE)) {
      throw new Error('A spatial stroke is invalid or contains too many points.')
    }
    if (object.kind === 'noteLink' && data.targetNoteId) {
      data.targetNoteId = noteIdMap.get(data.targetNoteId) || null
    }
    if (data.resourceId) data.resourceId = resourceIdMap.get(data.resourceId) || null
    if (Array.isArray(data.sourceStrokeIds)) {
      const remappedSourceIds = data.sourceStrokeIds.map((id) => objectIdMap.get(id)).filter(Boolean)
      if (remappedSourceIds.length !== data.sourceStrokeIds.length) {
        throw new Error('A converted shape references missing source ink.')
      }
      data.sourceStrokeIds = remappedSourceIds
    }
    if (data.convertedToShapeId) {
      data.convertedToShapeId = objectIdMap.get(data.convertedToShapeId)
      if (!data.convertedToShapeId) throw new Error('A hidden source stroke references a missing converted shape.')
    }
    return {
      ...cloneJsonValue(object),
      id: objectIdMap.get(object.id),
      noteId,
      pageId,
      ownerId: null,
      schemaVersion: SPATIAL_SCHEMA_VERSION,
      data,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
  const resources = sourceResources.map((resource) => ({
    ...(() => {
      const clone = cloneJsonValue(resource)
      const byteSize = Number(clone.byteSize)
      if (
        clone.kind !== 'image' ||
        !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(clone.mimeType) ||
        !Number.isInteger(byteSize) ||
        byteSize <= 0 ||
        byteSize > SPATIAL_LIMITS.MAX_RESOURCE_BYTES ||
        typeof clone.data !== 'string' ||
        clone.data.length > Math.ceil(SPATIAL_LIMITS.MAX_RESOURCE_BYTES * 4 / 3) + 256
      ) throw new Error('A backup resource is invalid or exceeds the size limit.')
      return clone
    })(),
    id: resourceIdMap.get(resource.id),
    ownerId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))

  const sourceCanonicalResources = collectUniqueRecords(backup.canonicalResources, 'attachment')
  const sourceNoteResources = collectUniqueRecords(backup.noteResources, 'note resource link')
  const sourceRecognizedContent = collectUniqueRecords(backup.recognizedContent, 'recognition result')
  const canonicalResourceIdMap = new Map(sourceCanonicalResources.map((resource) => [resource.id, nextId()]))
  const canonicalResources = sourceCanonicalResources.map((resource) => {
    if (Number(resource.schemaVersion || 1) > RESOURCE_SCHEMA_VERSION) {
      throw new Error('An attachment was created by a newer QuickNotes version.')
    }
    const clone = cloneJsonValue(resource)
    const imported = {
      ...clone,
      id: canonicalResourceIdMap.get(resource.id),
      ownerId: null,
      schemaVersion: RESOURCE_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    assertCanonicalResource({ ...imported, ownerId: 'pending-import-owner' })
    return imported
  })
  const canonicalByOldId = new Map(sourceCanonicalResources.map((resource, index) => [resource.id, canonicalResources[index]]))
  const resourcePayloadById = new Map()
  let totalBinaryBytes = 0
  for (const payload of backup.resourcePayloads) {
    const oldId = typeof payload?.resourceId === 'string' ? payload.resourceId : ''
    if (!oldId || resourcePayloadById.has(oldId)) throw new Error('The backup contains a duplicate binary resource payload.')
    const metadata = canonicalByOldId.get(oldId)
    if (!metadata) throw new Error('A backup binary payload references a missing attachment.')
    totalBinaryBytes += Number(payload.byteSize) || 0
    if (totalBinaryBytes > MAX_BACKUP_TOTAL_BINARY_BYTES) throw new Error('The backup binary resources exceed the import limit.')
    const decoded = decodeResourcePayload(payload, { ...metadata, ownerId: 'pending-import-owner' }, 'pending-import-owner', timestamp)
    resourcePayloadById.set(oldId, { ...decoded, ownerId: null })
  }
  if (resourcePayloadById.size !== canonicalResources.length) {
    throw new Error('A backup attachment is missing its original binary payload.')
  }
  const resourceBlobs = sourceCanonicalResources.map((resource) => resourcePayloadById.get(resource.id))
  for (let index = 0; index < sourceCanonicalResources.length; index += 1) {
    const source = sourceCanonicalResources[index]
    const metadata = canonicalResources[index]
    const row = resourceBlobs[index]
    const checksum = await checksumBlob(row.data)
    if (metadata.checksum && checksum !== metadata.checksum) {
      throw new Error(`The attachment "${source.fileName || source.id}" failed its checksum verification.`)
    }
  }
  const noteResources = sourceNoteResources.map((link) => {
    const noteId = noteIdMap.get(link.noteId)
    const resourceId = canonicalResourceIdMap.get(link.resourceId)
    if (!noteId || !resourceId) throw new Error('A note resource link references missing content.')
    const imported = {
      ...cloneJsonValue(link),
      id: nextId(),
      ownerId: null,
      noteId,
      resourceId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    assertNoteResourceLink({ ...imported, ownerId: 'pending-import-owner' })
    return imported
  })

  const allResourceIdMap = new Map([...resourceIdMap, ...canonicalResourceIdMap])
  const sourceSpatialAnnotations = collectUniqueRecords(backup.spatialAnnotations, 'annotation layer')
  const sourceSpatialAnnotationPages = collectUniqueRecords(backup.spatialAnnotationPages, 'annotation page')
  const sourceSpatialAnnotationObjects = collectUniqueRecords(backup.spatialAnnotationObjects, 'annotation object')
  const annotationIdMap = new Map(sourceSpatialAnnotations.map((document) => [document.id, nextId()]))
  const annotationPageIdMap = new Map(sourceSpatialAnnotationPages.map((page) => [page.id, nextId()]))
  const annotationObjectIdMap = new Map(sourceSpatialAnnotationObjects.map((object) => [object.id, nextId()]))
  const spatialAnnotations = sourceSpatialAnnotations.map((document) => {
    const noteId = noteIdMap.get(document.noteId)
    const resourceId = allResourceIdMap.get(document.resourceId)
    if (!noteId || !resourceId || Number(document.schemaVersion || 1) > SPATIAL_SCHEMA_VERSION) {
      throw new Error('An annotation layer references missing or unsupported source content.')
    }
    return {
      ...cloneJsonValue(document),
      id: annotationIdMap.get(document.id),
      ownerId: null,
      noteId,
      resourceId,
      kind: 'paper',
      scope: 'annotation',
      schemaVersion: SPATIAL_SCHEMA_VERSION,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
  const annotationByOldId = new Map(sourceSpatialAnnotations.map((document, index) => [document.id, spatialAnnotations[index]]))
  const spatialAnnotationPages = sourceSpatialAnnotationPages.map((page) => {
    const document = annotationByOldId.get(page.annotationId)
    const mappedPageId = annotationPageIdMap.get(page.id)
    if (!document || page.noteId !== sourceSpatialAnnotations.find((candidate) => candidate.id === page.annotationId)?.noteId) {
      throw new Error('An annotation page references a missing annotation layer.')
    }
    return {
      ...cloneJsonValue(page),
      id: mappedPageId,
      ownerId: null,
      annotationId: document.id,
      noteId: document.noteId,
      resourceId: document.resourceId,
      schemaVersion: SPATIAL_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
  const annotationPageByOldId = new Map(sourceSpatialAnnotationPages.map((page, index) => [page.id, spatialAnnotationPages[index]]))
  const spatialAnnotationObjects = sourceSpatialAnnotationObjects.map((object) => {
    const document = annotationByOldId.get(object.annotationId)
    const page = annotationPageByOldId.get(object.pageId)
    if (!document || !page || page.annotationId !== document.id) {
      throw new Error('An annotation object references a missing annotation page.')
    }
    const data = cloneJsonValue(object.data || {})
    if (object.kind === 'noteLink' && data.targetNoteId) data.targetNoteId = noteIdMap.get(data.targetNoteId) || null
    if (data.resourceId) data.resourceId = allResourceIdMap.get(data.resourceId) || null
    if (Array.isArray(data.sourceStrokeIds)) {
      const values = data.sourceStrokeIds.map((id) => annotationObjectIdMap.get(id)).filter(Boolean)
      if (values.length !== data.sourceStrokeIds.length) throw new Error('An annotation shape references missing source ink.')
      data.sourceStrokeIds = values
    }
    if (data.convertedToShapeId) {
      data.convertedToShapeId = annotationObjectIdMap.get(data.convertedToShapeId)
      if (!data.convertedToShapeId) throw new Error('An annotation stroke references a missing shape.')
    }
    return {
      ...cloneJsonValue(object),
      id: annotationObjectIdMap.get(object.id),
      ownerId: null,
      annotationId: document.id,
      noteId: document.noteId,
      resourceId: document.resourceId,
      pageId: page.id,
      schemaVersion: SPATIAL_SCHEMA_VERSION,
      data,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
  const recognitionIdMap = new Map(sourceRecognizedContent.map((record) => [record.id, nextId()]))
  const recognizedContent = sourceRecognizedContent.map((record) => {
    if (Number(record.schemaVersion || 1) > INTELLIGENCE_SCHEMA_VERSION) {
      throw new Error('A recognition result was created by a newer QuickNotes version.')
    }
    const noteId = noteIdMap.get(record.noteId)
    const sourceResourceId = record.sourceResourceId ? allResourceIdMap.get(record.sourceResourceId) : null
    const sourceObjectIds = (record.sourceObjectIds || []).map((id) => objectIdMap.get(id)).filter(Boolean)
    const sourcePageId = record.sourcePageId ? pageIdMap.get(record.sourcePageId) || null : null
    if (!noteId || (record.sourceResourceId && !sourceResourceId)) {
      throw new Error('A recognition result references missing source content.')
    }
    const imported = createRecognizedContent({
      ...cloneJsonValue(record),
      id: recognitionIdMap.get(record.id),
      ownerId: 'pending-import-owner',
      noteId,
      sourceResourceId,
      sourceObjectIds,
      sourcePageId,
      createdAt: timestamp,
      generatedAt: validDate(record.generatedAt, timestamp),
      updatedAt: timestamp,
    })
    assertRecognizedContent(imported)
    return { ...imported, ownerId: null }
  })

  for (const note of notes) {
    const maps = {
      noteIdMap,
      recognitionIdMap,
      resourceIdMap: allResourceIdMap,
      objectIdMap,
      pageIdMap,
    }
    note.noteData = remapRecognizedTaskSources(note, maps)
    note.reminders = remapReminderSources(note.reminders, note.id, maps)
  }

  resources.forEach(assertSpatialResource)
  for (const document of spatialDocuments) {
    const documentPages = spatialPages.filter((page) => page.noteId === document.noteId)
    const documentObjects = spatialObjects.filter((object) => object.noteId === document.noteId)
    const referencedResourceIds = new Set(documentObjects.map((object) => object.data?.resourceId).filter(Boolean))
    assertSpatialPayload({
      document,
      pages: documentPages,
      objects: documentObjects,
      resources: resources.filter((resource) => referencedResourceIds.has(resource.id)),
    })
  }
  for (const document of spatialAnnotations) {
    const pages = spatialAnnotationPages.filter((page) => page.annotationId === document.id)
    const objects = spatialAnnotationObjects.filter((object) => object.annotationId === document.id)
    assertSpatialPayload({ document, pages, objects })
  }

  return {
    notes,
    noteVersions,
    folders,
    tags,
    savedViews,
    noteTemplates,
    spatialDocuments,
    spatialPages,
    spatialObjects,
    spatialAnnotations,
    spatialAnnotationPages,
    spatialAnnotationObjects,
    resources,
    canonicalResources,
    noteResources,
    resourceBlobs,
    recognizedContent,
  }
}
