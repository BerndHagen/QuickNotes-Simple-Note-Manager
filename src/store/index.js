import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { generateId, repairMojibake } from '../lib/utils'
import { filterNotes } from '../lib/filterNotes'
import {
  addToSyncQueue,
  adoptLegacyWorkspaceRecords,
  db,
  deleteWorkspaceData,
  getPendingSyncItems,
  getWorkspaceCache,
  getWorkspaceSnapshot,
  removeSyncItem,
  replaceWorkspaceCache,
  saveNoteOffline,
  saveWorkspaceSnapshot,
  setActiveWorkspaceOwner,
  SyncStatus,
} from '../lib/db'
import { backend, isBackendConfigured } from '../lib/backend'
import { endLocalSession } from '../lib/localSession'
import {
  limitNoteTitle,
  MAX_NOTE_TITLE_LENGTH,
  normalizeTagName,
  validateFolderName,
} from '../lib/dataValidation'
import {
  buildFolderIdRemap,
  buildOperationIndex,
  isRemoteNewer,
  remapNoteFolder,
  shouldUploadPendingRecord,
} from '../lib/syncReconciliation'
import { prepareWorkspaceImport } from '../lib/workspaceBackup'
import toast from 'react-hot-toast'
const WELCOME_TITLE = 'Welcome to QuickNotes'

const emptyWorkspace = () => ({
  notes: [],
  folders: [],
  tags: [],
  selectedNoteId: null,
  selectedFolderId: null,
  selectedTagFilter: null,
  searchQuery: '',
  lastSyncTime: null,
  isNewUser: false,
})

const selectWorkspaceSnapshot = (state) => ({
  notes: state.notes,
  folders: state.folders,
  tags: state.tags,
  selectedNoteId: state.selectedNoteId,
  selectedFolderId: state.selectedFolderId,
  selectedTagFilter: state.selectedTagFilter,
  searchQuery: state.searchQuery,
  lastSyncTime: state.lastSyncTime,
  isNewUser: state.isNewUser,
})

const normalizeWorkspaceSnapshot = (snapshot) => {
  const validRecords = (records) =>
    Array.isArray(records)
      ? records.filter((record) => record && typeof record.id === 'string')
      : []
  const workspace = {
    notes: validRecords(snapshot?.notes),
    folders: validRecords(snapshot?.folders),
    tags: validRecords(snapshot?.tags),
    selectedNoteId: snapshot?.selectedNoteId || null,
    selectedFolderId: snapshot?.selectedFolderId || null,
    selectedTagFilter: snapshot?.selectedTagFilter || null,
    searchQuery: typeof snapshot?.searchQuery === 'string' ? snapshot.searchQuery : '',
    lastSyncTime: snapshot?.lastSyncTime || null,
    isNewUser: Boolean(snapshot?.isNewUser),
  }
  const noteIds = new Set(workspace.notes.map((note) => note.id))
  const folderIds = new Set(workspace.folders.map((folder) => folder.id))
  const tagNames = new Set(workspace.tags.map((tag) => tag.name))

  if (!noteIds.has(workspace.selectedNoteId)) workspace.selectedNoteId = null
  if (!folderIds.has(workspace.selectedFolderId)) workspace.selectedFolderId = null
  if (!tagNames.has(workspace.selectedTagFilter)) workspace.selectedTagFilter = null
  return workspace
}

const workspaceWrites = new Map()
let workspaceTransitionChain = Promise.resolve()
let deferredPersistenceFailure = null
let reportPersistenceFailure = (error, source) => {
  deferredPersistenceFailure = { error, source }
}
let localStorageFailureReported = false

const queueWorkspaceSnapshot = (ownerId, workspace) => {
  if (!ownerId) return Promise.resolve(null)

  const writeState = workspaceWrites.get(ownerId) || {
    latestWorkspace: null,
    promise: null,
  }
  writeState.latestWorkspace = workspace
  workspaceWrites.set(ownerId, writeState)

  if (writeState.promise) return writeState.promise

  writeState.promise = (async () => {
    let savedSnapshot = null
    while (writeState.latestWorkspace) {
      const nextWorkspace = writeState.latestWorkspace
      writeState.latestWorkspace = null
      savedSnapshot = await saveWorkspaceSnapshot(ownerId, nextWorkspace)
    }
    return savedSnapshot
  })()
    .catch((error) => {
      reportPersistenceFailure(error, 'indexeddb')
      throw error
    })
    .finally(() => {
      writeState.promise = null
    })
  return writeState.promise
}

const waitForWorkspaceWrites = async (ownerId) => {
  const pendingWrite = workspaceWrites.get(ownerId)?.promise
  if (!pendingWrite) return
  await pendingWrite.catch(() => undefined)
}

const runWorkspaceTransition = (transition) => {
  const nextTransition = workspaceTransitionChain
    .catch(() => undefined)
    .then(transition)
  workspaceTransitionChain = nextTransition
  return nextTransition
}

const safePersistStorage = createJSONStorage(() => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch (error) {
      reportPersistenceFailure(error, 'localstorage')
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (error) {
      if (!localStorageFailureReported) {
        localStorageFailureReported = true
        queueMicrotask(() => reportPersistenceFailure(error, 'localstorage'))
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch (error) {
      reportPersistenceFailure(error, 'localstorage')
    }
  },
}))

const hasWorkspaceContent = (workspace) =>
  workspace.notes.length > 0 || workspace.folders.length > 0 || workspace.tags.length > 0

const persistCurrentWorkspace = async (get) => {
  const state = get()
  if (!state.cacheOwnerId) return true

  try {
    await queueWorkspaceSnapshot(state.cacheOwnerId, selectWorkspaceSnapshot(state))
    return true
  } catch {
    return false
  }
}

const activateWorkspace = async (set, get, user, ownerId, { adoptUnowned = false } = {}) => {
  if (!ownerId) throw new Error('A workspace owner is required')

  const current = get()
  if (
    current.cacheOwnerId === ownerId &&
    current.hydratedWorkspaceOwnerId === ownerId
  ) {
    setActiveWorkspaceOwner(ownerId)
    set({ user })
    return true
  }

  try {
    if (current.cacheOwnerId && current.cacheOwnerId !== ownerId) {
      if (current.hydratedWorkspaceOwnerId === current.cacheOwnerId) {
        const saved = await persistCurrentWorkspace(get)
        if (!saved) return false
      } else {
        const existingCurrentSnapshot = await getWorkspaceSnapshot(current.cacheOwnerId)
        if (!existingCurrentSnapshot) {
          const currentWorkspace = normalizeWorkspaceSnapshot(
            selectWorkspaceSnapshot(current)
          )
          const recoverableWorkspace = hasWorkspaceContent(currentWorkspace)
            ? currentWorkspace
            : normalizeWorkspaceSnapshot(await getWorkspaceCache())
          if (hasWorkspaceContent(recoverableWorkspace)) {
            await queueWorkspaceSnapshot(current.cacheOwnerId, recoverableWorkspace)
          }
        }
      }
    }

    await waitForWorkspaceWrites(ownerId)
    const storedSnapshot = await getWorkspaceSnapshot(ownerId)
    const mayAdoptCurrent =
      current.cacheOwnerId === ownerId || (!current.cacheOwnerId && adoptUnowned)
    let workspace = storedSnapshot

    if (!workspace && mayAdoptCurrent) {
      const currentWorkspace = normalizeWorkspaceSnapshot(selectWorkspaceSnapshot(current))
      workspace = hasWorkspaceContent(currentWorkspace)
        ? currentWorkspace
        : normalizeWorkspaceSnapshot(await getWorkspaceCache())
    }

    workspace = normalizeWorkspaceSnapshot(workspace)
    if (mayAdoptCurrent) await adoptLegacyWorkspaceRecords(ownerId)

    setActiveWorkspaceOwner(ownerId)
    await replaceWorkspaceCache(workspace)
    set({
      ...workspace,
      user,
      cacheOwnerId: ownerId,
      hydratedWorkspaceOwnerId: ownerId,
      sharedNotes: [],
      pendingShares: [],
    })
    await queueWorkspaceSnapshot(ownerId, workspace)
    return true
  } catch (error) {
    reportPersistenceFailure(error, 'indexeddb')
    return false
  }
}

