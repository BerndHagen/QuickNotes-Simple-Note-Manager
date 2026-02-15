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
    table,
    operation,
    data,
    timestamp: new Date().toISOString(),
  })
}

export const getPendingSyncItems = async () => {
  return await db.syncQueue.toArray()
}

export const removeSyncItem = async (id) => {
  return await db.syncQueue.delete(id)
}

export const saveNoteVersion = async (noteId, content, title, noteData = null) => {
  const versions = await db.noteVersions.where('noteId').equals(noteId).toArray()
  
  if (versions.length >= 30) {
    const oldestVersion = versions.reduce((oldest, v) => 
      new Date(v.createdAt) < new Date(oldest.createdAt) ? v : oldest
    )
    await db.noteVersions.delete(oldestVersion.id)
  }
  
  const versionEntry = {
    noteId,
    title: title || '',
    content: content || '',
    createdAt: new Date().toISOString(),
  }
  
  if (noteData) {
    versionEntry.noteData = typeof noteData === 'string' ? noteData : JSON.stringify(noteData)
  }
  
  return await db.noteVersions.add(versionEntry)
}

export const getNoteVersions = async (noteId) => {
  return await db.noteVersions
    .where('noteId')
    .equals(noteId)
    .reverse()
    .sortBy('createdAt')
}

export const clearLocalData = async () => {
  await db.notes.clear()
  await db.folders.clear()
  await db.tags.clear()
  await db.noteTags.clear()
  await db.noteVersions.clear()
  await db.syncQueue.clear()
}
