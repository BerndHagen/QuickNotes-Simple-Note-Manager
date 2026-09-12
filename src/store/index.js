import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { generateId, repairMojibake } from '../lib/utils'
import { filterNotes, STARRED_FILTER } from '../lib/filterNotes'
import {
  addToSyncQueue,
  acknowledgeSyncItem,
  adoptLegacyWorkspaceRecords,
  db,
  deleteFolderOffline,
  deleteNoteOffline,
  permanentlyDeleteNoteOffline,
  deleteTagOffline,
  deleteWorkspaceData,
  getPendingSyncItems,
  getWorkspaceCache,
  getWorkspaceSnapshot,
  notifyCanonicalContentPersisted,
  replaceWorkspaceCache,
  saveNoteOffline,
  saveNoteVersion,
  saveCatalogRecordOffline,
  saveTagRenameOffline,
  saveWorkspaceCatalogMutation,
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
import { prepareWorkspaceImport } from '../lib/workspaceBackup'
import { partitionRecoverableNotes } from '../lib/recovery'
import { createNoteInputFromTemplate } from '../lib/noteTemplates'
import {
  extractContentDescriptorFromNoteData,
  normalizeContentDescriptor,
} from '../lib/contentModel'
import { duplicateSpatialWorkspace } from '../lib/spatial/repository'
import { duplicateNoteAnnotations } from '../lib/spatial/annotations'
import { duplicateNoteResourceLinks } from '../lib/resources/repository'
import { activateIntelligenceJobOwner } from '../lib/intelligence/service'
import { CAPTURE_RESOURCE_QUEUE_TABLE } from '../lib/capture/cloud'
import { purgeSharedNoteCache, purgeSharedNoteCaches } from '../lib/collaboration/cache'
import {
  filterBySmartView,
  getSmartViewScope,
  normalizeSmartViewCriteria,
} from '../lib/smartViews'
import toast from 'react-hot-toast'
import { clearCollaborationConflict, enqueueCollaborationConflict } from './collaborationState'
import { createSyncActions } from './syncActions'
import { useUIStore } from './uiStores'
const WELCOME_TITLE = 'Welcome to QuickNotes'
const MAX_KNOWLEDGE_HISTORY = 100

const normalizeKnowledgeTarget = (target) => {
  if (typeof target === 'string') target = { noteId: target }
  const noteId = typeof target?.noteId === 'string' ? target.noteId : ''
  if (!noteId) return null
  const normalized = {
    noteId,
    anchorId: typeof target.anchorId === 'string' && target.anchorId ? target.anchorId : null,
    objectId: typeof target.objectId === 'string' && target.objectId ? target.objectId : null,
  }
  if (typeof target.recognitionId === 'string' && target.recognitionId) normalized.recognitionId = target.recognitionId
  if (typeof target.resourceId === 'string' && target.resourceId) normalized.resourceId = target.resourceId
  if (typeof target.pageId === 'string' && target.pageId) normalized.pageId = target.pageId
  if (Number.isInteger(target.pageNumber) && target.pageNumber > 0) normalized.pageNumber = target.pageNumber
  if (Number.isFinite(target.timeMs) && target.timeMs >= 0) normalized.timeMs = target.timeMs
  if (target.region && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(target.region[key]))) {
    normalized.region = { x: target.region.x, y: target.region.y, width: target.region.width, height: target.region.height }
  }
  return normalized
}

const sameKnowledgeTarget = (left, right) =>
  left?.noteId === right?.noteId &&
  (left?.anchorId || null) === (right?.anchorId || null) &&
  (left?.objectId || null) === (right?.objectId || null) &&
  (left?.recognitionId || null) === (right?.recognitionId || null) &&
  (left?.resourceId || null) === (right?.resourceId || null) &&
  (left?.pageId || null) === (right?.pageId || null) &&
  (left?.pageNumber || null) === (right?.pageNumber || null) &&
  (left?.timeMs ?? null) === (right?.timeMs ?? null)

const selectKnowledgeTargetState = (state, target) => {
  const next = normalizeKnowledgeTarget(target)
  if (!next) return { selectedNoteId: null }
  const navigation = state.knowledgeNavigation
  const selectedTarget = normalizeKnowledgeTarget(state.selectedNoteId)
  const current = selectedTarget?.noteId === navigation.current?.noteId
    ? navigation.current
    : selectedTarget
  const back = !current || sameKnowledgeTarget(current, next)
    ? navigation.back
    : [...navigation.back, current].slice(-MAX_KNOWLEDGE_HISTORY)
  const token = navigation.token + 1
  return {
    selectedNoteId: next.noteId,
    knowledgeNavigation: {
      current: next,
      back,
      forward: [],
      pending: { ...next, token },
      token,
    },
  }
}

const normalizeSharedNoteRecord = (note, permission = 'view') => {
  if (!note) return null
  const noteType = note.note_type || 'standard'
  const descriptor = extractContentDescriptorFromNoteData(noteType, note.note_data)
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    userId: note.user_id,
    folderId: note.folder_id,
    tags: note.tags || [],
    starred: note.starred || false,
    pinned: note.pinned || false,
    deleted: note.deleted || false,
    archived: note.archived || false,
    noteType,
    noteData: descriptor.noteData,
    contentKind: descriptor.contentKind,
    contentSchemaVersion: descriptor.contentSchemaVersion,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    isShared: true,
    sharePermission: permission,
  }
}

const emptyWorkspace = () => ({
  notes: [],
  corruptedNotes: [],
  folders: [],
  tags: [],
  savedViews: [],
  noteTemplates: [],
  selectedNoteId: null,
  selectedFolderId: null,
  selectedTagFilter: null,
  selectedSmartViewId: null,
  searchQuery: '',
  lastSyncTime: null,
  isNewUser: false,
})

const selectWorkspaceSnapshot = (state) => ({
  // Isolated rows remain in the canonical snapshot so routine saves cannot
  // silently discard data this build cannot render. They are excluded only
  // from the active library and cloud sync.
  notes: [
    ...state.notes,
    ...(state.corruptedNotes || []).map((record) => record.raw),
  ],
  folders: state.folders,
  tags: state.tags,
  savedViews: state.savedViews,
  noteTemplates: state.noteTemplates,
  selectedNoteId: state.selectedNoteId,
  selectedFolderId: state.selectedFolderId,
  selectedTagFilter: state.selectedTagFilter,
  selectedSmartViewId: state.selectedSmartViewId,
  searchQuery: state.searchQuery,
  lastSyncTime: state.lastSyncTime,
  isNewUser: state.isNewUser,
})

