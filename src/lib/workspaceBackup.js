import { MAX_FOLDER_NAME_LENGTH, limitNoteTitle, normalizeTagName } from './dataValidation'
import { sanitizeNoteHtml } from './sanitizeHtml'

export const WORKSPACE_BACKUP_FORMAT = 'quicknotes-workspace-backup'
export const WORKSPACE_BACKUP_VERSION = 1

const MAX_BACKUP_NOTES = 10_000
const MAX_BACKUP_FOLDERS = 1_000
const MAX_BACKUP_TAGS = 1_000
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
])
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const SAFE_COLOR = /^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/i

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
  reminder: note.reminder || null,
  reminders: cloneJsonValue(Array.isArray(note.reminders) ? note.reminders : []),
  order: Number.isFinite(note.order) ? note.order : null,
  createdAt: note.createdAt || null,
  updatedAt: note.updatedAt || null,
})

export function createWorkspaceBackup({ notes = [], folders = [], tags = [] }, exportedAt) {
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    schemaVersion: WORKSPACE_BACKUP_VERSION,
    exportedAt: validDate(exportedAt) || new Date().toISOString(),
    notes: notes.map(copyNoteForBackup),
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
  }
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
  if (backup.folders != null && !Array.isArray(backup.folders)) {
    throw new Error('The backup folder list is invalid.')
  }
  if (backup.tags != null && !Array.isArray(backup.tags)) {
    throw new Error('The backup tag list is invalid.')
  }

  const parsed = {
    notes: backup.notes,
    folders: backup.folders || [],
    tags: backup.tags || [],
  }
  if (parsed.notes.length > MAX_BACKUP_NOTES) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_NOTES.toLocaleString()} notes.`)
  }
  if (parsed.folders.length > MAX_BACKUP_FOLDERS) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_FOLDERS.toLocaleString()} folders.`)
  }
  if (parsed.tags.length > MAX_BACKUP_TAGS) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_TAGS.toLocaleString()} tags.`)
  }
  if (parsed.notes.length + parsed.folders.length + parsed.tags.length === 0) {
    throw new Error('The backup is empty.')
  }
  return parsed
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

const remapInternalNoteLinks = (html, noteIdMap) => {
  if (!html || noteIdMap.size === 0) return sanitizeNoteHtml(html)
  const documentNode = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

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

export function prepareWorkspaceImport(
  source,
  existingWorkspace,
  { createId, now = new Date().toISOString() }
) {
  if (typeof createId !== 'function') throw new Error('An ID generator is required.')
  const backup = parseWorkspaceBackup(source)
  const sourceFolders = collectUniqueRecords(backup.folders, 'folder')
  const sourceNotes = collectUniqueRecords(backup.notes, 'note')
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
    reminder: validDate(note.reminder),
    reminders: cloneJsonValue(Array.isArray(note.reminders) ? note.reminders : []),
    order: Number.isFinite(note.order) ? note.order : null,
    createdAt: validDate(note.createdAt, timestamp),
    updatedAt: timestamp,
    syncStatus: 'pending',
  }))

  return { notes, folders, tags }
}