const createStarterContent = () => {
  const welcomeNote = {
    id: generateId(),
    title: WELCOME_TITLE,
    content: `<p>This note is yours to edit or delete. It covers the parts of QuickNotes that are not obvious from looking at the screen.</p>

<h2>Finding your way around</h2>
<p>Three panes, left to right: the <strong>rail</strong> for navigation, the <strong>list</strong> of notes in the current view, and the <strong>editor</strong>. Below 1024px the rail becomes a drawer and the list and editor take turns, so the same workspace works on a phone.</p>
<p>Everything saves as you type. The indicator in the sidebar footer tells you where your notes currently live \u2014 on this device only, or synced to your account.</p>

<h2>Folders and tags do different jobs</h2>
<ul>
  <li><strong>A folder is where a note lives.</strong> One note, one folder. Good for separating contexts that never mix, like Work and Personal.</li>
  <li><strong>A tag is something a note is about.</strong> A note can carry several. Good for threads that cut across folders, like <em>#important</em> or a project name.</li>
</ul>
<p>If you are unsure which to use, start with tags. They are easier to change your mind about later.</p>

<h2>Beyond plain documents</h2>
<p>Under <strong>Note types</strong> in the rail there are structured workspaces, each with its own fields rather than a blank page: a task list with priorities and due dates, a project board with columns and milestones, a meeting workspace for agenda, decisions and action items, a daily journal, an idea board, a shopping list, and a weekly planner.</p>
<p>They behave like ordinary notes \u2014 searchable, taggable, exportable \u2014 so it is worth trying one before writing a plan by hand.</p>

<h2>Shortcuts worth remembering</h2>
<ul>
  <li><strong>Ctrl+N</strong> \u2014 quick note, from anywhere, without leaving what you are doing</li>
  <li><strong>Ctrl+K</strong> \u2014 search every note by title, body and tag</li>
  <li><strong>Ctrl+F</strong> \u2014 find and replace inside the note you are editing</li>
  <li><strong>Ctrl+T</strong> \u2014 choose a note type</li>
  <li><strong>Ctrl+Shift+F</strong> \u2014 focus mode, just the text</li>
  <li><strong>Ctrl+/</strong> \u2014 the full list, where you can rebind any of them</li>
</ul>

<h2>A few things that are easy to miss</h2>
<ul>
  <li>Deleted notes rest in <strong>Trash</strong> for 30 days before they are removed for good.</li>
  <li>Every note keeps its last 30 versions. Open <strong>Version history</strong> from the editor menu to read or restore one.</li>
  <li><strong>Archive</strong> is for notes you have finished with but do not want to lose \u2014 they leave the main list without being deleted.</li>
  <li>Notes can link to each other. Press <strong>Ctrl+Shift+K</strong> while writing to insert a link, and the target note will show what points at it.</li>
  <li>Export a single note as Markdown, HTML, plain text, JSON or PDF; import Markdown, text and HTML files back in.</li>
</ul>

<h2>Your first few minutes</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Write one real note \u2014 anything you would otherwise leave in a browser tab</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Rename the starter folders, or delete the ones you will not use</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Create a task list from Note types and add three things you owe someone</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Press Ctrl+K and search for a word you just typed</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Decide whether this note stays or goes</p></div></li>
</ul>`,
    folderId: null,
    tags: ['welcome', 'getting-started'],
    starred: true,
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: SyncStatus.PENDING,
  }

  const starterFolders = [
    {
      id: generateId(),
      name: 'Work',
      icon: 'Briefcase',
      color: '#3b82f6',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: SyncStatus.PENDING,
    },
    {
      id: generateId(),
      name: 'Personal',
      icon: 'Home',
      color: '#22c55e',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: SyncStatus.PENDING,
    },
    {
      id: generateId(),
      name: 'Ideas',
      icon: 'Lightbulb',
      color: '#f59e0b',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: SyncStatus.PENDING,
    },
  ]

  const tagCreatedAt = new Date().toISOString()
  const starterTags = [
    { id: generateId(), name: 'welcome', color: '#3b82f6' },
    { id: generateId(), name: 'getting-started', color: '#22c55e' },
    { id: generateId(), name: 'work', color: '#ef4444' },
    { id: generateId(), name: 'important', color: '#f97316' },
    { id: generateId(), name: 'ideas', color: '#8b5cf6' },
    { id: generateId(), name: 'todo', color: '#06b6d4' },
    { id: generateId(), name: 'personal', color: '#ec4899' },
  ].map((tag) => ({
    ...tag,
    createdAt: tagCreatedAt,
    updatedAt: tagCreatedAt,
    syncStatus: SyncStatus.PENDING,
  }))

  return { welcomeNote, starterFolders, starterTags }
}

