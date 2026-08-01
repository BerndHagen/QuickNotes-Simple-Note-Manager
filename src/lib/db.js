import Dexie from 'dexie'

export const db = new Dexie('QuickNotesDB')

db.version(1).stores({
  notes: 'id, title, content, folderId, userId, createdAt, updatedAt, syncStatus',
  folders: 'id, name, parentId, userId, createdAt, updatedAt, syncStatus',
  tags: 'id, name, color, userId, syncStatus',
  noteTags: '[noteId+tagId], noteId, tagId',
  noteVersions: '++id, noteId, content, createdAt',
  syncQueue: '++id, table, operation, data, timestamp',
})

db.version(2).stores({
  notes: 'id, title, content, folderId, userId, createdAt, updatedAt, syncStatus',
  folders: 'id, name, parentId, userId, createdAt, updatedAt, syncStatus',
  tags: 'id, name, color, userId, syncStatus',
  noteTags: '[noteId+tagId], noteId, tagId',
  noteVersions: '++id, ownerId, [ownerId+noteId], noteId, content, createdAt',
  syncQueue: '++id, ownerId, [ownerId+table], table, operation, data, timestamp',
  workspaceSnapshots: '&ownerId, updatedAt',
})

let activeWorkspaceOwnerId = null

export const setActiveWorkspaceOwner = (ownerId) => {
  activeWorkspaceOwnerId = ownerId || null
}

export const getActiveWorkspaceOwner = () => activeWorkspaceOwnerId

export const SyncStatus = {
  SYNCED: 'synced',
  PENDING: 'pending',
  CONFLICT: 'conflict',
  ERROR: 'error',
}

export const saveNoteOffline = async (note) => {
  return await db.notes.put({
    ...note,
    syncStatus: SyncStatus.PENDING,
    updatedAt: new Date().toISOString(),
  })
}

export const addToSyncQueue = async (table, operation, data) => {
  return await db.syncQueue.add({
    ownerId: activeWorkspaceOwnerId,
    table,
    operation,
    data,
    timestamp: new Date().toISOString(),
  })
}

export const getPendingSyncItems = async () => {
  if (!activeWorkspaceOwnerId) {
    return await db.syncQueue.filter((item) => !item.ownerId).toArray()
  }

  return await db.syncQueue.where('ownerId').equals(activeWorkspaceOwnerId).toArray()
}

export const removeSyncItem = async (id) => {
  return await db.syncQueue.delete(id)
}

export const saveNoteVersion = async (
  noteId,
  content,
  title,
  noteData = null,
  noteType = 'standard'
) => {
  const MAX_VERSIONS = 30
  const ownerId = activeWorkspaceOwnerId
  const versions = ownerId
    ? await db.noteVersions
        .where('[ownerId+noteId]')
        .equals([ownerId, noteId])
        .toArray()
    : await db.noteVersions
        .where('noteId')
        .equals(noteId)
        .filter((version) => !version.ownerId)
        .toArray()
  
  if (versions.length >= MAX_VERSIONS) {
    const sorted = versions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const toDelete = sorted.slice(0, versions.length - MAX_VERSIONS + 1)
    await Promise.all(toDelete.map(v => db.noteVersions.delete(v.id)))
  }
  
  const versionEntry = {
    ownerId,
    noteId,
    title: title || '',
    content: content || '',
    noteType,
    createdAt: new Date().toISOString(),
  }
  
  if (noteData) {
    versionEntry.noteData = typeof noteData === 'string' ? noteData : JSON.stringify(noteData)
  }
  
  return await db.noteVersions.add(versionEntry)
}

export const getNoteVersions = async (noteId) => {
  const ownerId = activeWorkspaceOwnerId
  const versions = ownerId
    ? await db.noteVersions
        .where('[ownerId+noteId]')
        .equals([ownerId, noteId])
        .reverse()
        .sortBy('createdAt')
    : await db.noteVersions
        .where('noteId')
        .equals(noteId)
        .filter((version) => !version.ownerId)
        .reverse()
        .sortBy('createdAt')
  
  if (versions.length > 30) {
    const toDelete = versions.slice(30)
    await Promise.all(toDelete.map(v => db.noteVersions.delete(v.id)))
    return versions.slice(0, 30)
  }
  
  return versions
}

export const saveWorkspaceSnapshot = async (ownerId, workspace) => {
  if (!ownerId) throw new Error('A workspace owner is required')

  const snapshot = {
    ...workspace,
    ownerId,
    updatedAt: new Date().toISOString(),
  }
  await db.workspaceSnapshots.put(snapshot)
  return snapshot
}

export const getWorkspaceSnapshot = async (ownerId) => {
  if (!ownerId) return null
  return (await db.workspaceSnapshots.get(ownerId)) || null
}

export const getWorkspaceCache = async () => {
  const [notes, folders, tags] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.tags.toArray(),
  ])
  return { notes, folders, tags }
}

export const replaceWorkspaceCache = async ({ notes = [], folders = [], tags = [] } = {}) => {
  await db.transaction('rw', db.notes, db.folders, db.tags, db.noteTags, async () => {
    await Promise.all([
      db.notes.clear(),
      db.folders.clear(),
      db.tags.clear(),
      db.noteTags.clear(),
    ])
    if (notes.length > 0) await db.notes.bulkPut(notes)
    if (folders.length > 0) await db.folders.bulkPut(folders)
    if (tags.length > 0) await db.tags.bulkPut(tags)
  })
}

export const adoptLegacyWorkspaceRecords = async (ownerId) => {
  if (!ownerId) return

  await db.transaction('rw', db.syncQueue, db.noteVersions, async () => {
    const [legacyQueue, legacyVersions] = await Promise.all([
      db.syncQueue.filter((item) => !item.ownerId).toArray(),
      db.noteVersions.filter((version) => !version.ownerId).toArray(),
    ])

    if (legacyQueue.length > 0) {
      await db.syncQueue.bulkPut(
        legacyQueue.map((item) => ({ ...item, ownerId }))
      )
    }
    if (legacyVersions.length > 0) {
      await db.noteVersions.bulkPut(
        legacyVersions.map((version) => ({ ...version, ownerId }))
      )
    }
  })
}

export const deleteWorkspaceData = async (ownerId) => {
  if (!ownerId) return

  await db.transaction(
    'rw',
    db.workspaceSnapshots,
    db.syncQueue,
    db.noteVersions,
    db.notes,
    db.folders,
    db.tags,
    db.noteTags,
    async () => {
      await Promise.all([
        db.workspaceSnapshots.delete(ownerId),
        db.syncQueue.where('ownerId').equals(ownerId).delete(),
        db.noteVersions.where('ownerId').equals(ownerId).delete(),
      ])

      if (activeWorkspaceOwnerId === ownerId) {
        await Promise.all([
          db.notes.clear(),
          db.folders.clear(),
          db.tags.clear(),
          db.noteTags.clear(),
        ])
      }
    }
  )
}

export const clearLocalData = async () => {
  await db.notes.clear()
  await db.folders.clear()
  await db.tags.clear()
  await db.noteTags.clear()
  await db.noteVersions.clear()
  await db.syncQueue.clear()
  await db.workspaceSnapshots.clear()
  activeWorkspaceOwnerId = null
}