const normalizeWorkspaceSnapshot = (snapshot) => {
  const validRecords = (records) =>
    Array.isArray(records)
      ? records.filter((record) => record && typeof record.id === 'string')
      : []
  const partitionedNotes = partitionRecoverableNotes(snapshot?.notes)
  const workspace = {
    notes: partitionedNotes.notes,
    corruptedNotes: partitionedNotes.corruptedNotes,
    folders: validRecords(snapshot?.folders),
    tags: validRecords(snapshot?.tags),
    savedViews: validRecords(snapshot?.savedViews),
    noteTemplates: validRecords(snapshot?.noteTemplates),
    selectedNoteId: snapshot?.selectedNoteId || null,
    selectedFolderId: snapshot?.selectedFolderId || null,
    selectedTagFilter: snapshot?.selectedTagFilter || null,
    selectedSmartViewId: snapshot?.selectedSmartViewId || null,
    searchQuery: typeof snapshot?.searchQuery === 'string' ? snapshot.searchQuery : '',
    lastSyncTime: snapshot?.lastSyncTime || null,
    isNewUser: Boolean(snapshot?.isNewUser),
  }
  const noteIds = new Set(workspace.notes.map((note) => note.id))
  const folderIds = new Set(workspace.folders.map((folder) => folder.id))
  const tagNames = new Set(workspace.tags.map((tag) => tag.name))
  const savedViewIds = new Set(workspace.savedViews.map((view) => view.id))

  if (!noteIds.has(workspace.selectedNoteId)) workspace.selectedNoteId = null
  if (!folderIds.has(workspace.selectedFolderId)) workspace.selectedFolderId = null
  if (
    workspace.selectedTagFilter !== STARRED_FILTER &&
    !tagNames.has(workspace.selectedTagFilter)
  ) workspace.selectedTagFilter = null
  if (!savedViewIds.has(workspace.selectedSmartViewId)) workspace.selectedSmartViewId = null
  return workspace
}

const SYNC_DIRTY_STATUSES = new Set([
  SyncStatus.PENDING,
  SyncStatus.CONFLICT,
  SyncStatus.ERROR,
])

const recordsHaveSameContent = (left, right) => {
  if (!left || !right) return left === right
  const normalize = (record) => Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== 'syncStatus')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  )
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

const workspaceWrites = new Map()
const externalNoteBaselines = new Map()
let workspaceTransitionChain = Promise.resolve()
let backendSyncPromise = null
let deferredPersistenceFailure = null
let reportPersistenceFailure = (error, source) => {
  deferredPersistenceFailure = { error, source }
}
let localStorageFailureReported = false

const persistNoteMutation = (note, operation = 'update') => {
  void saveNoteOffline(note, operation).catch((error) => {
    reportPersistenceFailure(error, 'indexeddb')
  })
}

const persistCatalogRecordMutation = (table, record, operation = 'update') => {
  void saveCatalogRecordOffline(table, record, operation).catch((error) => {
    reportPersistenceFailure(error, 'indexeddb')
  })
}

const reportCatalogGraphMutation = (promise) => {
  void promise.catch((error) => reportPersistenceFailure(error, 'indexeddb'))
}

const persistWorkspaceCatalogMutation = (get, table, operation, data) => {
  const state = get()
  void saveWorkspaceCatalogMutation(
    state.cacheOwnerId,
    selectWorkspaceSnapshot(state),
    table,
    operation,
    data
  ).catch((error) => {
    reportPersistenceFailure(error, 'indexeddb')
  })
}

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

const runBackendSync = (transition) => {
  if (backendSyncPromise) return backendSyncPromise
  const syncPromise = runWorkspaceTransition(transition)
  backendSyncPromise = syncPromise
  const clearSyncPromise = () => {
    if (backendSyncPromise === syncPromise) backendSyncPromise = null
  }
  void syncPromise.then(clearSyncPromise, clearSyncPromise)
  return syncPromise
}