export const useNotesStore = create(
  persist(
    (set, get) => ({
      notes: [],
      folders: [],
      tags: [],
      selectedNoteId: null,
      selectedFolderId: null,
      selectedTagFilter: null,
      searchQuery: '',
      isEditing: false,
      isSyncing: false,
      lastSyncTime: null,
      lastSyncError: null,
      isOnline: navigator.onLine,
      user: null,
      isAuthChecked: false,
      sharedNotes: [],
      pendingShares: [],
      cacheOwnerId: null,
      hydratedWorkspaceOwnerId: null,
      persistenceError: null,
      isNewUser: false,
      /** Transient realtime signal — deliberately not persisted. */
      externalUpdate: { noteId: null, token: 0 },

      initializeStarterContent: () => {
        const { welcomeNote, starterFolders, starterTags } = createStarterContent()
        
        set({
          notes: [welcomeNote],
          folders: starterFolders,
          tags: starterTags,
          selectedNoteId: welcomeNote.id,
          isNewUser: true,
        })

        saveNoteOffline(welcomeNote)
        addToSyncQueue('notes', 'insert', welcomeNote)
        
        starterFolders.forEach(folder => {
          db.folders.put(folder)
          addToSyncQueue('folders', 'insert', folder)
        })
        
        starterTags.forEach(tag => {
          db.tags.put(tag)
          addToSyncQueue('tags', 'insert', tag)
        })
      },


      createNote: (note = {}) => {
        const hasExplicitFolder = Object.prototype.hasOwnProperty.call(note, 'folderId')
        const newNote = {
          id: generateId(),
          title: limitNoteTitle(note.title),
          content: note.content || '',
          folderId: hasExplicitFolder ? note.folderId : get().selectedFolderId,
          tags: note.tags || [],
          starred: false,
          pinned: false,
          noteType: note.noteType || 'standard',
          noteData: note.noteData || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          notes: [newNote, ...state.notes],
          selectedNoteId: newNote.id,
          isEditing: true,
        }))

        saveNoteOffline(newNote)
        addToSyncQueue('notes', 'insert', newNote)

        return newNote
      },

      importWorkspaceBackup: async (backup) => runWorkspaceTransition(async () => {
        const current = get()
        if (!current.cacheOwnerId || current.hydratedWorkspaceOwnerId !== current.cacheOwnerId) {
          throw new Error('Open a workspace before importing a backup.')
        }

        const imported = prepareWorkspaceImport(backup, current, { createId: generateId })
        const workspace = {
          ...selectWorkspaceSnapshot(current),
          notes: [...imported.notes, ...current.notes],
          folders: [...current.folders, ...imported.folders],
          tags: [...current.tags, ...imported.tags],
          selectedNoteId: imported.notes[0]?.id || current.selectedNoteId,
        }
        const queueEntries = [
          ...imported.notes.map((data) => ({ table: 'notes', operation: 'insert', data })),
          ...imported.folders.map((data) => ({ table: 'folders', operation: 'insert', data })),
          ...imported.tags.map((data) => ({ table: 'tags', operation: 'insert', data })),
        ].map((entry) => ({
          ...entry,
          ownerId: current.cacheOwnerId,
          timestamp: new Date().toISOString(),
        }))

        try {
          await db.transaction(
            'rw',
            db.notes,
            db.folders,
            db.tags,
            db.syncQueue,
            db.workspaceSnapshots,
            async () => {
              if (imported.notes.length > 0) await db.notes.bulkPut(imported.notes)
              if (imported.folders.length > 0) await db.folders.bulkPut(imported.folders)
              if (imported.tags.length > 0) await db.tags.bulkPut(imported.tags)
              if (queueEntries.length > 0) await db.syncQueue.bulkAdd(queueEntries)
              await db.workspaceSnapshots.put({
                ...workspace,
                ownerId: current.cacheOwnerId,
                updatedAt: new Date().toISOString(),
              })
            }
          )
        } catch (error) {
          reportPersistenceFailure(error, 'indexeddb')
          throw new Error('The backup could not be saved to this browser.', { cause: error })
        }

        set(workspace)
        return {
          notes: imported.notes.length,
          folders: imported.folders.length,
          tags: imported.tags.length,
        }
      }),

      /**
       * Persist an in-progress editor draft in Zustand's synchronous local
       * cache. The regular debounced update still performs IndexedDB/cloud
       * queue work, but a reload cannot discard the most recent keystrokes.
       */
      updateNoteDraft: (id, updates) => {
        const updatedAt = new Date().toISOString()
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  ...updates,
                  updatedAt,
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          sharedNotes: state.sharedNotes.map((share) =>
            share.notes?.id === id
              ? { ...share, notes: { ...share.notes, ...updates } }
              : share
          ),
        }))
      },

      updateNote: async (id, updates) => {
        const { sharedNotes } = get()
        const normalizedUpdates =
          Object.prototype.hasOwnProperty.call(updates, 'title')
            ? { ...updates, title: limitNoteTitle(updates.title, '') }
            : updates
        
        const sharedNote = sharedNotes.find((share) => share.notes?.id === id)
        
        if (sharedNote) {
          if (sharedNote.permission !== 'edit') {
            throw new Error('You do not have permission to edit this shared note')
          }
          
          const { updateSharedNote } = await import('../lib/backend')
          await updateSharedNote(id, normalizedUpdates)
          
          set((state) => ({
            sharedNotes: state.sharedNotes.map((share) =>
              share.notes?.id === id
                ? { ...share, notes: { ...share.notes, ...normalizedUpdates, updatedAt: new Date().toISOString() } }
                : share
            ),
          }))
          
          return
        }
        
        const updatedNote = {
          ...normalizedUpdates,
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...updatedNote } : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, ...updatedNote })
          addToSyncQueue('notes', 'update', { id, ...updatedNote })
        }
      },

      deleteNote: (id) => {
        const currentNote = get().notes.find((note) => note.id === id)
        if (!currentNote || currentNote.deleted) return
        const deletedAt = new Date().toISOString()

        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  deleted: true,
                  deletedAt,
                  updatedAt: deletedAt,
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          selectedNoteId:
            state.selectedNoteId === id
              ? state.notes.find((n) => n.id !== id && !n.deleted)?.id || null
              : state.selectedNoteId,
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id, deleted: true, deletedAt, updatedAt: deletedAt })

          if (isBackendConfigured()) {
            const { user } = get()
            if (user) {
              backend.from('notes').update({ deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', id).eq('user_id', user.id).then(() => {})
            }
          }
        }
      },

      restoreNote: (id) => {
        const currentNote = get().notes.find((note) => note.id === id)
        if (!currentNote || !currentNote.deleted) return
        const restoredAt = new Date().toISOString()

        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  deleted: false,
                  deletedAt: null,
                  updatedAt: restoredAt,
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id, deleted: false, deletedAt: null, updatedAt: restoredAt })

          if (isBackendConfigured()) {
            const { user } = get()
            if (user) {
              backend.from('notes').update({ deleted: false, deleted_at: null, updated_at: new Date().toISOString() })
                .eq('id', id).eq('user_id', user.id).then(() => {})
            }
          }
        }
      },

      permanentlyDeleteNote: (id) => {
        if (!get().notes.some((note) => note.id === id)) return
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          selectedNoteId:
            state.selectedNoteId === id
              ? state.notes.find((n) => n.id !== id && !n.deleted)?.id || null
              : state.selectedNoteId,
        }))

        db.notes.delete(id)
        addToSyncQueue('notes', 'delete', { id })

        if (isBackendConfigured()) {
          const { user } = get()
          if (user) {
            backend.from('notes').delete().eq('id', id).eq('user_id', user.id)
              .then(() => {})
          }
        }
      },

      /**
       * Auto-delete notes that have been in trash for more than 30 days.
       */
      cleanupExpiredTrash: () => {
        const retentionDays = useUIStore.getState().trashRetentionDays ?? 30
        const RETENTION_MS = retentionDays * 24 * 60 * 60 * 1000
        const now = Date.now()
        const { notes, user } = get()
        
        const expired = notes.filter(note => 
          note.deleted && note.deletedAt && 
          (now - new Date(note.deletedAt).getTime()) > RETENTION_MS
        )
        
        if (expired.length > 0) {
          for (const note of expired) {
            db.notes.delete(note.id)
            addToSyncQueue('notes', 'delete', { id: note.id })

            if (isBackendConfigured() && user) {
              backend.from('notes').delete().eq('id', note.id).eq('user_id', user.id)
                .then(() => {})
            }
          }
          
          set((state) => ({
            notes: state.notes.filter(note => 
              !(note.deleted && note.deletedAt && 
                (now - new Date(note.deletedAt).getTime()) > RETENTION_MS)
            ),
          }))
        }
      },

      toggleStar: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  starred: !note.starred,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id, starred: note.starred })
        }
      },

      togglePin: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  pinned: !note.pinned,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id, pinned: note.pinned })
        }
      },

      reorderNotes: (orderedIds) => {
        set((state) => {
          const now = new Date().toISOString()
          const updatedNotes = state.notes.map(note => {
            const newOrder = orderedIds.indexOf(note.id)
            if (newOrder !== -1 && note.order !== newOrder) {
              const updatedNote = {
                ...note,
                order: newOrder,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING,
              }
              saveNoteOffline(updatedNote)
              addToSyncQueue('notes', 'update', { id: note.id, order: newOrder })
              return updatedNote
            }
            return note
          })
          
          return { notes: updatedNotes }
        })
      },

      archiveNote: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  archived: true,
                  archivedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          selectedNoteId:
            state.selectedNoteId === id
              ? state.notes.find((n) => n.id !== id && !n.deleted && !n.archived)?.id || null
              : state.selectedNoteId,
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, archived: true, archivedAt: new Date().toISOString() })
          addToSyncQueue('notes', 'update', { id, archived: true })
        }
      },

      unarchiveNote: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  archived: false,
                  archivedAt: null,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, archived: false, archivedAt: null })
          addToSyncQueue('notes', 'update', { id, archived: false })
        }
      },

      duplicateNote: (id) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) return
        const copySuffix = ' (Copy)'

        const duplicate = {
          ...note,
          id: generateId(),
          title: limitNoteTitle(
            `${note.title.slice(0, MAX_NOTE_TITLE_LENGTH - copySuffix.length)}${copySuffix}`
          ),
          starred: false,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          notes: [duplicate, ...state.notes],
          selectedNoteId: duplicate.id,
        }))

        saveNoteOffline(duplicate)
        addToSyncQueue('notes', 'insert', duplicate)
      },

      moveNote: (noteId, folderId) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  folderId,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === noteId)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id: noteId, folderId })
        }
      },

      createFolder: (folder = {}) => {
        const name = validateFolderName(folder.name || 'New Folder', get().folders)
        const newFolder = {
          id: generateId(),
          name,
          icon: folder.icon || 'Folder',
          color: folder.color || '#6b7280',
          parentId: folder.parentId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          folders: [...state.folders, newFolder],
        }))

        db.folders.put(newFolder)
        addToSyncQueue('folders', 'insert', newFolder)

        return newFolder
      },

      updateFolder: (id, updates) => {
        const normalizedUpdates =
          Object.prototype.hasOwnProperty.call(updates, 'name')
            ? { ...updates, name: validateFolderName(updates.name, get().folders, id) }
            : updates
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === id
              ? {
                  ...folder,
                  ...normalizedUpdates,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : folder
          ),
        }))

        const folder = get().folders.find((f) => f.id === id)
        if (folder) {
          db.folders.put(folder)
          addToSyncQueue('folders', 'update', { id, ...normalizedUpdates })
        }
      },

      deleteFolder: (id) => {
        const folder = get().folders.find((candidate) => candidate.id === id)
        if (!folder) return

        const affectedNotes = get().notes.filter((note) => note.folderId === id)
        const affectedChildren = get().folders.filter((candidate) => candidate.parentId === id)
        const now = new Date().toISOString()
        
        set((state) => ({
          notes: state.notes.map((note) =>
            note.folderId === id
              ? {
                  ...note,
                  folderId: null,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          folders: state.folders
            .filter((candidate) => candidate.id !== id)
            .map((candidate) =>
              candidate.parentId === id
                ? {
                    ...candidate,
                    parentId: folder.parentId || null,
                    updatedAt: now,
                    syncStatus: SyncStatus.PENDING,
                  }
                : candidate
            ),
          selectedFolderId:
            state.selectedFolderId === id ? null : state.selectedFolderId,
        }))

        for (const note of affectedNotes) {
          const updated = { ...note, folderId: null, updatedAt: now, syncStatus: SyncStatus.PENDING }
          saveNoteOffline(updated)
          addToSyncQueue('notes', 'update', { id: note.id, folderId: null, updatedAt: now })
        }

        for (const child of affectedChildren) {
          const updated = {
            ...child,
            parentId: folder.parentId || null,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING,
          }
          db.folders.put(updated)
          addToSyncQueue('folders', 'update', {
            id: child.id,
            parentId: updated.parentId,
            updatedAt: now,
          })
        }

        db.folders.delete(id)
        addToSyncQueue('folders', 'delete', { id })
      },

      createTag: (tag) => {
        const normalizedName = normalizeTagName(tag.name)

        const existingTag = get().tags.find(
          (existing) => existing.name.toLowerCase() === normalizedName
        )
        if (existingTag) return existingTag

        const newTag = {
          id: generateId(),
          name: normalizedName,
          color: tag.color || '#6b7280',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          tags: [...state.tags, newTag],
        }))

        db.tags.put(newTag)
        addToSyncQueue('tags', 'insert', newTag)

        return newTag
      },

      updateTag: (id, updates) => {
        const oldTag = get().tags.find((t) => t.id === id)
        if (!oldTag) return

        const normalizedUpdates = { ...updates }
        if (typeof normalizedUpdates.name === 'string') {
          normalizedUpdates.name = normalizeTagName(normalizedUpdates.name)
          const duplicate = get().tags.some(
            (tag) =>
              tag.id !== id &&
              tag.name.toLowerCase() === normalizedUpdates.name.toLowerCase()
          )
          if (duplicate) throw new Error('A tag with this name already exists')
        }

        const updatedTag = { ...oldTag, ...normalizedUpdates, updatedAt: new Date().toISOString(), syncStatus: SyncStatus.PENDING }

        set((state) => ({
          tags: state.tags.map((tag) =>
            tag.id === id ? updatedTag : tag
          ),
        }))

        if (normalizedUpdates.name && normalizedUpdates.name !== oldTag.name) {
          const now = new Date().toISOString()
          set((state) => ({
            notes: state.notes.map((note) =>
              note.tags?.includes(oldTag.name)
                ? {
                    ...note,
                    tags: note.tags.map((tagName) =>
                      tagName === oldTag.name ? normalizedUpdates.name : tagName
                    ),
                    updatedAt: now,
                    syncStatus: SyncStatus.PENDING,
                  }
                : note
            ),
            selectedTagFilter:
              state.selectedTagFilter === oldTag.name ? normalizedUpdates.name : state.selectedTagFilter,
          }))

          const affectedNotes = get().notes.filter(n => n.tags?.includes(normalizedUpdates.name))
          for (const note of affectedNotes) {
            saveNoteOffline(note)
            addToSyncQueue('notes', 'update', { id: note.id, tags: note.tags })
          }
        }

        db.tags.put(updatedTag)
        const { syncStatus: _s, ...tagDataForSync } = updatedTag
        addToSyncQueue('tags', 'update', tagDataForSync)
      },

      deleteTag: (id) => {
        const tag = get().tags.find((t) => t.id === id)
        if (!tag) return

        const affectedNoteIds = get().notes
          .filter(n => n.tags?.includes(tag.name))
          .map(n => n.id)

        const now = new Date().toISOString()
        set((state) => ({
          notes: state.notes.map((note) =>
            note.tags?.includes(tag.name)
              ? {
                  ...note,
                  tags: note.tags.filter((tagName) => tagName !== tag.name),
                  updatedAt: now,
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          tags: state.tags.filter((t) => t.id !== id),
          selectedTagFilter:
            state.selectedTagFilter === tag.name ? null : state.selectedTagFilter,
        }))
        
        for (const noteId of affectedNoteIds) {
          const note = get().notes.find(n => n.id === noteId)
          if (note) {
            saveNoteOffline(note)
            addToSyncQueue('notes', 'update', { id: noteId, tags: note.tags })
          }
        }

        db.tags.delete(id)
        addToSyncQueue('tags', 'delete', { id })
      },

      addTagToNote: (noteId, tagName) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  tags: [...new Set([...(note.tags || []), tagName])],
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === noteId)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id: noteId, tags: note.tags })
        }
      },

      removeTagFromNote: (noteId, tagName) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  tags: (note.tags || []).filter((t) => t !== tagName),
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === noteId)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id: noteId, tags: note.tags })
        }
      },
      setSelectedNote: (id) => set({ selectedNoteId: id }),
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSelectedFolder: (id) => set({ selectedFolderId: id, selectedTagFilter: null }),
      setSelectedTagFilter: (tag) => set({ selectedTagFilter: tag, selectedFolderId: null }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setIsEditing: (editing) => set({ isEditing: editing }),
      setIsOnline: (online) => set({ isOnline: online }),
      setUser: (user) =>
        set({
          user,
          ...(user?.isLocal ? { cacheOwnerId: 'local' } : {}),
        }),
      activateCloudUser: async (user, options = {}) => {
        if (!user?.id) throw new Error('A valid cloud user is required')
        return runWorkspaceTransition(
          () => activateWorkspace(set, get, user, user.id, options)
        )
      },
      activateLocalUser: async (user) => {
        if (!user?.isLocal) throw new Error('A valid local user is required')
        return runWorkspaceTransition(
          () => activateWorkspace(set, get, user, 'local', { adoptUnowned: true })
        )
      },
      persistWorkspace: async () => persistCurrentWorkspace(get),
      deactivateWorkspace: async ({ persistWorkspace = true } = {}) => {
        return runWorkspaceTransition(async () => {
          if (persistWorkspace) {
            const saved = await persistCurrentWorkspace(get)
            if (!saved) return false
          }

          setActiveWorkspaceOwner(null)
          await replaceWorkspaceCache(emptyWorkspace())
          set({
            ...emptyWorkspace(),
            user: null,
            cacheOwnerId: null,
            hydratedWorkspaceOwnerId: null,
            sharedNotes: [],
            pendingShares: [],
            isSyncing: false,
          })
          return true
        })
      },
      deleteWorkspace: async (ownerId = get().cacheOwnerId, { deactivate = false } = {}) => {
        if (!ownerId) return false

        return runWorkspaceTransition(async () => {
          await waitForWorkspaceWrites(ownerId)
          await deleteWorkspaceData(ownerId)
          workspaceWrites.delete(ownerId)
          if (get().cacheOwnerId === ownerId) {
            const nextOwnerId = deactivate ? null : ownerId
            setActiveWorkspaceOwner(nextOwnerId)
            set({
              ...emptyWorkspace(),
              ...(deactivate ? { user: null } : {}),
              cacheOwnerId: nextOwnerId,
              hydratedWorkspaceOwnerId: nextOwnerId,
              sharedNotes: [],
              pendingShares: [],
              isSyncing: false,
            })
            if (!deactivate) {
              await queueWorkspaceSnapshot(ownerId, emptyWorkspace())
            }
          }
          return true
        })
      },
      clearPersistenceError: () => {
        localStorageFailureReported = false
        set({ persistenceError: null })
      },
      setIsAuthChecked: (checked) => set({ isAuthChecked: checked }),
      
      logout: async () => {
        // Leaving a local workspace ends the local session and keeps the notes
        // on the device. There is no cloud state to tear down, and the cloud
        // path below would sign out a session this user never had.
        if (!isBackendConfigured() || get().user?.isLocal) {
          const saved = await persistCurrentWorkspace(get)
          if (!saved) {
            toast.error('Your notes could not be saved. Sign-out was cancelled.')
            return false
          }
          endLocalSession()
          set({
            user: null,
            selectedFolderId: null,
            selectedTagFilter: null,
            searchQuery: '',
            sharedNotes: [],
            pendingShares: [],
            isSyncing: false,
            cacheOwnerId: 'local',
          })
          return true
        }

        const hasPendingState = () => {
          const { notes, folders, tags } = get()
          return [...notes, ...folders, ...tags].some(
            (record) => record.syncStatus === SyncStatus.PENDING
          )
        }

        const pendingBeforeLogout = await getPendingSyncItems()
        if (pendingBeforeLogout.length > 0 || hasPendingState()) {
          if (!navigator.onLine) {
            toast.error('Reconnect and sync your changes before signing out')
            return false
          }

          const syncSucceeded = await get().syncWithBackend()
          const pendingAfterSync = await getPendingSyncItems()
          if (!syncSucceeded || pendingAfterSync.length > 0 || hasPendingState()) {
            toast.error('Your changes are not fully synced. Sign-out was cancelled.')
            return false
          }
        }

        const workspaceSaved = await persistCurrentWorkspace(get)
        if (!workspaceSaved) {
          toast.error('Your notes could not be saved. Sign-out was cancelled.')
          return false
        }

        let signOutError = null
        try {
          const result = await backend.auth.signOut()
          signOutError = result.error
        } catch (error) {
          signOutError = error
        }

        if (signOutError) {
          toast.error(`Could not sign out: ${signOutError.message || 'Unknown error'}`)
          return false
        }

        localStorage.removeItem('quicknotes-remember')
        return get().deactivateWorkspace({ persistWorkspace: false })
      },

      setSyncing: (syncing) => set({ isSyncing: syncing }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      syncWithBackend: async () => runWorkspaceTransition(async () => {
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

        const showNotifications = useUIStore.getState().showSyncNotifications
        const syncToast = showNotifications ? toast.loading('Synchronizing...') : null

        try {
          const pendingSyncItems = await getPendingSyncItems()
          const folderOperations = buildOperationIndex(pendingSyncItems, 'folders')
          const tagOperations = buildOperationIndex(pendingSyncItems, 'tags')
          const noteOperations = buildOperationIndex(pendingSyncItems, 'notes')
          let conflictCount = 0
          
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
            await removeSyncItem(item.id)
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
            await removeSyncItem(item.id)
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
              if (
                folderIdRemap.has(folder.id) ||
                !shouldUploadPendingRecord(
                  folder,
                  initialRemoteFolderIds,
                  folderOperations,
                  SyncStatus.PENDING
                )
              ) {
                return false
              }

              const remoteFolder = initialRemoteFoldersById.get(folder.id)
              if (remoteFolder && isRemoteNewer(folder.updatedAt, remoteFolder.updated_at)) {
                conflictCount++
                return false
              }
              return true
            }
          )
          
          for (const folder of foldersToUpload) {
            const folderData = {
              id: folder.id,
              user_id: user.id,
              name: folder.name,
              icon: folder.icon || 'Folder',
              color: folder.color || '#10b981',
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
              color: folder.color || '#10b981',
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

              if (changedDuringSync) {
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
          const tagsToUpload = localTags.filter(tag => {
            if (!shouldUploadPendingRecord(
              tag,
              remoteTagIds,
              tagOperations,
              SyncStatus.PENDING
            )) return false
            return remoteTagIds.has(tag.id) || !remoteTagNames.has(tag.name.toLowerCase())
          })
          
          for (const tag of tagsToUpload) {
            const tagData = {
              id: tag.id,
              user_id: user.id,
              name: tag.name,
              color: tag.color || '#3b82f6',
              created_at: tag.createdAt || new Date().toISOString(),
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
            syncStatus: SyncStatus.SYNCED,
          }))
          const canonicalTagIds = new Set(canonicalTags.map((tag) => tag.id))
          const staleTagIds = localTags
            .filter((tag) => !canonicalTagIds.has(tag.id))
            .map((tag) => tag.id)
          set({ tags: canonicalTags })
          await db.transaction('rw', db.tags, async () => {
            if (staleTagIds.length > 0) await db.tags.bulkDelete(staleTagIds)
            if (canonicalTags.length > 0) await db.tags.bulkPut(canonicalTags)
          })

          const toSnakeCase = (note) => {
            // Merge reminders array into note_data JSONB for Supabase persistence
            const baseNoteData = note.noteData || {}
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
            const rawNoteData = note.note_data || {}
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
            await removeSyncItem(item.id)
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
          const discardedRemoteDeletionIds = new Set()
          const pendingNotes = get().notes.filter(
            (note) => note.syncStatus === SyncStatus.PENDING
          )

          let syncedCount = 0
          let errorCount = 0
          for (const note of pendingNotes) {
            if (!shouldUploadPendingRecord(
              note,
              initialRemoteNoteIds,
              noteOperations,
              SyncStatus.PENDING
            )) {
              discardedRemoteDeletionIds.add(note.id)
              continue
            }

            const remoteNote = initialRemoteById.get(note.id)
            if (remoteNote && isRemoteNewer(note.updatedAt, remoteNote.updated_at)) {
              const remoteData = toCamelCase(remoteNote)
              if (note.order !== undefined && note.order !== null && remoteData.order === null) {
                remoteData.order = note.order
              }
              set((state) => ({
                notes: state.notes.map((current) =>
                  current.id === note.id && current.updatedAt === note.updatedAt
                    ? remoteData
                    : current
                ),
              }))
              await db.notes.put(remoteData)
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
                  current.id === note.id && current.updatedAt === note.updatedAt
                    ? { ...current, syncStatus: SyncStatus.SYNCED }
                    : current
                ),
              }))
            } else {
              errorCount++
            }
          }

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
              if (
                deletedNoteIds.has(localNote.id) ||
                discardedRemoteDeletionIds.has(localNote.id)
              ) {
                continue
              }

              const remoteNote = remoteNotesById.get(localNote.id)
              if (localNote.syncStatus === SyncStatus.PENDING) {
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
          if (removedNoteIds.length > 0) await db.notes.bulkDelete(removedNoteIds)
          if (get().notes.length > 0) await db.notes.bulkPut(get().notes)

          await get().loadSharedNotes()

          if (errorCount > 0) {
            throw new Error(`${errorCount} note${errorCount === 1 ? '' : 's'} could not be uploaded`)
          }

          // Remove only the operation snapshot processed by this run. Writes
          // created while network requests were in flight belong to the next
          // run and must remain queued.
          for (const item of pendingSyncItems) {
            if (item.operation !== 'delete') {
              await removeSyncItem(item.id)
            }
          }

          set({ lastSyncTime: new Date().toISOString(), lastSyncError: null })
          
          const showNotifications = useUIStore.getState().showSyncNotifications
          
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
          return true
        } catch (error) {
          const message = error.message || 'Unknown synchronization error'
          set({ lastSyncError: message })
          toast.error(`Sync failed: ${message}`, syncToast ? { id: syncToast } : undefined)
          return false
        } finally {
          set({ isSyncing: false })
        }
      }),

      /**
       * Delegates to the shared filter so the store, the note list and
       * global search can never disagree about what matches.
       */
      getFilteredNotes: () => {
        const { notes, selectedFolderId, selectedTagFilter, searchQuery } = get()
        const filtered = filterNotes(notes, {
          folderId: selectedFolderId,
          tagFilter: selectedTagFilter,
          query: searchQuery,
        })

        return filtered.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          if (a.starred !== b.starred) return a.starred ? -1 : 1
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        })
      },

      /**
       * Applies a change that originated on the server (realtime
       * collaboration) without marking the note dirty.
       *
       * It deliberately bypasses `updateNote`: stamping a new `updatedAt`
       * and queueing the note for upload would send an inbound edit
       * straight back with a timestamp newer than the server's, so two
       * collaborators would overwrite each other. The "this came from the
       * server" signal lives in transient state, never in the note.
       */
      applyExternalUpdate: (id, patch) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...patch, syncStatus: SyncStatus.SYNCED } : note
          ),
          sharedNotes: state.sharedNotes.map((share) =>
            share.notes?.id === id ? { ...share, notes: { ...share.notes, ...patch } } : share
          ),
          externalUpdate: { noteId: id, token: get().externalUpdate.token + 1 },
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) db.notes.put({ ...note })
      },

      getSelectedNote: () => {
        const { notes, sharedNotes, selectedNoteId } = get()
        let note = notes.find((note) => note.id === selectedNoteId)
        if (!note) {
          const shared = sharedNotes.find((share) => share.notes?.id === selectedNoteId)
          note = shared?.notes
        }
        return note
      },

      shareNote: async (noteId, email, permission = 'edit') => {
        try {
          const { createShareLink } = await import('../lib/backend')
          const share = await createShareLink(noteId, email, permission)

          toast.success(`Note shared with ${email}`)
          return share
        } catch (error) {
          toast.error(`Failed to share: ${error.message || 'Unknown error'}`)
          throw error
        }
      },

      acceptShare: async (shareId) => {
        try {
          const invitation = get().pendingShares.find((share) => share.id === shareId)
          const { acceptShare } = await import('../lib/backend')
          const { share, acceptedShare } = await acceptShare(shareId)
          
          const newSharedNote = {
            id: acceptedShare.id,
            user_id: acceptedShare.user_id,
            note_id: acceptedShare.note_id,
            permission: acceptedShare.permission,
            created_at: acceptedShare.created_at,
            owner_id: share.shared_by || invitation?.owner_id || share.notes?.user_id,
            owner_name: invitation?.owner_name || invitation?.shared_by || '',
            notes: share.notes ? {
              id: share.notes.id,
              title: share.notes.title,
              content: share.notes.content,
              userId: share.notes.user_id,
              createdAt: share.notes.created_at,
              updatedAt: share.notes.updated_at,
              folderId: share.notes.folder_id,
              tags: share.notes.tags || [],
              starred: share.notes.starred || false,
              pinned: share.notes.pinned || false,
              deleted: share.notes.deleted || false,
              archived: share.notes.archived || false,
              noteType: share.notes.note_type || 'standard',
              noteData: share.notes.note_data || null,
              isShared: true,
              sharePermission: acceptedShare.permission || 'view',
            } : null
          }
          
          if (newSharedNote.notes && newSharedNote.notes.id) {
            set((state) => ({
              sharedNotes: [...state.sharedNotes, newSharedNote],
              pendingShares: state.pendingShares.filter(s => s.id !== shareId)
            }))
          } else {
            set((state) => ({
              pendingShares: state.pendingShares.filter(s => s.id !== shareId)
            }))
            await get().loadSharedNotes()
          }
          
          toast.success('Shared note accepted')
          return { share, acceptedShare }
        } catch (error) {
          toast.error(`Failed to accept share: ${error.message || 'Unknown error'}`)
          throw error
        }
      },

      declineShare: async (shareId) => {
        try {
          const { declineShare } = await import('../lib/backend')
          await declineShare(shareId)
          
          set((state) => ({
            pendingShares: state.pendingShares.filter(s => s.id !== shareId)
          }))
          
          toast.success('Share declined')
        } catch (error) {
          toast.error('Failed to decline share')
          throw error
        }
      },

      removeShare: async (shareId) => {
        try {
          const { removeShare } = await import('../lib/backend')
          await removeShare(shareId)
          
          set((state) => ({
            pendingShares: state.pendingShares.filter(s => s.id !== shareId)
          }))
          
          toast.success('Share removed')
        } catch (error) {
          toast.error('Failed to remove share')
          throw error
        }
      },

      leaveSharedNote: async (noteId) => {
        try {
          const { leaveSharedNote } = await import('../lib/backend')
          await leaveSharedNote(noteId)
          
          set((state) => ({
            sharedNotes: state.sharedNotes.filter(s => s.note_id !== noteId)
          }))
          
          toast.success('Left shared note')
        } catch (error) {
          toast.error('Failed to leave shared note')
          throw error
        }
      },

      loadSharedNotes: async () => {
        if (!isBackendConfigured()) return
        const { user } = get()
        if (!user || user.isLocal) return

        try {
          const { getSharedNotes, getPendingShares } = await import('../lib/backend')
          const [shared, pending] = await Promise.all([
            getSharedNotes(user.id),
            getPendingShares(user.id)
          ])
          
          const normalizedShared = (shared || []).map(share => ({
            ...share,
            notes: share.notes ? {
              id: share.notes.id,
              title: share.notes.title,
              content: share.notes.content,
              userId: share.notes.user_id,
              folderId: share.notes.folder_id,
              tags: share.notes.tags || [],
              starred: share.notes.starred || false,
              pinned: share.notes.pinned || false,
              deleted: share.notes.deleted || false,
              archived: share.notes.archived || false,
              noteType: share.notes.note_type || 'standard',
              noteData: share.notes.note_data || null,
              createdAt: share.notes.created_at,
              updatedAt: share.notes.updated_at,
              isShared: true,
              sharePermission: share.permission || 'view',
            } : null
          }))
          
          const normalizedPending = (pending || []).map(share => ({
            ...share,
            notes: share.notes ? {
              id: share.notes.id,
              title: share.notes.title,
              content: share.notes.content,
              userId: share.notes.user_id,
            } : null
          }))
          
          set({
            sharedNotes: normalizedShared,
            pendingShares: normalizedPending,
          })
        } catch (error) {
          toast.error(`Could not load shared notes: ${error.message || 'Unknown error'}`)
        }
      },
    }),
    {
      name: 'quicknotes-storage',
      storage: safePersistStorage,
      partialize: (state) => {
        const metadata = {
          lastSyncTime: state.lastSyncTime,
          cacheOwnerId: state.cacheOwnerId,
        }
        if (state.hydratedWorkspaceOwnerId) return metadata

        return {
          ...metadata,
          notes: state.notes,
          folders: state.folders,
          tags: state.tags,
        }
      },
      onRehydrateStorage: () => (state) => {
        setActiveWorkspaceOwner(state?.cacheOwnerId || null)
        // Repair any mojibake (double-encoded UTF-8) in stored notes
        if (state?.notes?.length) {
          let repaired = false
          const fixedNotes = state.notes.map(note => {
            const fixedTitle = repairMojibake(note.title)
            const fixedContent = repairMojibake(note.content)
            if (fixedTitle !== note.title || fixedContent !== note.content) {
              repaired = true
              return { ...note, title: fixedTitle, content: fixedContent }
            }
            return note
          })
          if (repaired) {
            state.notes = fixedNotes
          }
        }
      },
    }
  )
)

