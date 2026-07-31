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
