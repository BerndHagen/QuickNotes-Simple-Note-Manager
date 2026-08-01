/**
 * Reconciles local folder ids with the ones the cloud already stores.
 *
 * A workspace that existed locally before sign-in has its own folder UUIDs. When
 * the same folder also exists in the cloud, notes must reference the cloud id, or
 * the upload fails the folder foreign key. Matching is by name, which is unique
 * per account.
 */

export const buildFolderIdRemap = (localFolders = [], remoteFolders = []) => {
  const remoteIds = new Set(remoteFolders.map((folder) => folder.id))
  const remoteByName = new Map(
    remoteFolders.map((folder) => [folder.name.trim().toLowerCase(), folder])
  )
  const remap = new Map()

  for (const folder of localFolders) {
    if (remoteIds.has(folder.id)) continue
    const canonical = remoteByName.get(folder.name.trim().toLowerCase())
    if (canonical) remap.set(folder.id, canonical.id)
  }

  return remap
}

export const remapNoteFolder = (note, folderIdRemap) => {
  const folderId = folderIdRemap.get(note.folderId)
  return folderId ? { ...note, folderId } : note
}

export const buildOperationIndex = (items = [], table) => {
  const operations = new Map()

  for (const item of items) {
    if (item.table !== table || !item.data?.id) continue
    const recordOperations = operations.get(item.data.id) || new Set()
    recordOperations.add(item.operation)
    operations.set(item.data.id, recordOperations)
  }

  return operations
}

/**
 * A missing remote row is uploadable only when it is a local create. An
 * update-only journal entry means another client deleted the row while this
 * client was offline; re-inserting it would silently undo that deletion.
 *
 * Legacy caches can contain pending rows without a journal entry, so those are
 * treated as local creates rather than discarded.
 */
export const shouldUploadPendingRecord = (
  record,
  remoteIds,
  operationIndex,
  pendingStatus = 'pending'
) => {
  const operations = operationIndex.get(record.id)
  const isPending = record.syncStatus === pendingStatus
  const isLegacyCreate = !record.syncStatus && operations?.has('insert')
  if (!isPending && !isLegacyCreate) return false
  if (remoteIds.has(record.id)) return true

  if (!operations || operations.size === 0) return true
  return operations.has('insert')
}

export const isRemoteNewer = (localUpdatedAt, remoteUpdatedAt, bufferMs = 2000) => {
  const localTime = new Date(localUpdatedAt).getTime()
  const remoteTime = new Date(remoteUpdatedAt).getTime()
  if (!Number.isFinite(localTime) || !Number.isFinite(remoteTime)) return false
  return remoteTime > localTime + bufferMs
}