reportPersistenceFailure = (error, source) => {
  const message = source === 'localstorage'
    ? 'QuickNotes could not update its browser cache. Large embedded images can exhaust browser storage.'
    : 'QuickNotes could not save changes on this device. Export important notes before closing the app.'
  const currentError = useNotesStore.getState().persistenceError
  if (currentError?.source === source && currentError?.message === message) return

  useNotesStore.setState({
    persistenceError: {
      source,
      message,
      detail: error?.message || 'Unknown storage error',
      occurredAt: new Date().toISOString(),
    },
  })
  toast.error(message, { id: 'workspace-persistence-error', duration: 8000 })
}

if (deferredPersistenceFailure) {
  const { error, source } = deferredPersistenceFailure
  deferredPersistenceFailure = null
  queueMicrotask(() => reportPersistenceFailure(error, source))
}

useNotesStore.subscribe((state, previousState) => {
  if (state.cacheOwnerId !== previousState.cacheOwnerId) {
    setActiveWorkspaceOwner(state.cacheOwnerId)
  }

  if (
    !state.cacheOwnerId ||
    state.hydratedWorkspaceOwnerId !== state.cacheOwnerId
  ) {
    return
  }

  const workspaceChanged =
    state.notes !== previousState.notes ||
    state.folders !== previousState.folders ||
    state.tags !== previousState.tags ||
    state.selectedNoteId !== previousState.selectedNoteId ||
    state.selectedFolderId !== previousState.selectedFolderId ||
    state.selectedTagFilter !== previousState.selectedTagFilter ||
    state.searchQuery !== previousState.searchQuery ||
    state.lastSyncTime !== previousState.lastSyncTime ||
    state.isNewUser !== previousState.isNewUser

  if (!workspaceChanged) return
  void queueWorkspaceSnapshot(
    state.cacheOwnerId,
    selectWorkspaceSnapshot(state)
  ).catch(() => undefined)
})

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'quicknotes-theme',
    }
  )
)

