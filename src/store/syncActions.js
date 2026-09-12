import toast from 'react-hot-toast'
import { backend, isBackendConfigured } from '../lib/backend'
import {
  acknowledgeSyncItem,
  db,
  deleteNoteSyncSnapshot,
  getPendingSyncItems,
  notifyCanonicalContentPersisted,
  saveNoteSyncSnapshot,
  SyncStatus,
} from '../lib/db'
import {
  buildFolderIdRemap,
  buildOperationIndex,
  isRemoteNewer,
  remapNoteFolder,
  shouldUploadPendingRecord,
} from '../lib/syncReconciliation'
import {
  addContentDescriptorToNoteData,
  extractContentDescriptorFromNoteData,
} from '../lib/contentModel'
import { syncSpatialQueue } from '../lib/spatial/cloud'
import { syncAnnotationQueue } from '../lib/spatial/annotationCloud'
import { syncCaptureCloud } from '../lib/capture/cloud'
import { enqueueCollaborationConflict } from './collaborationState'

/**
 * Owns the cloud reconciliation action while the compatibility store remains
 * the visible state authority. Dependency injection keeps account-transition
 * serialization and UI preferences outside the sync engine.
 */
export function createSyncActions({
  set,
  get,
  runBackendSync,
  withWorkspaceSyncLock,
  getUIState,
}) {
  return {
    syncWithBackend: (options = {}) => runBackendSync(() =>
        withWorkspaceSyncLock(get().cacheOwnerId, async () => {
        const notify = options?.notify === true
        const { isSyncing } = get()
        if (isSyncing) return false

        set({ isSyncing: true, lastSyncError: null })

        if (!isBackendConfigured()) {
          set({ isSyncing: false })
          return false
        }

        const { user } = get()
        if (!user) {
          set({ isSyncing: false })
          return false
        }

        // A local workspace has no cloud session by design, and must never be
        // mistaken for an expired one below.
        if (user.isLocal) {
          set({ isSyncing: false })
          return false
        }

        try {
          const { data: { session } } = await backend.auth.getSession()
          if (!session) {
            set({ user: null, isSyncing: false })
            return false
          }
        } catch (error) {
          set({ isSyncing: false, lastSyncError: error.message || 'Session validation failed' })
          return false
        }

        const showNotifications = notify && getUIState().showSyncNotifications
        const syncToast = showNotifications ? toast.loading('Synchronizing...') : null

        try {
          const pendingSyncItems = await getPendingSyncItems()
          const folderOperations = buildOperationIndex(pendingSyncItems, 'folders')
          const tagOperations = buildOperationIndex(pendingSyncItems, 'tags')
          const noteOperations = buildOperationIndex(pendingSyncItems, 'notes')
          const conflictedNoteIds = new Set()
          const conflictedCatalogKeys = new Set()
          const catalogConflictWrites = []
          let conflictCount = 0

          const markCatalogConflict = async ({ table, stateKey, local, remote }) => {
            const key = `${table}:${local.id}`
            conflictedCatalogKeys.add(key)
            const conflicted = { ...local, syncStatus: SyncStatus.CONFLICT }
            const conflict = {
              table,
              stateKey,
              recordId: local.id,
              localUpdatedAt: local.updatedAt || null,
              remote,
              detectedAt: new Date().toISOString(),
              queueSnapshots: pendingSyncItems.filter(
                (item) => item.table === table && item.data?.id === local.id
              ),
            }
            let applied = false
            set((state) => {
              if (!state[stateKey].includes(local)) return state
              applied = true
              return {
                [stateKey]: state[stateKey].map((current) =>
                  current === local ? conflicted : current
                ),
                catalogConflicts: [
                  ...state.catalogConflicts.filter(
                    (current) => !(current.table === table && current.recordId === local.id)
                  ),
                  conflict,
                ],
              }
            })
            if (!applied) return false
            if (table === 'folders') await db.folders.put(conflicted)
            if (table === 'tags') await db.tags.put(conflicted)
            return true
          }

          const syncOwnedCollection = async ({ table, stateKey, toRemote, fromRemote }) => {
            const operations = buildOperationIndex(pendingSyncItems, table)
            const deletions = pendingSyncItems.filter(
              (item) => item.table === table && item.operation === 'delete'
            )
            for (const item of deletions) {
              const { error } = await backend
                .from(table)
                .delete()
                .eq('id', item.data.id)
                .eq('user_id', user.id)
              if (error) throw error
              await acknowledgeSyncItem(item)
            }

            const { data: initialRemote, error: fetchError } = await backend
              .from(table)
              .select('*')
              .eq('user_id', user.id)
            if (fetchError) throw fetchError

            const remoteById = new Map((initialRemote || []).map((record) => [record.id, record]))
            const remoteIds = new Set(remoteById.keys())
            const localRecords = get()[stateKey] || []

            for (const record of localRecords.filter(
              (candidate) => [SyncStatus.PENDING, SyncStatus.CONFLICT].includes(candidate.syncStatus)
            )) {
              const existingConflict = get().catalogConflicts.find(
                (conflict) => conflict.table === table && conflict.recordId === record.id
              )
              if (record.syncStatus === SyncStatus.CONFLICT) {
                if (existingConflict) {
                  conflictedCatalogKeys.add(`${table}:${record.id}`)
                } else {
                  const remoteRecord = remoteById.get(record.id)
                  await markCatalogConflict({
                    table,
                    stateKey,
                    local: record,
                    remote: remoteRecord ? fromRemote(remoteRecord) : null,
                  })
                  conflictCount++
                }
                continue
              }
              if (!shouldUploadPendingRecord(record, remoteIds, operations, SyncStatus.PENDING)) {
                await markCatalogConflict({ table, stateKey, local: record, remote: null })
                conflictCount++
                continue
              }

              const remoteRecord = remoteById.get(record.id)
              if (remoteRecord && isRemoteNewer(record.updatedAt, remoteRecord.updated_at)) {
                const remoteData = fromRemote(remoteRecord)
                await markCatalogConflict({ table, stateKey, local: record, remote: remoteData })
                conflictCount++
                continue
              }

              const { error } = await backend.from(table).upsert(toRemote(record, user.id)).select()
              if (error) throw error
              set((state) => ({
                [stateKey]: state[stateKey].map((current) =>
                  current.id === record.id && current.updatedAt === record.updatedAt
                    ? { ...current, syncStatus: SyncStatus.SYNCED }
                    : current
                ),
              }))
            }

            const { data: refreshedRemote, error: refreshedError } = await backend
              .from(table)
              .select('*')
              .eq('user_id', user.id)
            if (refreshedError) throw refreshedError

            const deletedIds = new Set(deletions.map((item) => item.data.id))
            const refreshedById = new Map(
              (refreshedRemote || [])
                .filter((record) => !deletedIds.has(record.id))
                .map((record) => [record.id, record])
            )

            set((state) => {
              const reconciled = []
              for (const localRecord of state[stateKey]) {
                if (deletedIds.has(localRecord.id)) continue
                const remoteRecord = refreshedById.get(localRecord.id)
                if ([SyncStatus.PENDING, SyncStatus.CONFLICT].includes(localRecord.syncStatus)) {
                  reconciled.push(localRecord)
                  refreshedById.delete(localRecord.id)
                } else if (remoteRecord) {
                  reconciled.push(fromRemote(remoteRecord))
                  refreshedById.delete(localRecord.id)
                }
              }
              for (const remoteRecord of refreshedById.values()) {
                reconciled.push(fromRemote(remoteRecord))
              }
              return { [stateKey]: reconciled }
            })
          }

          await syncOwnedCollection({
            table: 'saved_views',
            stateKey: 'savedViews',
            toRemote: (view, userId) => ({
              id: view.id,
              user_id: userId,
              name: view.name,
              icon: view.icon || 'ListFilter',
              color: view.color || '#2a697a',
              criteria: view.criteria,
              sort_order: view.order ?? null,
              created_at: view.createdAt,
              updated_at: view.updatedAt,
            }),
            fromRemote: (view) => ({
              id: view.id,
              name: view.name,
              icon: view.icon,
              color: view.color,
              criteria: view.criteria,
              order: view.sort_order,
              createdAt: view.created_at,
              updatedAt: view.updated_at,
              syncStatus: SyncStatus.SYNCED,
            }),
          })

          await syncOwnedCollection({
            table: 'note_templates',
            stateKey: 'noteTemplates',
            toRemote: (template, userId) => ({
              id: template.id,
              user_id: userId,
              name: template.name,
              description: template.description || '',
              note_type: template.noteType || 'standard',
              title_template: template.titleTemplate || template.name,
              content: template.content || '',
              note_data: template.noteData ?? null,
              tags: template.tags || [],
              favorite: Boolean(template.favorite),
              created_at: template.createdAt,
              updated_at: template.updatedAt,
            }),
            fromRemote: (template) => ({
              id: template.id,
              name: template.name,
              description: template.description,
              noteType: template.note_type,
              titleTemplate: template.title_template,
              content: template.content,
              noteData: template.note_data,
              tags: template.tags || [],
              favorite: template.favorite,
              createdAt: template.created_at,
              updatedAt: template.updated_at,
              syncStatus: SyncStatus.SYNCED,
            }),
          })

          const folderDeletions = pendingSyncItems.filter(
            item => item.table === 'folders' && item.operation === 'delete'
          )
          for (const item of folderDeletions) {
            const { error } = await backend
              .from('folders')
              .delete()
              .eq('id', item.data.id)
              .eq('user_id', user.id)
            if (error) throw error
            await acknowledgeSyncItem(item)
          }

          const tagDeletions = pendingSyncItems.filter(
            item => item.table === 'tags' && item.operation === 'delete'
          )
          for (const item of tagDeletions) {
            const { error } = await backend
              .from('tags')
              .delete()
              .eq('id', item.data.id)
              .eq('user_id', user.id)
            if (error) throw error
            await acknowledgeSyncItem(item)
          }

          const { data: initialRemoteFolders, error: folderFetchError } = await backend
            .from('folders')
            .select('*')
            .eq('user_id', user.id)
          if (folderFetchError) throw folderFetchError

          const localFolders = get().folders
          // A legacy/local starter can have the same name as its cloud copy but
          // a different UUID. Canonicalize it to the cloud UUID so notes never
          // upload a folder_id that was deliberately skipped.
          const folderIdRemap = buildFolderIdRemap(
            localFolders,
            initialRemoteFolders || []
          )
          const initialRemoteFolderIds = new Set(
            (initialRemoteFolders || []).map((folder) => folder.id)
          )
          const initialRemoteFoldersById = new Map(
            (initialRemoteFolders || []).map((folder) => [folder.id, folder])
          )
          const folderSnapshotTimes = new Map(
            localFolders.map((folder) => [folder.id, folder.updatedAt])
          )

          const foldersToUpload = localFolders.filter(
            (folder) => {
              const remoteFolder = initialRemoteFoldersById.get(folder.id)
              if (folder.syncStatus === SyncStatus.CONFLICT) {
                const existingConflict = get().catalogConflicts.find(
                  (conflict) => conflict.table === 'folders' && conflict.recordId === folder.id
                )
                if (existingConflict) {
                  conflictedCatalogKeys.add(`folders:${folder.id}`)
                } else {
                  catalogConflictWrites.push(markCatalogConflict({
                    table: 'folders',
                    stateKey: 'folders',
                    local: folder,
                    remote: remoteFolder ? {
                      id: remoteFolder.id,
                      name: remoteFolder.name,
                      icon: remoteFolder.icon || 'Folder',
                      color: remoteFolder.color || '#2a697a',
                      parentId: remoteFolder.parent_id || null,
                      createdAt: remoteFolder.created_at,
                      updatedAt: remoteFolder.updated_at || remoteFolder.created_at,
                      syncStatus: SyncStatus.SYNCED,
                    } : null,
                  }))
                  conflictCount++
                }
                return false
              }
              if (folderIdRemap.has(folder.id)) return false
              if (!shouldUploadPendingRecord(
                   folder,
                   initialRemoteFolderIds,
                   folderOperations,
                   SyncStatus.PENDING
              )) {
                if (folder.syncStatus === SyncStatus.PENDING) {
                  catalogConflictWrites.push(markCatalogConflict({
                    table: 'folders',
                    stateKey: 'folders',
                    local: folder,
                    remote: null,
                  }))
                  conflictCount++
                }
                return false
              }

              if (remoteFolder && isRemoteNewer(folder.updatedAt, remoteFolder.updated_at)) {
                const remoteData = {
                  id: remoteFolder.id,
                  name: remoteFolder.name,
                  icon: remoteFolder.icon || 'Folder',
                  color: remoteFolder.color || '#2a697a',
                  parentId: remoteFolder.parent_id || null,
                  createdAt: remoteFolder.created_at,
                  updatedAt: remoteFolder.updated_at || remoteFolder.created_at,
                  syncStatus: SyncStatus.SYNCED,
                }
                catalogConflictWrites.push(markCatalogConflict({
                  table: 'folders',
                  stateKey: 'folders',
                  local: folder,
                  remote: remoteData,
                }))
                conflictCount++
                return false
              }
              return true
            }
          )
          if (catalogConflictWrites.length > 0) {
            await Promise.all(catalogConflictWrites.splice(0))
          }

          for (const folder of foldersToUpload) {
            const folderData = {
              id: folder.id,
              user_id: user.id,
              name: folder.name,
              icon: folder.icon || 'Folder',
              color: folder.color || '#2a697a',
              parent_id: folderIdRemap.get(folder.parentId) || folder.parentId || null,
              created_at: folder.createdAt || new Date().toISOString(),
              updated_at: folder.updatedAt || folder.createdAt || new Date().toISOString(),
              sync_status: 'synced',
            }

            const { error } = await backend
              .from('folders')
              .upsert(folderData)
              .select()

            if (error) throw error
          }

          const { data: remoteFolders, error: refreshedFolderError } = await backend
            .from('folders')
            .select('*')
            .eq('user_id', user.id)
          if (refreshedFolderError) throw refreshedFolderError

          const latestFolderQueue = await getPendingSyncItems()
          const deletedFolderIds = new Set([
            ...folderDeletions.map((item) => item.data.id),
            ...latestFolderQueue
              .filter((item) => item.table === 'folders' && item.operation === 'delete')
              .map((item) => item.data.id),
          ])
          const canonicalFolders = (remoteFolders || [])
            .filter((folder) => !deletedFolderIds.has(folder.id))
            .map((folder) => ({
              id: folder.id,
              name: folder.name,
              icon: folder.icon || 'Folder',
              color: folder.color || '#2a697a',
              parentId: folder.parent_id || null,
              createdAt: folder.created_at,
              updatedAt: folder.updated_at || folder.created_at,
              syncStatus: SyncStatus.SYNCED,
            }))

          set((state) => {
            const canonicalById = new Map(
              canonicalFolders.map((folder) => [folder.id, folder])
            )
            const reconciledFolders = []

            for (const currentFolder of state.folders) {
              if (deletedFolderIds.has(currentFolder.id)) continue

              const remappedId = folderIdRemap.get(currentFolder.id)
              const canonicalId = remappedId || currentFolder.id
              const changedDuringSync =
                currentFolder.syncStatus === SyncStatus.PENDING &&
                (!folderSnapshotTimes.has(currentFolder.id) ||
                  folderSnapshotTimes.get(currentFolder.id) !== currentFolder.updatedAt)

              if (changedDuringSync || currentFolder.syncStatus === SyncStatus.CONFLICT) {
                reconciledFolders.push(
                  remappedId ? { ...currentFolder, id: remappedId } : currentFolder
                )
                canonicalById.delete(canonicalId)
                continue
              }

              const canonicalFolder = canonicalById.get(canonicalId)
              if (canonicalFolder) {
                reconciledFolders.push(canonicalFolder)
                canonicalById.delete(canonicalId)
              }
            }

            reconciledFolders.push(...canonicalById.values())
            const reconciledFolderIds = new Set(
              reconciledFolders.map((folder) => folder.id)
            )
            const remappedSelection =
              folderIdRemap.get(state.selectedFolderId) || state.selectedFolderId

            return {
              folders: reconciledFolders,
              notes: state.notes.map((note) => {
                const remapped = remapNoteFolder(note, folderIdRemap)
                return remapped === note
                  ? note
                  : { ...remapped, syncStatus: SyncStatus.PENDING }
              }),
              selectedFolderId:
                remappedSelection && reconciledFolderIds.has(remappedSelection)
                  ? remappedSelection
                  : null,
            }
          })

          const reconciledFolders = get().folders
          const reconciledFolderIds = new Set(reconciledFolders.map((folder) => folder.id))
          const persistedFolderIds = await db.folders.toCollection().primaryKeys()
          const staleFolderIds = persistedFolderIds.filter(
            (folderId) => !reconciledFolderIds.has(folderId)
          )
          const remappedFolderIds = new Set(folderIdRemap.values())
          const remappedNotes = get().notes.filter((note) =>
            remappedFolderIds.has(note.folderId)
          )
          await db.transaction('rw', db.folders, db.notes, async () => {
            if (staleFolderIds.length > 0) await db.folders.bulkDelete(staleFolderIds)
            if (reconciledFolders.length > 0) await db.folders.bulkPut(reconciledFolders)
            if (remappedNotes.length > 0) await db.notes.bulkPut(remappedNotes)
          })

          const { data: initialRemoteTags, error: tagFetchError } = await backend
            .from('tags')
            .select('*')
            .eq('user_id', user.id)
          if (tagFetchError) throw tagFetchError

          const localTags = get().tags
          const remoteTagNames = new Set((initialRemoteTags || []).map((tag) => tag.name.toLowerCase()))
          const remoteTagIds = new Set((initialRemoteTags || []).map((tag) => tag.id))
          const initialRemoteTagsById = new Map(
            (initialRemoteTags || []).map((tag) => [tag.id, tag])
          )
          const tagSnapshotTimes = new Map(localTags.map((tag) => [tag.id, tag.updatedAt]))
          const tagsToUpload = localTags.filter(tag => {
            const remoteTag = initialRemoteTagsById.get(tag.id)
            if (tag.syncStatus === SyncStatus.CONFLICT) {
              const existingConflict = get().catalogConflicts.find(
                (conflict) => conflict.table === 'tags' && conflict.recordId === tag.id
              )
              if (existingConflict) {
                conflictedCatalogKeys.add(`tags:${tag.id}`)
              } else {
                catalogConflictWrites.push(markCatalogConflict({
                  table: 'tags',
                  stateKey: 'tags',
                  local: tag,
                  remote: remoteTag ? {
                    id: remoteTag.id,
                    name: remoteTag.name,
                    color: remoteTag.color || '#3b82f6',
                    createdAt: remoteTag.created_at,
                    updatedAt: remoteTag.updated_at || remoteTag.created_at,
                    syncStatus: SyncStatus.SYNCED,
                  } : null,
                }))
                conflictCount++
              }
              return false
            }
            if (!shouldUploadPendingRecord(
              tag,
              remoteTagIds,
              tagOperations,
              SyncStatus.PENDING
            )) {
              if (tag.syncStatus === SyncStatus.PENDING) {
                catalogConflictWrites.push(markCatalogConflict({
                  table: 'tags',
                  stateKey: 'tags',
                  local: tag,
                  remote: null,
                }))
                conflictCount++
              }
              return false
            }
            if (remoteTag?.updated_at && isRemoteNewer(tag.updatedAt, remoteTag.updated_at)) {
              catalogConflictWrites.push(markCatalogConflict({
                table: 'tags',
                stateKey: 'tags',
                local: tag,
                remote: {
                  id: remoteTag.id,
                  name: remoteTag.name,
                  color: remoteTag.color || '#3b82f6',
                  createdAt: remoteTag.created_at,
                  updatedAt: remoteTag.updated_at || remoteTag.created_at,
                  syncStatus: SyncStatus.SYNCED,
                },
              }))
              conflictCount++
              return false
            }
            return remoteTagIds.has(tag.id) || !remoteTagNames.has(tag.name.toLowerCase())
          })
          if (catalogConflictWrites.length > 0) {
            await Promise.all(catalogConflictWrites.splice(0))
          }

          for (const tag of tagsToUpload) {
            const tagData = {
              id: tag.id,
              user_id: user.id,
              name: tag.name,
              color: tag.color || '#3b82f6',
              created_at: tag.createdAt || new Date().toISOString(),
              updated_at: tag.updatedAt || tag.createdAt || new Date().toISOString(),
            }

            const { error } = await backend
              .from('tags')
              .upsert(tagData)
              .select()

            if (error) throw error
          }

          const { data: remoteTags, error: refreshedTagError } = await backend
            .from('tags')
            .select('*')
            .eq('user_id', user.id)
          if (refreshedTagError) throw refreshedTagError

          const canonicalTags = (remoteTags || []).map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color || '#3b82f6',
            createdAt: tag.created_at,
            updatedAt: tag.updated_at || tag.created_at,
            syncStatus: SyncStatus.SYNCED,
          }))
          const deletedTagIds = new Set(tagDeletions.map((item) => item.data.id))
          const canonicalTagsById = new Map(canonicalTags.map((tag) => [tag.id, tag]))
          set((state) => {
            const reconciledTags = []
            for (const currentTag of state.tags) {
              if (deletedTagIds.has(currentTag.id)) continue
              const changedDuringSync =
                currentTag.syncStatus === SyncStatus.PENDING &&
                (!tagSnapshotTimes.has(currentTag.id) ||
                  tagSnapshotTimes.get(currentTag.id) !== currentTag.updatedAt)
              if (changedDuringSync || currentTag.syncStatus === SyncStatus.CONFLICT) {
                reconciledTags.push(currentTag)
                canonicalTagsById.delete(currentTag.id)
                continue
              }
              const canonical = canonicalTagsById.get(currentTag.id)
              if (canonical) {
                reconciledTags.push(canonical)
                canonicalTagsById.delete(currentTag.id)
              }
            }
            reconciledTags.push(...canonicalTagsById.values())
            return { tags: reconciledTags }
          })
          const reconciledTags = get().tags
          const reconciledTagIds = new Set(reconciledTags.map((tag) => tag.id))
          const persistedTagIds = await db.tags.toCollection().primaryKeys()
          const staleTagIds = persistedTagIds.filter((tagId) => !reconciledTagIds.has(tagId))
          await db.transaction('rw', db.tags, async () => {
            if (staleTagIds.length > 0) await db.tags.bulkDelete(staleTagIds)
            if (reconciledTags.length > 0) await db.tags.bulkPut(reconciledTags)
          })

          const toSnakeCase = (note) => {
            // Merge reminders array into note_data JSONB for Supabase persistence
            const baseNoteData = addContentDescriptorToNoteData(note.noteData, note)
            const remindersData = note.reminders?.length ? { reminders: note.reminders } : {}
            const mergedNoteData = { ...baseNoteData, ...remindersData }
            const hasNoteData = Object.keys(mergedNoteData).length > 0

            // Set reminder TIMESTAMPTZ to the next upcoming (non-notified) reminder
            const nextReminder = note.reminders?.length
              ? note.reminders
                  .filter(r => !r.notified)
                  .map(r => r.datetime)
                  .sort()[0] || null
              : (note.reminder || null)

            return {
              id: note.id,
              user_id: user.id,
              folder_id: folderIdRemap.get(note.folderId) || note.folderId || null,
              title: note.title,
              content: note.content,
              starred: note.starred || false,
              pinned: note.pinned || false,
              deleted: note.deleted || false,
              deleted_at: note.deletedAt || null,
              archived: note.archived || false,
              archived_at: note.archivedAt || null,
              reminder: nextReminder,
              tags: note.tags || [],
              sort_order: note.order ?? null,
              note_type: note.noteType || 'standard',
              note_data: hasNoteData ? mergedNoteData : null,
              created_at: note.createdAt,
              updated_at: note.updatedAt,
              sync_status: 'synced',
            }
          }

          const toCamelCase = (note) => {
            // Extract reminders from note_data JSONB, rest goes to noteData
            const descriptor = extractContentDescriptorFromNoteData(note.note_type || 'standard', note.note_data)
            const rawNoteData = descriptor.noteData || {}
            const { reminders: remindersFromData, ...restNoteData } = rawNoteData
            const hasRestData = Object.keys(restNoteData).length > 0

            return {
              id: note.id,
              userId: note.user_id,
              folderId: note.folder_id,
              title: note.title,
              content: note.content,
              starred: note.starred,
              pinned: note.pinned,
              deleted: note.deleted || false,
              deletedAt: note.deleted_at,
              archived: note.archived || false,
              archivedAt: note.archived_at,
              reminder: note.reminder,
              reminders: remindersFromData || [],
              tags: note.tags || [],
              order: note.sort_order ?? null,
              noteType: note.note_type || 'standard',
              noteData: hasRestData ? restNoteData : null,
              contentKind: descriptor.contentKind,
              contentSchemaVersion: descriptor.contentSchemaVersion,
              createdAt: note.created_at,
              updatedAt: note.updated_at,
              syncStatus: SyncStatus.SYNCED,
            }
          }

          const noteDeletions = pendingSyncItems.filter(
            item => item.table === 'notes' && item.operation === 'delete'
          )

          for (const item of noteDeletions) {
            const { error } = await backend
              .from('notes')
              .delete()
              .eq('id', item.data.id)
              .eq('user_id', user.id)
            if (error) throw error
            await acknowledgeSyncItem(item)
          }

          const { data: initialRemoteNotes, error: initialNoteFetchError } = await backend
            .from('notes')
            .select('*')
            .eq('user_id', user.id)

          if (initialNoteFetchError) throw initialNoteFetchError

          const initialRemoteById = new Map(
            (initialRemoteNotes || []).map((note) => [note.id, note])
          )
          const initialRemoteNoteIds = new Set(initialRemoteById.keys())
          const pendingNotes = get().notes.filter((note) =>
            [SyncStatus.PENDING, SyncStatus.CONFLICT].includes(note.syncStatus)
          )

          let syncedCount = 0
          let errorCount = 0
          for (const note of pendingNotes) {
            const remoteNote = initialRemoteById.get(note.id)
            if (note.syncStatus === SyncStatus.CONFLICT) {
              const remoteData = remoteNote ? toCamelCase(remoteNote) : null
              conflictedNoteIds.add(note.id)
              set((state) => enqueueCollaborationConflict(state, {
                  kind: 'owned',
                  noteId: note.id,
                  localUpdatedAt: note.updatedAt,
                  remote: remoteData,
                  receivedAt: new Date().toISOString(),
                }))
              conflictCount++
              continue
            }
            if (!shouldUploadPendingRecord(
              note,
              initialRemoteNoteIds,
              noteOperations,
              SyncStatus.PENDING
            )) {
              const conflicted = { ...note, syncStatus: SyncStatus.CONFLICT }
              conflictedNoteIds.add(note.id)
              let conflictApplied = false
              set((state) => {
                if (!state.notes.includes(note)) return state
                conflictApplied = true
                return {
                  notes: state.notes.map((current) => current === note ? conflicted : current),
                  ...enqueueCollaborationConflict(state, {
                    kind: 'owned',
                    noteId: note.id,
                    localUpdatedAt: note.updatedAt,
                    remote: null,
                    receivedAt: new Date().toISOString(),
                  }),
                }
              })
              if (conflictApplied) await saveNoteSyncSnapshot(conflicted)
              conflictCount++
              continue
            }

            if (remoteNote && isRemoteNewer(note.updatedAt, remoteNote.updated_at)) {
              const remoteData = toCamelCase(remoteNote)
              if (note.order !== undefined && note.order !== null && remoteData.order === null) {
                remoteData.order = note.order
              }
              const conflicted = { ...note, syncStatus: SyncStatus.CONFLICT }
              conflictedNoteIds.add(note.id)
              let conflictApplied = false
              set((state) => {
                if (!state.notes.includes(note)) return state
                conflictApplied = true
                return {
                  notes: state.notes.map((current) => current === note ? conflicted : current),
                  ...enqueueCollaborationConflict(state, {
                    kind: 'owned',
                    noteId: note.id,
                    localUpdatedAt: note.updatedAt,
                    remote: remoteData,
                    receivedAt: new Date().toISOString(),
                  }),
                }
              })
              if (conflictApplied) await saveNoteSyncSnapshot(conflicted)
              conflictCount++
              continue
            }

            const { error } = await backend
              .from('notes')
              .upsert(toSnakeCase(note))
              .select()

            if (!error) {
              syncedCount++
              set((state) => ({
                notes: state.notes.map((current) =>
                  current === note
                    ? { ...current, syncStatus: SyncStatus.SYNCED }
                    : current
                ),
              }))
            } else {
              errorCount++
            }
          }

          await syncSpatialQueue(user.id)
          await syncAnnotationQueue(user.id)
          await syncCaptureCloud(user.id)

          const { data: remoteNotes, error: fetchError } = await backend
            .from('notes')
            .select('*')
            .eq('user_id', user.id)

          if (fetchError) throw fetchError

          const deletedNoteIds = new Set(noteDeletions.map((item) => item.data.id))
          const remoteNotesById = new Map(
            (remoteNotes || [])
              .filter((note) => !deletedNoteIds.has(note.id))
              .map((note) => [note.id, note])
          )
          const localNoteIdsBeforeReconciliation = get().notes.map((note) => note.id)

          set((state) => {
            const reconciledNotes = []

            for (const localNote of state.notes) {
              if (deletedNoteIds.has(localNote.id)) {
                continue
              }

              const remoteNote = remoteNotesById.get(localNote.id)
              if ([SyncStatus.PENDING, SyncStatus.CONFLICT].includes(localNote.syncStatus)) {
                reconciledNotes.push(localNote)
                remoteNotesById.delete(localNote.id)
                continue
              }

              if (!remoteNote) continue

              const remoteData = toCamelCase(remoteNote)
              if (
                localNote.order !== undefined &&
                localNote.order !== null &&
                remoteData.order === null
              ) {
                remoteData.order = localNote.order
              }
              reconciledNotes.push(remoteData)
              remoteNotesById.delete(localNote.id)
            }

            for (const remoteNote of remoteNotesById.values()) {
              reconciledNotes.push(toCamelCase(remoteNote))
            }

            return { notes: reconciledNotes }
          })

          const reconciledNoteIds = new Set(get().notes.map((note) => note.id))
          const removedNoteIds = localNoteIdsBeforeReconciliation.filter(
            (id) => !reconciledNoteIds.has(id)
          )
          if (removedNoteIds.length > 0) {
            await Promise.all(removedNoteIds.map((id) => deleteNoteSyncSnapshot(id)))
          }
          if (get().notes.length > 0) {
            await Promise.all(get().notes.map((note) => saveNoteSyncSnapshot(note)))
          }

          await get().loadSharedNotes()

          if (errorCount > 0) {
            throw new Error(`${errorCount} note${errorCount === 1 ? '' : 's'} could not be uploaded`)
          }

          // Remove only the operation snapshot processed by this run. Writes
          // created while network requests were in flight belong to the next
          // run and must remain queued.
          for (const item of pendingSyncItems) {
            if (
              item.operation !== 'delete' &&
              !(item.table === 'notes' && conflictedNoteIds.has(item.data?.id)) &&
              !conflictedCatalogKeys.has(`${item.table}:${item.data?.id}`)
            ) {
              await acknowledgeSyncItem(item)
            }
          }

          set({ lastSyncTime: new Date().toISOString(), lastSyncError: null })

          const showNotifications = getUIState().showSyncNotifications

          if (errorCount > 0 && syncToast) {
            toast.error(`Sync partially failed (${errorCount} errors)`, { id: syncToast })
          } else if (showNotifications && syncToast) {
            const detail = conflictCount > 0
              ? `${conflictCount} newer cloud change${conflictCount === 1 ? '' : 's'} kept.`
              : syncedCount > 0
                ? `${syncedCount} changes uploaded.`
                : 'Everything up to date.'
            toast.success(`Sync successful! ${detail}`, { id: syncToast })
          } else if (syncToast) {
            toast.dismiss(syncToast)
          }
          notifyCanonicalContentPersisted()
          return true
        } catch (error) {
          const message = error.message || 'Unknown synchronization error'
          set({ lastSyncError: message })
          if (syncToast) toast.error(`Sync failed: ${message}`, { id: syncToast })
          return false
        } finally {
          set({ isSyncing: false })
        }
        })
      )
  }
}