const withWorkspaceSyncLock = async (ownerId, transition) => {
  const lockManager = globalThis.navigator?.locks
  if (!ownerId || typeof lockManager?.request !== 'function') return transition()
  return lockManager.request(`quicknotes-sync:${ownerId}`, { mode: 'exclusive' }, transition)
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
  workspace.notes.length > 0 ||
  workspace.corruptedNotes.length > 0 ||
  workspace.folders.length > 0 ||
  workspace.tags.length > 0 ||
  workspace.savedViews.length > 0 ||
  workspace.noteTemplates.length > 0

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
    await activateIntelligenceJobOwner(ownerId)
    return true
  }

  try {
    if (current.cacheOwnerId && current.cacheOwnerId !== ownerId) {
      await purgeSharedNoteCaches(current.sharedNotes, current.cacheOwnerId)
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
    externalNoteBaselines.clear()
    set({
      ...workspace,
      user,
      cacheOwnerId: ownerId,
      hydratedWorkspaceOwnerId: ownerId,
      sharedNotes: [],
      pendingShares: [],
      knowledgeNavigation: {
        current: workspace.selectedNoteId ? { noteId: workspace.selectedNoteId, anchorId: null, objectId: null } : null,
        back: [],
        forward: [],
        pending: null,
        token: 0,
      },
    })
    await activateIntelligenceJobOwner(ownerId)
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
<p>Three panes, left to right: the <strong>rail</strong> for navigation, the <strong>list</strong> of notes in the current view, and the <strong>editor</strong>. On tablet and compact widths the rail becomes a drawer and the list and editor take turns, so the same workspace works on a phone.</p>
<p>Everything saves as you type. The indicator in the sidebar footer tells you where your notes currently live \u2014 on this device only, or synced to your account.</p>

<h2>Folders and tags do different jobs</h2>
<ul>
  <li><strong>A folder is where a note lives.</strong> One note, one folder. Good for separating contexts that never mix, like Work and Personal.</li>
  <li><strong>A tag is something a note is about.</strong> A note can carry several. Good for threads that cut across folders, like <em>#important</em> or a project name.</li>
</ul>
<p>If you are unsure which to use, start with tags. They are easier to change your mind about later.</p>

<h2>Beyond plain documents</h2>
<p>Under <strong>Workspaces</strong> in the rail there are structured workspaces, each with its own fields rather than a blank page: a task list with priorities and due dates, a project board with columns and milestones, a meeting workspace for agenda, decisions and action items, a daily journal, an idea board, a shopping list, and a weekly planner.</p>
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
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Create a task list from Workspaces and add three things you owe someone</p></div></li>
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
      corruptedNotes: [],
      folders: [],
      tags: [],
      savedViews: [],
      noteTemplates: [],
      selectedNoteId: null,
      selectedFolderId: null,
      selectedTagFilter: null,
      selectedSmartViewId: null,
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
      /** Unsaved shared-note drafts and explicit inbound conflict review. */
      sharedDraftRevisions: {},
      collaborationConflict: null,
      collaborationConflicts: [],
      /**
       * Owner-catalog conflicts are transient prompts backed by the durable
       * local row and outbox. Reloading safely redetects them from those two
       * sources; the incoming cloud snapshot is never treated as canonical
       * until the user chooses it.
       */
      catalogConflicts: [],
      /** Session-local navigation; note and index persistence stay separate. */
      knowledgeNavigation: {
        current: null,
        back: [],
        forward: [],
        pending: null,
        token: 0,
      },

      initializeStarterContent: () => {
        const { welcomeNote, starterFolders, starterTags } = createStarterContent()
        
        set({
          notes: [welcomeNote],
          folders: starterFolders,
          tags: starterTags,
          selectedNoteId: welcomeNote.id,
          isNewUser: true,
        })

        persistNoteMutation(welcomeNote, 'insert')
        
        starterFolders.forEach(folder => {
          persistCatalogRecordMutation('folders', folder, 'insert')
        })
        
        starterTags.forEach(tag => {
          persistCatalogRecordMutation('tags', tag, 'insert')
        })
      },


      createNote: (note = {}) => {
        const hasExplicitFolder = Object.prototype.hasOwnProperty.call(note, 'folderId')
        const noteType = note.noteType || 'standard'
        const contentDescriptor = normalizeContentDescriptor({ ...note, noteType })
        const newNote = {
          id: generateId(),
          title: limitNoteTitle(note.title),
          content: note.content || '',
          folderId: hasExplicitFolder ? note.folderId : get().selectedFolderId,
          tags: note.tags || [],
          starred: Boolean(note.starred),
          pinned: Boolean(note.pinned),
          noteType,
          noteData: note.noteData || null,
          ...contentDescriptor,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          notes: [newNote, ...state.notes],
          ...selectKnowledgeTargetState(state, { noteId: newNote.id }),
          isEditing: true,
        }))

        persistNoteMutation(newNote, 'insert')

        return newNote
      },

      createSavedView: (input = {}) => {
        const name = String(input.name || '').trim()
        if (!name) throw new Error('A smart view name is required')
        if (get().savedViews.some((view) => view.name.toLowerCase() === name.toLowerCase())) {
          throw new Error('A smart view with this name already exists')
        }
        const now = new Date().toISOString()
        const savedView = {
          id: generateId(),
          name: name.slice(0, 80),
          icon: input.icon || 'ListFilter',
          color: input.color || '#2d6871',
          criteria: normalizeSmartViewCriteria(input.criteria),
          order: get().savedViews.length,
          createdAt: now,
          updatedAt: now,
          syncStatus: SyncStatus.PENDING,
        }
        set((state) => ({
          savedViews: [...state.savedViews, savedView],
          selectedSmartViewId: savedView.id,
          selectedFolderId: null,
          selectedTagFilter: null,
        }))
        persistWorkspaceCatalogMutation(get, 'saved_views', 'insert', savedView)
        return savedView
      },

      updateSavedView: (id, updates = {}) => {
        const current = get().savedViews.find((view) => view.id === id)
        if (!current) return null
        const name = Object.prototype.hasOwnProperty.call(updates, 'name')
          ? String(updates.name || '').trim()
          : current.name
        if (!name) throw new Error('A smart view name is required')
        if (get().savedViews.some(
          (view) => view.id !== id && view.name.toLowerCase() === name.toLowerCase()
        )) throw new Error('A smart view with this name already exists')
        const updated = {
          ...current,
          ...updates,
          name: name.slice(0, 80),
          criteria: normalizeSmartViewCriteria(updates.criteria ?? current.criteria),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }
        set((state) => ({
          savedViews: state.savedViews.map((view) => view.id === id ? updated : view),
        }))
        persistWorkspaceCatalogMutation(get, 'saved_views', 'update', updated)
        return updated
      },

      deleteSavedView: (id) => {
        if (!get().savedViews.some((view) => view.id === id)) return
        set((state) => ({
          savedViews: state.savedViews.filter((view) => view.id !== id),
          selectedSmartViewId: state.selectedSmartViewId === id ? null : state.selectedSmartViewId,
        }))
        persistWorkspaceCatalogMutation(get, 'saved_views', 'delete', { id })
      },

      createNoteTemplate: (input = {}) => {
        const name = String(input.name || '').trim()
        if (!name) throw new Error('A template name is required')
        if (get().noteTemplates.some(
          (template) => template.name.toLowerCase() === name.toLowerCase()
        )) throw new Error('A template with this name already exists')
        const now = new Date().toISOString()
        const template = {
          id: generateId(),
          name: name.slice(0, 80),
          description: String(input.description || '').trim().slice(0, 500),
          noteType: input.noteType || 'standard',
          titleTemplate: String(input.titleTemplate || input.name || 'Untitled note').slice(0, 500),
          content: input.content || '',
          noteData: input.noteData ?? null,
          tags: Array.isArray(input.tags) ? [...new Set(input.tags)].slice(0, 50) : [],
          favorite: Boolean(input.favorite),
          createdAt: now,
          updatedAt: now,
          syncStatus: SyncStatus.PENDING,
        }
        set((state) => ({ noteTemplates: [template, ...state.noteTemplates] }))
        persistWorkspaceCatalogMutation(get, 'note_templates', 'insert', template)
        return template
      },

      updateNoteTemplate: (id, updates = {}) => {
        const current = get().noteTemplates.find((template) => template.id === id)
        if (!current) return null
        const name = Object.prototype.hasOwnProperty.call(updates, 'name')
          ? String(updates.name || '').trim()
          : current.name
        if (!name) throw new Error('A template name is required')
        if (get().noteTemplates.some(
          (template) => template.id !== id && template.name.toLowerCase() === name.toLowerCase()
        )) throw new Error('A template with this name already exists')
        const updated = {
          ...current,
          ...updates,
          name: name.slice(0, 80),
          description: String(updates.description ?? current.description ?? '').slice(0, 500),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }
        set((state) => ({
          noteTemplates: state.noteTemplates.map((template) => template.id === id ? updated : template),
        }))
        persistWorkspaceCatalogMutation(get, 'note_templates', 'update', updated)
        return updated
      },

      deleteNoteTemplate: (id) => {
        if (!get().noteTemplates.some((template) => template.id === id)) return
        set((state) => ({
          noteTemplates: state.noteTemplates.filter((template) => template.id !== id),
        }))
        persistWorkspaceCatalogMutation(get, 'note_templates', 'delete', { id })
      },

      createNoteFromTemplate: (templateId, title) => {
        const template = get().noteTemplates.find((candidate) => candidate.id === templateId)
        if (!template) throw new Error('Template not found')
        return get().createNote(createNoteInputFromTemplate(template, title))
      },

      importWorkspaceBackup: async (backup) => runWorkspaceTransition(async () => {
        const current = get()
        if (!current.cacheOwnerId || current.hydratedWorkspaceOwnerId !== current.cacheOwnerId) {
          throw new Error('Open a workspace before importing a backup.')
        }

        const imported = await prepareWorkspaceImport(backup, current, { createId: generateId })
        for (const collection of [
          imported.spatialDocuments,
          imported.spatialPages,
          imported.spatialObjects,
          imported.spatialAnnotations,
          imported.spatialAnnotationPages,
          imported.spatialAnnotationObjects,
          imported.resources,
          imported.canonicalResources,
          imported.noteResources,
          imported.resourceBlobs,
          imported.recognizedContent,
          imported.noteVersions,
        ]) {
          for (const record of collection) record.ownerId = current.cacheOwnerId
        }
        const workspace = {
          ...selectWorkspaceSnapshot(current),
          notes: [...imported.notes, ...current.notes],
          folders: [...current.folders, ...imported.folders],
          tags: [...current.tags, ...imported.tags],
          savedViews: [...current.savedViews, ...imported.savedViews],
          noteTemplates: [...imported.noteTemplates, ...current.noteTemplates],
          selectedNoteId: imported.notes[0]?.id || current.selectedNoteId,
        }
        const queueEntries = [
          ...imported.notes.map((data) => ({ table: 'notes', operation: 'insert', data })),
          ...imported.folders.map((data) => ({ table: 'folders', operation: 'insert', data })),
          ...imported.tags.map((data) => ({ table: 'tags', operation: 'insert', data })),
          ...imported.savedViews.map((data) => ({ table: 'saved_views', operation: 'insert', data })),
          ...imported.noteTemplates.map((data) => ({ table: 'note_templates', operation: 'insert', data })),
          ...imported.canonicalResources.map((data) => ({ table: CAPTURE_RESOURCE_QUEUE_TABLE, operation: 'insert', data })),
          ...imported.noteResources.map((data) => ({ table: 'note_resources', operation: 'insert', data })),
          ...imported.recognizedContent.map((data) => ({ table: 'recognized_content', operation: 'insert', data })),
        ].map((entry) => ({
          ...entry,
          ownerId: current.cacheOwnerId,
          timestamp: new Date().toISOString(),
          mutationId: generateId(),
        }))

        try {
          await db.transaction(
            'rw',
            db.notes,
            db.noteVersions,
            db.folders,
            db.tags,
            db.syncQueue,
            db.workspaceSnapshots,
            db.spatialDocuments,
            db.spatialPages,
            db.spatialObjects,
            db.spatialAnnotations,
            db.spatialAnnotationPages,
            db.spatialAnnotationObjects,
            db.resources,
            db.noteResources,
            db.resourceBlobs,
            db.recognizedContent,
            async () => {
              if (imported.notes.length > 0) await db.notes.bulkPut(imported.notes)
              if (imported.noteVersions.length > 0) await db.noteVersions.bulkAdd(imported.noteVersions)
              if (imported.folders.length > 0) await db.folders.bulkPut(imported.folders)
              if (imported.tags.length > 0) await db.tags.bulkPut(imported.tags)
              if (imported.spatialDocuments.length > 0) await db.spatialDocuments.bulkPut(imported.spatialDocuments)
              if (imported.spatialPages.length > 0) await db.spatialPages.bulkPut(imported.spatialPages)
              if (imported.spatialObjects.length > 0) await db.spatialObjects.bulkPut(imported.spatialObjects)
              if (imported.spatialAnnotations.length > 0) await db.spatialAnnotations.bulkPut(imported.spatialAnnotations)
              if (imported.spatialAnnotationPages.length > 0) await db.spatialAnnotationPages.bulkPut(imported.spatialAnnotationPages)
              if (imported.spatialAnnotationObjects.length > 0) await db.spatialAnnotationObjects.bulkPut(imported.spatialAnnotationObjects)
              if (imported.resources.length > 0) await db.resources.bulkPut(imported.resources)
              if (imported.canonicalResources.length > 0) await db.resources.bulkPut(imported.canonicalResources)
              if (imported.noteResources.length > 0) await db.noteResources.bulkPut(imported.noteResources)
              if (imported.resourceBlobs.length > 0) await db.resourceBlobs.bulkPut(imported.resourceBlobs)
              if (imported.recognizedContent.length > 0) await db.recognizedContent.bulkPut(imported.recognizedContent)
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
          savedViews: imported.savedViews.length,
          noteTemplates: imported.noteTemplates.length,
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
          sharedDraftRevisions: state.sharedNotes.some((share) => share.notes?.id === id)
            ? {
                ...state.sharedDraftRevisions,
                [id]: { revision: (state.sharedDraftRevisions[id]?.revision || 0) + 1, dirty: true },
              }
            : state.sharedDraftRevisions,
        }))
      },

      markSpatialNotePersisted: (id, updatedAt) => {
        set((state) => ({
          notes: state.notes.map((note) => note.id === id ? { ...note, updatedAt } : note),
          sharedNotes: state.sharedNotes.map((share) =>
            share.notes?.id === id ? { ...share, notes: { ...share.notes, updatedAt } } : share
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
          
          const draftRevision = get().sharedDraftRevisions[id]?.revision || 0
          const { updateSharedNote } = await import('../lib/backend')
          await updateSharedNote(id, normalizedUpdates)
          
          set((state) => ({
            sharedNotes: state.sharedNotes.map((share) =>
              share.notes?.id === id
                ? { ...share, notes: { ...share.notes, ...normalizedUpdates, updatedAt: new Date().toISOString() } }
                : share
            ),
            sharedDraftRevisions: state.sharedDraftRevisions[id]?.revision === draftRevision
              ? { ...state.sharedDraftRevisions, [id]: { revision: draftRevision, dirty: false } }
              : state.sharedDraftRevisions,
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
          try {
            await saveNoteOffline({ ...note, ...updatedNote })
            set({ persistenceError: null })
          } catch (error) {
            reportPersistenceFailure(error, 'indexeddb')
            throw error
          }
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
          persistNoteMutation(note)
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
          persistNoteMutation(note)
        }
      },

      permanentlyDeleteNote: async (id) => {
        const current = get()
        if (!current.notes.some((note) => note.id === id)) return false
        const notes = current.notes.filter((note) => note.id !== id)
        const selectedNoteId = current.selectedNoteId === id
          ? notes.find((note) => !note.deleted)?.id || null
          : current.selectedNoteId
        const workspace = selectWorkspaceSnapshot({ ...current, notes, selectedNoteId })
        try {
          const deleted = await permanentlyDeleteNoteOffline(id, workspace)
          if (!deleted) return false
          set((state) => ({
            notes: state.notes.filter((note) => note.id !== id),
            selectedNoteId: state.selectedNoteId === id
              ? state.notes.find((note) => note.id !== id && !note.deleted)?.id || null
              : state.selectedNoteId,
            persistenceError: null,
          }))
          try {
            await queueWorkspaceSnapshot(current.cacheOwnerId, selectWorkspaceSnapshot(get()))
          } catch (error) {
            // The atomic deletion transaction already stored a recoverable
            // snapshot. Report a later mirror-refresh failure without
            // misrepresenting the completed deletion as rolled back.
            reportPersistenceFailure(error, 'indexeddb')
          }
          return true
        } catch (error) {
          reportPersistenceFailure(error, 'indexeddb')
          return false
        }
      },

      /**
       * Auto-delete notes that have been in trash for more than 30 days.
       */
      cleanupExpiredTrash: async () => {
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
            try {
              await get().permanentlyDeleteNote(note.id)
            } catch {
              // The note remains visible and durable; persistence reporting is
              // handled by permanentlyDeleteNote and later rows can still run.
            }
          }
        }

        // Enforce the same retention in the cloud even when this browser no
        // longer holds the deleted row in its cache. The RPC is tenant-scoped
        // with auth.uid() and cascades versions/shares through foreign keys.
        if (isBackendConfigured() && user && !user.isLocal) {
          void backend.rpc('purge_my_expired_trash', {
            p_retention_days: retentionDays,
          }).then(({ error }) => {
            if (error) {
              set({ lastSyncError: error.message || 'Cloud trash cleanup failed' })
            }
          })
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
          persistNoteMutation(note)
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
          persistNoteMutation(note)
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
              persistNoteMutation(updatedNote)
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
          persistNoteMutation(note)
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
          persistNoteMutation(note)
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
          ...selectKnowledgeTargetState(state, { noteId: duplicate.id }),
        }))

        persistNoteMutation(duplicate, 'insert')
        void (async () => {
          if (duplicate.contentKind === 'paper' || duplicate.contentKind === 'canvas') {
            await duplicateSpatialWorkspace(id, duplicate.id)
          }
          await duplicateNoteResourceLinks(id, duplicate.id)
          await duplicateNoteAnnotations(id, duplicate.id)
        })().catch((error) => {
          reportPersistenceFailure(error, 'indexeddb')
        })
        return duplicate
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
          persistNoteMutation(note)
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

        persistCatalogRecordMutation('folders', newFolder, 'insert')

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
          persistCatalogRecordMutation('folders', folder)
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

        const updatedNotes = affectedNotes.map((note) => ({
          ...note,
          folderId: null,
          updatedAt: now,
          syncStatus: SyncStatus.PENDING,
        }))
        const updatedChildren = affectedChildren.map((child) => ({
            ...child,
            parentId: folder.parentId || null,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING,
        }))
        reportCatalogGraphMutation(deleteFolderOffline(id, updatedNotes, updatedChildren))
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

        persistCatalogRecordMutation('tags', newTag, 'insert')

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

        let renamedNotes = []
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

          renamedNotes = get().notes.filter(n => n.tags?.includes(normalizedUpdates.name))
        }

        if (renamedNotes.length > 0) {
          reportCatalogGraphMutation(saveTagRenameOffline(updatedTag, renamedNotes))
        } else {
          persistCatalogRecordMutation('tags', updatedTag)
        }
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
        
        const updatedNotes = get().notes.filter((note) => affectedNoteIds.includes(note.id))
        reportCatalogGraphMutation(deleteTagOffline(id, updatedNotes))
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
          persistNoteMutation(note)
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
          persistNoteMutation(note)
        }
      },
      navigateToKnowledgeTarget: (target, options = {}) => {
        const next = normalizeKnowledgeTarget(target)
        if (!next) {
          set({ selectedNoteId: null })
          return false
        }
        const available = get().notes.some((note) => note.id === next.noteId) ||
          get().sharedNotes.some((share) => share.notes?.id === next.noteId)
        if (!available) return false
        set((state) => {
          const navigation = state.knowledgeNavigation
          const current = navigation.current || normalizeKnowledgeTarget(state.selectedNoteId)
          const back = options.replace || !current || sameKnowledgeTarget(current, next)
            ? navigation.back
            : [...navigation.back, current].slice(-MAX_KNOWLEDGE_HISTORY)
          const token = navigation.token + 1
          return {
            selectedNoteId: next.noteId,
            knowledgeNavigation: {
              current: next,
              back,
              forward: options.replace ? navigation.forward : [],
              pending: { ...next, token },
              token,
            },
          }
        })
        return true
      },
      navigateKnowledgeBack: () => {
        const previous = get().knowledgeNavigation.back.at(-1)
        if (!previous) return false
        set((state) => {
          const current = state.knowledgeNavigation.current || normalizeKnowledgeTarget(state.selectedNoteId)
          const token = state.knowledgeNavigation.token + 1
          return {
            selectedNoteId: previous.noteId,
            knowledgeNavigation: {
              current: previous,
              back: state.knowledgeNavigation.back.slice(0, -1),
              forward: current
                ? [current, ...state.knowledgeNavigation.forward].slice(0, MAX_KNOWLEDGE_HISTORY)
                : state.knowledgeNavigation.forward,
              pending: { ...previous, token },
              token,
            },
          }
        })
        return true
      },
      navigateKnowledgeForward: () => {
        const next = get().knowledgeNavigation.forward[0]
        if (!next) return false
        set((state) => {
          const current = state.knowledgeNavigation.current || normalizeKnowledgeTarget(state.selectedNoteId)
          const token = state.knowledgeNavigation.token + 1
          return {
            selectedNoteId: next.noteId,
            knowledgeNavigation: {
              current: next,
              back: current
                ? [...state.knowledgeNavigation.back, current].slice(-MAX_KNOWLEDGE_HISTORY)
                : state.knowledgeNavigation.back,
              forward: state.knowledgeNavigation.forward.slice(1),
              pending: { ...next, token },
              token,
            },
          }
        })
        return true
      },
      consumeKnowledgeNavigation: (token) => set((state) => ({
        knowledgeNavigation: state.knowledgeNavigation.pending?.token === token
          ? { ...state.knowledgeNavigation, pending: null }
          : state.knowledgeNavigation,
      })),
      setSelectedNote: (id) => id
        ? get().navigateToKnowledgeTarget({ noteId: id })
        : set({ selectedNoteId: null }),
      setSelectedNoteId: (id) => id
        ? get().navigateToKnowledgeTarget({ noteId: id })
        : set({ selectedNoteId: null }),
      setSelectedFolder: (id) => set({
        selectedFolderId: id,
        selectedTagFilter: null,
        selectedSmartViewId: null,
      }),
      setSelectedTagFilter: (tag) => set({
        selectedTagFilter: tag,
        selectedFolderId: null,
        selectedSmartViewId: null,
      }),
      setSelectedSmartView: (id) => set({
        selectedSmartViewId: id,
        selectedFolderId: null,
        selectedTagFilter: null,
        searchQuery: '',
      }),
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
        return runWorkspaceTransition(async () => {
          let username = user?.user_metadata?.username || ''
          try {
            const { data, error } = await backend.rpc('get_my_username')
            if (error) throw error
            if (typeof data === 'string') username = data
          } catch {
            // A failed profile read must not lock users out of their notes. The
            // UI shows a neutral account label until the identity can reload.
          }
          return activateWorkspace(set, get, { ...user, username }, user.id, options)
        })
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

          await purgeSharedNoteCaches(get().sharedNotes, get().cacheOwnerId)

          setActiveWorkspaceOwner(null)
          await activateIntelligenceJobOwner(null)
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
            await activateIntelligenceJobOwner(nextOwnerId)
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

      ...createSyncActions({
        set,
        get,
        runBackendSync,
        withWorkspaceSyncLock,
        getUIState: () => useUIStore.getState(),
      }),

      /**
       * Delegates to the shared filter so the store, the note list and
       * global search can never disagree about what matches.
       */
      getFilteredNotes: () => {
        const {
          notes,
          savedViews,
          selectedFolderId,
          selectedTagFilter,
          selectedSmartViewId,
          searchQuery,
        } = get()
        const savedView = savedViews.find((view) => view.id === selectedSmartViewId)
        const filtered = filterNotes(notes, {
          folderId: selectedFolderId,
          tagFilter: selectedTagFilter,
          query: searchQuery,
          scope: savedView ? getSmartViewScope(savedView) : 'active',
        })
        const viewFiltered = filterBySmartView(filtered, savedView)

        return viewFiltered.sort((a, b) => {
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
      applyExternalWorkspaceMutation: async (mutation = {}) => {
        const { ownerId, noteId = null } = mutation
        if (!ownerId || get().cacheOwnerId !== ownerId || get().hydratedWorkspaceOwnerId !== ownerId) {
          return false
        }

        if (noteId) {
          const carriesRecord = Object.hasOwn(mutation, 'record')
          const durable = carriesRecord
            ? mutation.record
            : await db.notes.get(noteId)
          if (durable !== null && durable !== undefined && durable?.id !== noteId) return false
          const state = get()
          if (state.cacheOwnerId !== ownerId) return false
          const local = state.notes.find((note) => note.id === noteId) || null
          const externalBaseline = externalNoteBaselines.get(noteId) || null

          if (local && durable && recordsHaveSameContent(local, durable)) {
            externalNoteBaselines.set(noteId, structuredClone(durable))
            if (local.syncStatus !== durable.syncStatus) {
              set((current) => ({
                notes: current.notes.map((note) => note.id === noteId ? durable : note),
              }))
            }
            return true
          }

          const locallyDiverged = local && SYNC_DIRTY_STATUSES.has(local.syncStatus) && (
            !externalBaseline || !recordsHaveSameContent(local, externalBaseline)
          )
          if (locallyDiverged) {
            // IndexedDB already contains the other tab's committed version.
            // Preserve this tab's divergent state as a recovery checkpoint
            // before asking the user which canonical version should win.
            await saveNoteVersion(local.id, local.content, local.title, local.noteData, local.noteType)
            const conflict = {
              kind: 'owned',
              source: 'tab',
              noteId,
              localUpdatedAt: local.updatedAt,
              remote: durable ? structuredClone(durable) : null,
              receivedAt: new Date().toISOString(),
            }
            set((current) => {
              const latest = current.notes.find((note) => note.id === noteId)
              if (!latest || !recordsHaveSameContent(latest, local)) return current
              return {
                notes: current.notes.map((note) =>
                  note.id === noteId ? { ...note, syncStatus: SyncStatus.CONFLICT } : note
                ),
                ...enqueueCollaborationConflict(current, conflict),
              }
            })
            return true
          }

          set((current) => {
            if (current.cacheOwnerId !== ownerId) return current
            const withoutNote = current.notes.filter((note) => note.id !== noteId)
            const notes = durable ? [durable, ...withoutNote] : withoutNote
            const selectedNoteId = current.selectedNoteId === noteId && !durable
              ? notes.find((note) => !note.deleted && !note.archived)?.id || null
              : current.selectedNoteId
            return {
              notes,
              selectedNoteId,
              ...clearCollaborationConflict(current, noteId),
              externalUpdate: { noteId, token: current.externalUpdate.token + 1 },
            }
          })
          if (durable) externalNoteBaselines.set(noteId, structuredClone(durable))
          else externalNoteBaselines.delete(noteId)
          return true
        }

        const [durableFolders, durableTags, snapshot] = await Promise.all([
          db.folders.toArray(),
          db.tags.toArray(),
          getWorkspaceSnapshot(ownerId),
        ])
        const current = get()
        if (current.cacheOwnerId !== ownerId) return false

        const sources = [
          ['folders', 'folders', durableFolders],
          ['tags', 'tags', durableTags],
          ['saved_views', 'savedViews', snapshot?.savedViews || []],
          ['note_templates', 'noteTemplates', snapshot?.noteTemplates || []],
        ]
        const updates = {}
        const conflicts = [...current.catalogConflicts]

        for (const [table, stateKey, remoteRecords] of sources) {
          const remoteById = new Map(remoteRecords.map((record) => [record.id, record]))
          const localById = new Map(current[stateKey].map((record) => [record.id, record]))
          const next = []
          for (const localRecord of current[stateKey]) {
            const remoteRecord = remoteById.get(localRecord.id) || null
            if (remoteRecord && recordsHaveSameContent(localRecord, remoteRecord)) {
              next.push(remoteRecord)
            } else if (SYNC_DIRTY_STATUSES.has(localRecord.syncStatus)) {
              next.push({ ...localRecord, syncStatus: SyncStatus.CONFLICT })
              conflicts.push({
                table,
                stateKey,
                recordId: localRecord.id,
                localUpdatedAt: localRecord.updatedAt || null,
                remote: remoteRecord ? structuredClone(remoteRecord) : null,
                detectedAt: new Date().toISOString(),
                queueSnapshots: [],
                source: 'tab',
              })
            } else if (remoteRecord) {
              next.push(remoteRecord)
            }
            remoteById.delete(localRecord.id)
          }
          for (const remoteRecord of remoteById.values()) {
            if (!localById.has(remoteRecord.id)) next.push(remoteRecord)
          }
          updates[stateKey] = next
        }

        const uniqueConflicts = conflicts.filter((conflict, index, all) =>
          all.findLastIndex((candidate) =>
            candidate.table === conflict.table && candidate.recordId === conflict.recordId
          ) === index
        )
        set({
          ...updates,
          catalogConflicts: uniqueConflicts,
          externalUpdate: { noteId: null, token: current.externalUpdate.token + 1 },
        })
        return true
      },

      applyExternalUpdate: (id, patch) => {
        let applied = false
        set((state) => {
          const shared = state.sharedNotes.find((share) => share.notes?.id === id)
          const local = shared?.notes
          const dirty = Boolean(state.sharedDraftRevisions[id]?.dirty)
          const comparableKeys = ['title', 'content', 'noteType', 'noteData'].filter((key) => Object.hasOwn(patch, key))
          const matchesLocal = local && comparableKeys.every(
            (key) => JSON.stringify(local[key] ?? null) === JSON.stringify(patch[key] ?? null)
          )
          if (shared && dirty && !matchesLocal) {
            return enqueueCollaborationConflict(state, {
                noteId: id,
                remote: structuredClone(patch),
                receivedAt: new Date().toISOString(),
              })
          }
          applied = true
          return {
            notes: state.notes.map((note) =>
              note.id === id ? { ...note, ...patch, syncStatus: SyncStatus.SYNCED } : note
            ),
            sharedNotes: state.sharedNotes.map((share) =>
              share.notes?.id === id ? { ...share, notes: { ...share.notes, ...patch } } : share
            ),
            sharedDraftRevisions: shared
              ? { ...state.sharedDraftRevisions, [id]: { revision: state.sharedDraftRevisions[id]?.revision || 0, dirty: false } }
              : state.sharedDraftRevisions,
            ...clearCollaborationConflict(state, id),
            externalUpdate: { noteId: id, token: state.externalUpdate.token + 1 },
          }
        })

        if (applied) {
          const note = get().notes.find((candidate) => candidate.id === id)
          if (note) void db.notes.put({ ...note }).then(() => notifyCanonicalContentPersisted(id))
        }
      },

      resolveCollaborationConflict: async (choice, noteId = null) => {
        const conflict = noteId
          ? (get().collaborationConflicts || []).find((candidate) => candidate.noteId === noteId)
          : (get().collaborationConflicts || [])[0] || get().collaborationConflict
        if (!conflict) return false
        if (conflict.kind === 'owned') {
          const current = get().notes.find((note) => note.id === conflict.noteId)
          if (!current) throw new Error('The conflicting note is no longer available.')
          if (!['incoming', 'local'].includes(choice)) {
            throw new Error('Choose either the local or incoming note version.')
          }

          if (conflict.source === 'tab') {
            if (current.updatedAt !== conflict.localUpdatedAt) {
              throw new Error('The local note changed after the conflict was detected. Review the conflict again.')
            }
            if (choice === 'incoming') {
              if (conflict.remote) await saveNoteOffline(conflict.remote, 'update')
              else await deleteNoteOffline(current.id)
              if (conflict.remote) externalNoteBaselines.set(current.id, structuredClone(conflict.remote))
              else externalNoteBaselines.delete(current.id)
              set((state) => {
                const notes = conflict.remote
                  ? state.notes.map((note) => note.id === current.id ? conflict.remote : note)
                  : state.notes.filter((note) => note.id !== current.id)
                return {
                  notes,
                  selectedNoteId: !conflict.remote && state.selectedNoteId === current.id
                    ? notes.find((note) => !note.deleted && !note.archived)?.id || null
                    : state.selectedNoteId,
                  ...clearCollaborationConflict(state, current.id),
                  externalUpdate: { noteId: current.id, token: state.externalUpdate.token + 1 },
                }
              })
              return true
            }
            const remoteTime = conflict.remote ? new Date(conflict.remote.updatedAt).getTime() : 0
            const chosenAt = new Date(Math.max(
              Date.now(),
              Number.isFinite(remoteTime) ? remoteTime + 3000 : 0
            )).toISOString()
            const chosen = { ...current, updatedAt: chosenAt, syncStatus: SyncStatus.PENDING }
            externalNoteBaselines.delete(current.id)
            set((state) => ({
              notes: state.notes.map((note) => note.id === current.id ? chosen : note),
              ...clearCollaborationConflict(state, current.id),
            }))
            await saveNoteOffline(chosen, conflict.remote ? 'update' : 'insert')
            if (get().user?.isLocal) return true
            return get().syncWithBackend({ notify: true })
          }

          if (choice === 'incoming') {
            if (current.updatedAt !== conflict.localUpdatedAt) {
              throw new Error('The local note changed after the conflict was detected. Review the conflict again.')
            }
            await saveNoteVersion(
              current.id,
              current.content,
              current.title,
              current.noteData,
              current.noteType
            )
            await db.transaction('rw', db.notes, db.syncQueue, async () => {
              const durable = await db.notes.get(current.id)
              if (durable?.updatedAt !== conflict.localUpdatedAt) {
                throw new Error('The durable note changed after the conflict was detected.')
              }
              if (conflict.remote) await db.notes.put(conflict.remote)
              else await db.notes.delete(current.id)
              const queued = await db.syncQueue
                .filter((item) => item.table === 'notes' && item.data?.id === current.id)
                .toArray()
              if (queued.length > 0) await db.syncQueue.bulkDelete(queued.map((item) => item.id))
            })
            set((state) => {
              const notes = conflict.remote
                ? state.notes.map((note) => note.id === current.id ? conflict.remote : note)
                : state.notes.filter((note) => note.id !== current.id)
              return {
                notes,
                selectedNoteId: !conflict.remote && state.selectedNoteId === current.id
                  ? notes.find((note) => !note.deleted && !note.archived)?.id || null
                  : state.selectedNoteId,
                ...clearCollaborationConflict(state, current.id),
                externalUpdate: { noteId: current.id, token: state.externalUpdate.token + 1 },
              }
            })
            notifyCanonicalContentPersisted(current.id)
            return true
          }
          const remoteTime = conflict.remote ? new Date(conflict.remote.updatedAt).getTime() : 0
          const chosenAt = new Date(Math.max(Date.now(), Number.isFinite(remoteTime) ? remoteTime + 3000 : 0)).toISOString()
          const chosen = { ...current, updatedAt: chosenAt, syncStatus: SyncStatus.PENDING }
          set((state) => ({
            notes: state.notes.map((note) => note.id === current.id ? chosen : note),
            ...clearCollaborationConflict(state, current.id),
          }))
          await saveNoteOffline(chosen, conflict.remote ? 'update' : 'insert')
          return get().syncWithBackend({ notify: true })
        }
        if (choice === 'incoming') {
          set((state) => ({
            sharedNotes: state.sharedNotes.map((share) => share.notes?.id === conflict.noteId
              ? { ...share, notes: { ...share.notes, ...conflict.remote } }
              : share),
            sharedDraftRevisions: {
              ...state.sharedDraftRevisions,
              [conflict.noteId]: { revision: state.sharedDraftRevisions[conflict.noteId]?.revision || 0, dirty: false },
            },
            ...clearCollaborationConflict(state, conflict.noteId),
            externalUpdate: { noteId: conflict.noteId, token: state.externalUpdate.token + 1 },
          }))
          return true
        }
        if (choice !== 'local') throw new Error('Choose either the local or incoming shared-note version.')
        const note = get().sharedNotes.find((share) => share.notes?.id === conflict.noteId)?.notes
        if (!note) throw new Error('This shared note is no longer accessible.')
        await get().updateNote(conflict.noteId, {
          title: note.title,
          content: note.content,
          noteType: note.noteType,
          noteData: note.noteData,
        })
        set((state) => clearCollaborationConflict(state, conflict.noteId))
        return true
      },

      resolveCatalogConflict: async (choice) => {
        const conflict = get().catalogConflicts[0]
        if (!conflict) return false
        if (!['incoming', 'local'].includes(choice)) {
          throw new Error('Choose either the local or incoming catalog version.')
        }

        const current = get()[conflict.stateKey]?.find(
          (record) => record.id === conflict.recordId
        )
        if (!current) throw new Error('The conflicting catalog item is no longer available.')
        if (current.updatedAt !== conflict.localUpdatedAt) {
          set((state) => ({
            catalogConflicts: state.catalogConflicts.filter(
              (candidate) => !(
                candidate.table === conflict.table &&
                candidate.recordId === conflict.recordId
              )
            ),
          }))
          throw new Error('The local item changed after the conflict was detected. Synchronize again to review the current versions.')
        }

        const nextRecord = choice === 'incoming'
          ? conflict.remote
          : {
              ...current,
              updatedAt: new Date(Math.max(
                Date.now(),
                (conflict.remote ? new Date(conflict.remote.updatedAt).getTime() || 0 : 0) + 3000
              )).toISOString(),
              syncStatus: SyncStatus.PENDING,
            }

        set((state) => ({
          [conflict.stateKey]: nextRecord
            ? state[conflict.stateKey].map((record) =>
                record.id === conflict.recordId ? nextRecord : record
              )
            : state[conflict.stateKey].filter((record) => record.id !== conflict.recordId),
          catalogConflicts: state.catalogConflicts.filter(
            (candidate) => !(
              candidate.table === conflict.table &&
              candidate.recordId === conflict.recordId
            )
          ),
        }))

        if (conflict.table === 'folders') {
          if (nextRecord) await db.folders.put(nextRecord)
          else await db.folders.delete(conflict.recordId)
        }
        if (conflict.table === 'tags') {
          if (nextRecord) await db.tags.put(nextRecord)
          else await db.tags.delete(conflict.recordId)
        }
        await queueWorkspaceSnapshot(get().cacheOwnerId, selectWorkspaceSnapshot(get()))
        notifyCanonicalContentPersisted(null, get().cacheOwnerId)

        if (choice === 'incoming') {
          for (const snapshot of conflict.queueSnapshots || []) {
            await acknowledgeSyncItem(snapshot)
          }
          return true
        }

        await addToSyncQueue(conflict.table, conflict.remote ? 'update' : 'insert', nextRecord)
        return get().syncWithBackend({ notify: true })
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
            notes: normalizeSharedNoteRecord(share.notes, acceptedShare.permission || 'view')
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
          const share = get().sharedNotes.find((candidate) => candidate.note_id === noteId)
          const { leaveSharedNote } = await import('../lib/backend')
          await leaveSharedNote(noteId)

          await purgeSharedNoteCache(
            noteId,
            share?.owner_id || share?.notes?.userId || share?.notes?.user_id,
            get().cacheOwnerId
          )
          
          set((state) => ({
            sharedNotes: state.sharedNotes.filter(s => s.note_id !== noteId),
            selectedNoteId: state.selectedNoteId === noteId ? null : state.selectedNoteId,
            ...clearCollaborationConflict(state, noteId),
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
            notes: normalizeSharedNoteRecord(share.notes, share.permission || 'view')
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

          const remoteShareKeys = new Set(normalizedShared.map((share) => `${share.note_id}:${share.owner_id || share.notes?.userId || ''}`))
          const revokedShares = get().sharedNotes.filter((share) => !remoteShareKeys.has(
            `${share.note_id}:${share.owner_id || share.notes?.userId || share.notes?.user_id || ''}`
          ))
          await purgeSharedNoteCaches(revokedShares, user.id)
          const revokedNoteIds = new Set(revokedShares.map((share) => share.note_id))
          
          set((state) => {
            const collaborationConflicts = (state.collaborationConflicts || []).filter(
              (conflict) => !revokedNoteIds.has(conflict.noteId)
            )
            return {
              sharedNotes: normalizedShared,
              pendingShares: normalizedPending,
              selectedNoteId: revokedNoteIds.has(state.selectedNoteId) ? null : state.selectedNoteId,
              collaborationConflicts,
              collaborationConflict: collaborationConflicts[0] || null,
            }
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
          corruptedNotes: state.corruptedNotes,
          folders: state.folders,
          tags: state.tags,
          savedViews: state.savedViews,
          noteTemplates: state.noteTemplates,
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
    state.corruptedNotes !== previousState.corruptedNotes ||
    state.folders !== previousState.folders ||
    state.tags !== previousState.tags ||
    state.savedViews !== previousState.savedViews ||
    state.noteTemplates !== previousState.noteTemplates ||
    state.selectedNoteId !== previousState.selectedNoteId ||
    state.selectedFolderId !== previousState.selectedFolderId ||
    state.selectedTagFilter !== previousState.selectedTagFilter ||
    state.selectedSmartViewId !== previousState.selectedSmartViewId ||
    state.searchQuery !== previousState.searchQuery ||
    state.lastSyncTime !== previousState.lastSyncTime ||
    state.isNewUser !== previousState.isNewUser

  if (!workspaceChanged) return
  void queueWorkspaceSnapshot(
    state.cacheOwnerId,
    selectWorkspaceSnapshot(state)
  ).catch(() => undefined)
})

export { useThemeStore, useUIStore } from './uiStores'