export const useUIStore = create(
  persist(
    (set) => ({
      sidebarOpen: true,
      notesListWidth: 320,
      quickNoteOpen: false,
      settingsOpen: false,
      shareModalOpen: false,
      shareNoteId: null,
      sharedNotesViewOpen: false,
      exportModalOpen: false,
      importModalOpen: false,
      reminderModalOpen: false,
      reminderNoteId: null,
      showTrash: false,
      findReplaceOpen: false,
      noteLinkPopoverOpen: false,
      noteLinkPosition: { x: 0, y: 0 },
      imageUploadOpen: false,
      versionHistoryOpen: false,
      versionHistoryNoteId: null,
      duplicateModalOpen: false,
      currentSort: 'updated-desc',
      showFavorites: false,
      globalSearchOpen: false,
      focusModeOpen: false,
      linkModalOpen: false,
      archiveViewOpen: false,
      voiceInputActive: false,
      multiSelectMode: false,
      selectedNoteIds: [],
      shortcutsModalOpen: false,
      noteTypesModalOpen: false,
      helpModalOpen: false,
      privacyModalOpen: false,
      termsModalOpen: false,
      tagManagerOpen: false,
      mobileEditorOpen: false,
      mobileView: 'notes',
      viewMode: 'list',
      translateModalOpen: false,
      translateText: '',
      language: 'en',
      autoSync: true,
      syncInterval: 5,
      syncOnStartup: true,
      showSyncNotifications: true,
      editorSettingsOpen: false,
      htmlEditorOpen: false,
      confirmBeforeDelete: true,
      spellCheck: true,
      showNoteStatistics: true,
      trashRetentionDays: 30,
      notePreviewLines: 2,
      dateFormat: 'relative',
      compactMode: false,
      autoSaveDelay: 300,
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setNotesListWidth: (width) => set({ notesListWidth: width }),
  setQuickNoteOpen: (open) => set({ quickNoteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setShareModalOpen: (open, noteId = null) => set({ shareModalOpen: open, shareNoteId: noteId }),
  setSharedNotesViewOpen: (open) => set({ sharedNotesViewOpen: open }),
  setExportModalOpen: (open) => set({ exportModalOpen: open }),
  setImportModalOpen: (open) => set({ importModalOpen: open }),
  setReminderModalOpen: (open, noteId = null) => set({ reminderModalOpen: open, reminderNoteId: noteId }),
  setShowTrash: (show) => set({ showTrash: show }),
  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),
  setNoteLinkPopoverOpen: (open, position = null) => set({ 
    noteLinkPopoverOpen: open, 
    noteLinkPosition: position || { x: 0, y: 0 } 
  }),
  setImageUploadOpen: (open) => set({ imageUploadOpen: open }),
  setVersionHistoryOpen: (open, noteId = null) => set({ 
    versionHistoryOpen: open, 
    versionHistoryNoteId: noteId 
  }),
  setDuplicateModalOpen: (open) => set({ duplicateModalOpen: open }),
  setCurrentSort: (sort) => set({ currentSort: sort }),
  setShowFavorites: (show) => set({ showFavorites: show, showTrash: false }),
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
  setFocusModeOpen: (open) => set({ focusModeOpen: open }),
  setLinkModalOpen: (open) => set({ linkModalOpen: open }),
  setArchiveViewOpen: (open) => set({ archiveViewOpen: open }),
  setVoiceInputActive: (active) => set({ voiceInputActive: active }),
  setMultiSelectMode: (mode) => set({ multiSelectMode: mode, selectedNoteIds: [] }),
  setShortcutsModalOpen: (open) => set({ shortcutsModalOpen: open }),
  setNoteTypesModalOpen: (open) => set({ noteTypesModalOpen: open }),
  setHelpModalOpen: (open) => set({ helpModalOpen: open }),
  setPrivacyModalOpen: (open) => set({ privacyModalOpen: open }),
  setMobileEditorOpen: (open) => set({ mobileEditorOpen: open, mobileView: open ? 'editor' : 'notes' }),
  setMobileView: (view) => set({ mobileView: view, mobileEditorOpen: view === 'editor' }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTermsModalOpen: (open) => set({ termsModalOpen: open }),
  setTagManagerOpen: (open) => set({ tagManagerOpen: open }),
  setTranslateModalOpen: (open) => set({ translateModalOpen: open }),
  setTranslateText: (text) => set({ translateText: text }),
  openTranslateModal: (text) => set({ translateModalOpen: true, translateText: text }),
  setEditorSettingsOpen: (open) => set({ editorSettingsOpen: open }),
  setHTMLEditorOpen: (open) => set({ htmlEditorOpen: open }),
  toggleNoteSelection: (noteId) => set((state) => {
    const isSelected = state.selectedNoteIds.includes(noteId)
    return {
      selectedNoteIds: isSelected
        ? state.selectedNoteIds.filter((id) => id !== noteId)
        : [...state.selectedNoteIds, noteId],
    }
  }),
  clearNoteSelection: () => set({ selectedNoteIds: [], multiSelectMode: false }),
  setLanguage: (lang) => set({ language: lang }),
  setAutoSync: (enabled) => set({ autoSync: enabled }),
  setSyncInterval: (minutes) => set({ syncInterval: minutes }),
  setSyncOnStartup: (enabled) => set({ syncOnStartup: enabled }),
  setShowSyncNotifications: (enabled) => set({ showSyncNotifications: enabled }),
  setConfirmBeforeDelete: (enabled) => set({ confirmBeforeDelete: enabled }),
  setSpellCheck: (enabled) => set({ spellCheck: enabled }),
  setShowNoteStatistics: (enabled) => set({ showNoteStatistics: enabled }),
  setTrashRetentionDays: (days) => set({ trashRetentionDays: days }),
  setNotePreviewLines: (lines) => set({ notePreviewLines: lines }),
  setDateFormat: (format) => set({ dateFormat: format }),
  setCompactMode: (enabled) => set({ compactMode: enabled }),
  setAutoSaveDelay: (delay) => set({ autoSaveDelay: delay }),
}),
    {
      name: 'quicknotes-ui-settings',
      partialize: (state) => ({ 
        language: state.language,
        currentSort: state.currentSort,
        notesListWidth: state.notesListWidth,
        viewMode: state.viewMode,
        autoSync: state.autoSync,
        syncInterval: state.syncInterval,
        syncOnStartup: state.syncOnStartup,
        showSyncNotifications: state.showSyncNotifications,
        confirmBeforeDelete: state.confirmBeforeDelete,
        spellCheck: state.spellCheck,
        showNoteStatistics: state.showNoteStatistics,
        trashRetentionDays: state.trashRetentionDays,
        notePreviewLines: state.notePreviewLines,
        dateFormat: state.dateFormat,
        compactMode: state.compactMode,
        autoSaveDelay: state.autoSaveDelay,
      }),
    }
  )
)
