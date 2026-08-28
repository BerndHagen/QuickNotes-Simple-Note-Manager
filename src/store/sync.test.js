import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backendHarness = vi.hoisted(() => ({
  calls: [],
  onExecute: null,
  signOutError: null,
  signOutThrows: null,
  tables: {
    folders: [],
    tags: [],
    notes: [],
    saved_views: [],
    note_templates: [],
  },
}))

vi.mock('../lib/backend', () => {
  const matchesFilters = (row, filters) =>
    filters.every(([column, value]) => row[column] === value)

  const createQuery = (table) => {
    let operation = 'select'
    let payload = null
    const filters = []

    const execute = async () => {
      if (backendHarness.onExecute) {
        await backendHarness.onExecute({ table, operation, payload, filters: [...filters] })
      }
      backendHarness.calls.push({ table, operation, payload, filters: [...filters] })

      if (operation === 'delete') {
        backendHarness.tables[table] = backendHarness.tables[table].filter(
          (row) => !matchesFilters(row, filters)
        )
        return { data: null, error: null }
      }

      if (operation === 'upsert') {
        const records = Array.isArray(payload) ? payload : [payload]
        for (const record of records) {
          const existingIndex = backendHarness.tables[table].findIndex(
            (candidate) => candidate.id === record.id
          )
          if (existingIndex === -1) backendHarness.tables[table].push({ ...record })
          else backendHarness.tables[table][existingIndex] = { ...record }
        }
        return { data: records.map((record) => ({ ...record })), error: null }
      }

      return {
        data: backendHarness.tables[table]
          .filter((row) => matchesFilters(row, filters))
          .map((row) => ({ ...row })),
        error: null,
      }
    }

    const query = {
      select: () => query,
      upsert: (data) => {
        operation = 'upsert'
        payload = data
        return query
      },
      delete: () => {
        operation = 'delete'
        return query
      },
      eq: (column, value) => {
        filters.push([column, value])
        return query
      },
      then: (resolve, reject) => execute().then(resolve, reject),
      catch: (reject) => execute().catch(reject),
    }

    return query
  }

  return {
    backend: {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-1' } } },
        })),
        signOut: vi.fn(async () => {
          if (backendHarness.signOutThrows) throw backendHarness.signOutThrows
          return { error: backendHarness.signOutError }
        }),
      },
      from: vi.fn(createQuery),
    },
    isBackendConfigured: () => true,
    getSharedNotes: vi.fn(async () => []),
    getPendingShares: vi.fn(async () => []),
  }
})

vi.mock('../lib/capture/cloud', () => ({
  CAPTURE_RESOURCE_QUEUE_TABLE: 'capture_resources',
  syncCaptureCloud: vi.fn(async () => ({ skipped: false })),
}))

import {
  addToSyncQueue,
  clearLocalData,
  db,
  getPendingSyncItems,
  SyncStatus,
} from '../lib/db'
import { backend } from '../lib/backend'
import { useNotesStore, useUIStore } from './index'

const timestamp = (seconds) => `2026-01-01T00:00:${String(seconds).padStart(2, '0')}.000Z`

const localNote = (overrides = {}) => ({
  id: 'note-1',
  title: 'Local note',
  content: '<p>Local</p>',
  folderId: null,
  tags: [],
  starred: false,
  pinned: false,
  deleted: false,
  archived: false,
  noteType: 'standard',
  noteData: null,
  createdAt: timestamp(0),
  updatedAt: timestamp(10),
  syncStatus: SyncStatus.SYNCED,
  ...overrides,
})

const remoteNote = (overrides = {}) => ({
  id: 'note-1',
  user_id: 'user-1',
  title: 'Cloud note',
  content: '<p>Cloud</p>',
  folder_id: null,
  tags: [],
  starred: false,
  pinned: false,
  deleted: false,
  archived: false,
  note_type: 'standard',
  note_data: null,
  sort_order: null,
  created_at: timestamp(0),
  updated_at: timestamp(20),
  ...overrides,
})

const resetStore = (overrides = {}) => {
  useNotesStore.setState({
    notes: [],
    folders: [],
    tags: [],
    savedViews: [],
    noteTemplates: [],
    selectedNoteId: null,
    selectedFolderId: null,
    selectedTagFilter: null,
    selectedSmartViewId: null,
    searchQuery: '',
    isSyncing: false,
    lastSyncTime: null,
    lastSyncError: null,
    catalogConflicts: [],
    collaborationConflict: null,
    collaborationConflicts: [],
    hydratedWorkspaceOwnerId: 'user-1',
    isOnline: true,
    user: { id: 'user-1', isLocal: false },
    sharedNotes: [],
    pendingShares: [],
    cacheOwnerId: 'user-1',
    ...overrides,
  })
}

const writesFor = (table) =>
  backendHarness.calls.filter(
    (call) => call.table === table && ['upsert', 'delete'].includes(call.operation)
  )

describe('cloud synchronization reconciliation', () => {
  beforeEach(async () => {
    await clearLocalData()
    backendHarness.calls.length = 0
    backendHarness.onExecute = null
    backendHarness.signOutError = null
    backendHarness.signOutThrows = null
    backendHarness.tables.folders = []
    backendHarness.tables.tags = []
    backendHarness.tables.notes = []
    backendHarness.tables.saved_views = []
    backendHarness.tables.note_templates = []
    backend.auth.signOut.mockClear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    resetStore()
    useUIStore.setState({ showSyncNotifications: false })
  })

  afterEach(async () => {
    await clearLocalData()
  })

  it('coalesces simultaneous synchronization requests into one backend run', async () => {
    backend.auth.getSession.mockClear()

    const first = useNotesStore.getState().syncWithBackend()
    const second = useNotesStore.getState().syncWithBackend()

    expect(second).toBe(first)
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(backend.auth.getSession).toHaveBeenCalledTimes(1)
  })

  it('removes a clean local note that was deleted by another client', async () => {
    const note = localNote()
    resetStore({ notes: [note] })
    await db.notes.put(note)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().notes).toEqual([])
    expect(await db.notes.get(note.id)).toBeUndefined()
    expect(writesFor('notes')).toEqual([])
  })

  it('requires an explicit choice instead of discarding stale offline content', async () => {
    const note = localNote({ syncStatus: SyncStatus.PENDING })
    resetStore({ notes: [note] })
    backendHarness.tables.notes = [remoteNote()]
    await db.notes.put(note)
    await addToSyncQueue('notes', 'update', { id: note.id })

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().notes[0]).toEqual(
      expect.objectContaining({ title: 'Local note', syncStatus: SyncStatus.CONFLICT })
    )
    expect(useNotesStore.getState().collaborationConflict).toEqual(expect.objectContaining({
      kind: 'owned',
      noteId: note.id,
      remote: expect.objectContaining({ title: 'Cloud note' }),
    }))
    expect(writesFor('notes')).toEqual([])
    expect(await getPendingSyncItems()).toHaveLength(1)
    expect(await db.notes.get(note.id)).toEqual(expect.objectContaining({
      title: 'Local note',
      syncStatus: SyncStatus.CONFLICT,
    }))

    await expect(useNotesStore.getState().resolveCollaborationConflict('incoming')).resolves.toBe(true)
    expect(useNotesStore.getState().notes[0]).toEqual(
      expect.objectContaining({ title: 'Cloud note', syncStatus: SyncStatus.SYNCED })
    )
    expect(await getPendingSyncItems()).toEqual([])
    expect(await db.noteVersions.where('noteId').equals(note.id).count()).toBe(1)
  })

  it('keeps an update-only note after a remote deletion until the user accepts it', async () => {
    const note = localNote({ syncStatus: SyncStatus.PENDING })
    resetStore({ notes: [note], selectedNoteId: note.id })
    await db.notes.put(note)
    await addToSyncQueue('notes', 'update', note)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().notes[0]).toEqual(expect.objectContaining({
      title: 'Local note',
      syncStatus: SyncStatus.CONFLICT,
    }))
    expect(useNotesStore.getState().collaborationConflict).toEqual(expect.objectContaining({
      kind: 'owned',
      noteId: note.id,
      remote: null,
    }))
    expect(await db.notes.get(note.id)).toBeDefined()
    expect(await getPendingSyncItems()).toHaveLength(1)

    await expect(useNotesStore.getState().resolveCollaborationConflict('incoming')).resolves.toBe(true)
    expect(useNotesStore.getState().notes).toEqual([])
    expect(useNotesStore.getState().selectedNoteId).toBeNull()
    expect(await db.notes.get(note.id)).toBeUndefined()
    expect(await getPendingSyncItems()).toEqual([])
    expect(await db.noteVersions.where('noteId').equals(note.id).count()).toBe(1)
  })

  it('reconstructs a remote-deletion conflict after reload and can intentionally restore local', async () => {
    const note = localNote({ syncStatus: SyncStatus.CONFLICT })
    resetStore({ notes: [note], collaborationConflict: null, collaborationConflicts: [] })
    await db.notes.put(note)
    await addToSyncQueue('notes', 'update', note)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)
    expect(useNotesStore.getState().collaborationConflict).toEqual(expect.objectContaining({
      noteId: note.id,
      remote: null,
    }))

    await expect(useNotesStore.getState().resolveCollaborationConflict('local')).resolves.toBe(true)
    expect(backendHarness.tables.notes).toEqual([
      expect.objectContaining({ id: note.id, title: note.title }),
    ])
    expect(useNotesStore.getState().notes[0].syncStatus).toBe(SyncStatus.SYNCED)
    expect(await getPendingSyncItems()).toEqual([])
  })

  it('uploads a pending local create and marks the canonical note synced', async () => {
    const note = localNote({ syncStatus: SyncStatus.PENDING })
    resetStore({ notes: [note] })
    await db.notes.put(note)
    await addToSyncQueue('notes', 'insert', note)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(writesFor('notes')).toHaveLength(1)
    expect(backendHarness.tables.notes[0]).toEqual(
      expect.objectContaining({ id: note.id, title: note.title, user_id: 'user-1' })
    )
    expect(useNotesStore.getState().notes[0].syncStatus).toBe(SyncStatus.SYNCED)
    expect(await getPendingSyncItems()).toEqual([])
  })

  it('retains a newer note mutation queued while an older upload is in flight', async () => {
    const note = localNote({ syncStatus: SyncStatus.PENDING })
    resetStore({ notes: [note] })
    await db.notes.put(note)
    await addToSyncQueue('notes', 'insert', note)

    backendHarness.onExecute = async ({ table, operation }) => {
      if (table !== 'notes' || operation !== 'upsert') return
      backendHarness.onExecute = null
      const edited = {
        ...note,
        title: 'Edited during upload',
        // Two writes can legitimately share one millisecond. Sync must use
        // mutation identity rather than timestamps to distinguish them.
        updatedAt: note.updatedAt,
        syncStatus: SyncStatus.PENDING,
      }
      useNotesStore.setState({ notes: [edited] })
      await db.notes.put(edited)
      await addToSyncQueue('notes', 'update', edited)
    }

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().notes[0]).toEqual(expect.objectContaining({
      title: 'Edited during upload',
      syncStatus: SyncStatus.PENDING,
    }))
    expect(await getPendingSyncItems()).toEqual([
      expect.objectContaining({
        table: 'notes',
        operation: 'insert',
        data: expect.objectContaining({ title: 'Edited during upload' }),
      }),
    ])
  })

  it('rolls back the canonical note when its outbox write fails', async () => {
    const note = localNote()
    resetStore({ notes: [note] })
    await db.notes.put(note)
    const add = vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(new Error('quota exceeded'))

    await expect(
      useNotesStore.getState().updateNote(note.id, { title: 'Must not partially persist' })
    ).rejects.toThrow('quota exceeded')
    add.mockRestore()

    expect(await db.notes.get(note.id)).toEqual(expect.objectContaining({
      title: 'Local note',
      syncStatus: SyncStatus.SYNCED,
    }))
    expect(await getPendingSyncItems()).toEqual([])
    expect(useNotesStore.getState().persistenceError).toEqual(expect.objectContaining({
      source: 'indexeddb',
    }))
  })

  it('syncs Smart Views and reusable templates as tenant-owned collections', async () => {
    const savedView = {
      id: 'view-1',
      name: 'Recent projects',
      icon: 'ListFilter',
      color: '#0f766e',
      criteria: {
        match: 'all',
        scope: 'active',
        sort: 'updated-desc',
        rules: [{ id: 'rule-1', field: 'noteType', operator: 'is', value: 'project' }],
      },
      order: 0,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    const template = {
      id: 'template-1',
      name: 'Project kickoff',
      description: 'Reusable delivery plan',
      noteType: 'project',
      titleTemplate: '{{date}} · Project kickoff',
      content: '',
      noteData: { columns: [] },
      tags: ['project'],
      favorite: true,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    resetStore({ savedViews: [savedView], noteTemplates: [template] })
    await addToSyncQueue('saved_views', 'insert', savedView)
    await addToSyncQueue('note_templates', 'insert', template)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(writesFor('saved_views')).toHaveLength(1)
    expect(backendHarness.tables.saved_views[0]).toEqual(expect.objectContaining({
      id: savedView.id,
      user_id: 'user-1',
      name: savedView.name,
    }))
    expect(writesFor('note_templates')).toHaveLength(1)
    expect(backendHarness.tables.note_templates[0]).toEqual(expect.objectContaining({
      id: template.id,
      user_id: 'user-1',
      note_type: 'project',
    }))
    expect(useNotesStore.getState().savedViews[0].syncStatus).toBe(SyncStatus.SYNCED)
    expect(useNotesStore.getState().noteTemplates[0].syncStatus).toBe(SyncStatus.SYNCED)
    expect(await getPendingSyncItems()).toEqual([])
  })

  it('downloads cloud Smart Views and templates into an empty local workspace', async () => {
    backendHarness.tables.saved_views = [{
      id: 'view-cloud',
      user_id: 'user-1',
      name: 'Cloud view',
      icon: 'ListFilter',
      color: '#2563eb',
      criteria: { match: 'all', scope: 'active', sort: 'updated-desc', rules: [] },
      sort_order: 2,
      created_at: timestamp(0),
      updated_at: timestamp(20),
    }]
    backendHarness.tables.note_templates = [{
      id: 'template-cloud',
      user_id: 'user-1',
      name: 'Cloud template',
      description: 'Synced elsewhere',
      note_type: 'standard',
      title_template: '{{date}} · Notes',
      content: '<p>Agenda</p>',
      note_data: null,
      tags: ['meeting'],
      favorite: false,
      created_at: timestamp(0),
      updated_at: timestamp(20),
    }]

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().savedViews).toEqual([
      expect.objectContaining({ id: 'view-cloud', name: 'Cloud view', order: 2 }),
    ])
    expect(useNotesStore.getState().noteTemplates).toEqual([
      expect.objectContaining({ id: 'template-cloud', content: '<p>Agenda</p>' }),
    ])
    expect(writesFor('saved_views')).toEqual([])
    expect(writesFor('note_templates')).toEqual([])
  })

  it('does not recreate clean folders or tags deleted by another client', async () => {
    const folder = {
      id: 'folder-1',
      name: 'Deleted folder',
      parentId: null,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.SYNCED,
    }
    const tag = {
      id: 'tag-1',
      name: 'deleted-tag',
      color: '#123456',
      createdAt: timestamp(0),
      syncStatus: SyncStatus.SYNCED,
    }
    resetStore({ folders: [folder], tags: [tag] })
    await db.folders.put(folder)
    await db.tags.put(tag)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().folders).toEqual([])
    expect(useNotesStore.getState().tags).toEqual([])
    expect(await db.folders.get(folder.id)).toBeUndefined()
    expect(await db.tags.get(tag.id)).toBeUndefined()
    expect(writesFor('folders')).toEqual([])
    expect(writesFor('tags')).toEqual([])
  })

  it('requires an explicit choice instead of discarding a stale folder edit', async () => {
    const folder = {
      id: 'folder-1',
      name: 'Stale local name',
      parentId: null,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    resetStore({ folders: [folder] })
    backendHarness.tables.folders = [
      {
        id: folder.id,
        user_id: 'user-1',
        name: 'New cloud name',
        icon: 'Folder',
        color: '#123456',
        parent_id: null,
        created_at: timestamp(0),
        updated_at: timestamp(20),
      },
    ]
    await db.folders.put(folder)
    await addToSyncQueue('folders', 'update', { id: folder.id, name: folder.name })

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().folders).toEqual([
      expect.objectContaining({ name: 'Stale local name', syncStatus: SyncStatus.CONFLICT }),
    ])
    expect(useNotesStore.getState().catalogConflicts).toEqual([
      expect.objectContaining({
        table: 'folders',
        recordId: folder.id,
        remote: expect.objectContaining({ name: 'New cloud name' }),
      }),
    ])
    expect(writesFor('folders')).toEqual([])
    expect(await getPendingSyncItems()).toHaveLength(1)

    await expect(useNotesStore.getState().resolveCatalogConflict('incoming')).resolves.toBe(true)
    expect(useNotesStore.getState().folders).toEqual([
      expect.objectContaining({ name: 'New cloud name', syncStatus: SyncStatus.SYNCED }),
    ])
    expect(useNotesStore.getState().catalogConflicts).toEqual([])
    expect(await getPendingSyncItems()).toEqual([])
  })

  it('requires review for a folder edit that meets a remote deletion', async () => {
    const folder = {
      id: 'folder-1',
      name: 'Offline rename',
      parentId: null,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    resetStore({ folders: [folder], selectedFolderId: folder.id })
    await db.folders.put(folder)
    await addToSyncQueue('folders', 'update', folder)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)
    expect(useNotesStore.getState().folders[0]).toEqual(expect.objectContaining({
      name: 'Offline rename',
      syncStatus: SyncStatus.CONFLICT,
    }))
    expect(useNotesStore.getState().catalogConflicts[0]).toEqual(expect.objectContaining({
      table: 'folders',
      recordId: folder.id,
      remote: null,
    }))
    expect(await db.folders.get(folder.id)).toBeDefined()
    expect(await getPendingSyncItems()).toHaveLength(1)

    await expect(useNotesStore.getState().resolveCatalogConflict('incoming')).resolves.toBe(true)
    expect(useNotesStore.getState().folders).toEqual([])
    expect(await db.folders.get(folder.id)).toBeUndefined()
    expect(await getPendingSyncItems()).toEqual([])
  })

  it('intentionally recreates a deleted Smart View only after choosing the local version', async () => {
    const savedView = {
      id: 'view-deleted-remotely',
      name: 'Offline view edit',
      icon: 'ListFilter',
      color: '#0f766e',
      criteria: { match: 'all', scope: 'active', sort: 'updated-desc', rules: [] },
      order: 0,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    resetStore({ savedViews: [savedView] })
    await addToSyncQueue('saved_views', 'update', savedView)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)
    expect(useNotesStore.getState().catalogConflicts[0]).toEqual(expect.objectContaining({
      table: 'saved_views',
      remote: null,
    }))
    expect(writesFor('saved_views')).toEqual([])

    await expect(useNotesStore.getState().resolveCatalogConflict('local')).resolves.toBe(true)
    expect(backendHarness.tables.saved_views).toEqual([
      expect.objectContaining({ id: savedView.id, name: savedView.name }),
    ])
    expect(useNotesStore.getState().savedViews[0].syncStatus).toBe(SyncStatus.SYNCED)
  })

  it('preserves a stale Smart View until the user resolves its cloud conflict', async () => {
    const savedView = {
      id: 'view-1',
      name: 'Local criteria',
      icon: 'ListFilter',
      color: '#0f766e',
      criteria: { match: 'all', scope: 'active', sort: 'updated-desc', rules: [] },
      order: 0,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    resetStore({ savedViews: [savedView] })
    backendHarness.tables.saved_views = [{
      id: savedView.id,
      user_id: 'user-1',
      name: 'Cloud criteria',
      icon: 'ListFilter',
      color: '#2563eb',
      criteria: { match: 'any', scope: 'active', sort: 'title-asc', rules: [] },
      sort_order: 0,
      created_at: timestamp(0),
      updated_at: timestamp(20),
    }]
    await addToSyncQueue('saved_views', 'update', savedView)

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().savedViews[0]).toEqual(expect.objectContaining({
      name: 'Local criteria',
      syncStatus: SyncStatus.CONFLICT,
    }))
    expect(useNotesStore.getState().catalogConflicts).toEqual([
      expect.objectContaining({ table: 'saved_views', recordId: savedView.id }),
    ])
    expect(await getPendingSyncItems()).toHaveLength(1)

    await expect(useNotesStore.getState().resolveCatalogConflict('local')).resolves.toBe(true)
    expect(useNotesStore.getState().catalogConflicts).toEqual([])
    expect(backendHarness.tables.saved_views[0].name).toBe('Local criteria')
  })

  it('does not discard a tag edit made while synchronization is running', async () => {
    const tag = {
      id: 'tag-1',
      name: 'before-sync',
      color: '#123456',
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    resetStore({ tags: [tag] })
    backendHarness.tables.tags = [{
      id: tag.id,
      user_id: 'user-1',
      name: tag.name,
      color: tag.color,
      created_at: timestamp(0),
      updated_at: timestamp(5),
    }]
    await db.tags.put(tag)
    await addToSyncQueue('tags', 'update', tag)
    backendHarness.onExecute = ({ table, operation }) => {
      if (table !== 'tags' || operation !== 'upsert') return
      backendHarness.onExecute = null
      useNotesStore.getState().updateTag(tag.id, { name: 'during-sync' })
    }

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().tags).toEqual([
      expect.objectContaining({ name: 'during-sync', syncStatus: SyncStatus.PENDING }),
    ])
    expect((await getPendingSyncItems()).some(
      (item) => item.table === 'tags' && item.data.name === 'during-sync'
    )).toBe(true)
  })

  it('does not discard a folder edit made while synchronization is running', async () => {
    const folder = {
      id: 'folder-1',
      name: 'First local edit',
      parentId: null,
      createdAt: timestamp(0),
      updatedAt: timestamp(10),
      syncStatus: SyncStatus.PENDING,
    }
    resetStore({ folders: [folder] })
    backendHarness.tables.folders = [
      {
        id: folder.id,
        user_id: 'user-1',
        name: 'Original cloud name',
        icon: 'Folder',
        color: '#123456',
        parent_id: null,
        created_at: timestamp(0),
        updated_at: timestamp(5),
      },
    ]
    await db.folders.put(folder)
    await addToSyncQueue('folders', 'update', { id: folder.id, name: folder.name })
    backendHarness.onExecute = ({ table, operation }) => {
      if (table !== 'folders' || operation !== 'upsert') return
      backendHarness.onExecute = null
      useNotesStore.getState().updateFolder(folder.id, { name: 'Edit during sync' })
    }

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().folders).toEqual([
      expect.objectContaining({ name: 'Edit during sync', syncStatus: SyncStatus.PENDING }),
    ])
    expect((await getPendingSyncItems()).some(
      (item) => item.table === 'folders' && item.data.name === 'Edit during sync'
    )).toBe(true)
  })
})

describe('cloud sign-out data safety', () => {
  beforeEach(async () => {
    await clearLocalData()
    backendHarness.calls.length = 0
    backendHarness.onExecute = null
    backendHarness.signOutError = null
    backendHarness.signOutThrows = null
    backendHarness.tables.folders = []
    backendHarness.tables.tags = []
    backendHarness.tables.notes = []
    backend.auth.signOut.mockClear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    resetStore()
    useUIStore.setState({ showSyncNotifications: false })
  })

  afterEach(async () => {
    await clearLocalData()
  })

  it('cancels offline sign-out and retains unsynced data', async () => {
    const note = localNote({ syncStatus: SyncStatus.PENDING })
    resetStore({ notes: [note] })
    await db.notes.put(note)
    await addToSyncQueue('notes', 'insert', note)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    expect(await useNotesStore.getState().logout()).toBe(false)

    expect(useNotesStore.getState().user).toEqual(expect.objectContaining({ id: 'user-1' }))
    expect(useNotesStore.getState().notes).toHaveLength(1)
    expect(await db.notes.get(note.id)).toBeDefined()
    expect(await getPendingSyncItems()).toHaveLength(1)
    expect(backend.auth.signOut).not.toHaveBeenCalled()
  })

  it('syncs pending data before completing sign-out', async () => {
    const note = localNote({ syncStatus: SyncStatus.PENDING })
    resetStore({ notes: [note] })
    await db.notes.put(note)
    await addToSyncQueue('notes', 'insert', note)

    expect(await useNotesStore.getState().logout()).toBe(true)

    expect(backendHarness.tables.notes).toEqual([
      expect.objectContaining({ id: note.id, title: note.title }),
    ])
    expect(useNotesStore.getState().user).toBeNull()
    expect(useNotesStore.getState().notes).toEqual([])
    expect(await db.notes.count()).toBe(0)
    expect(await getPendingSyncItems()).toEqual([])
    expect(backend.auth.signOut).toHaveBeenCalledOnce()
  })

  it('retains local data when the authentication service rejects sign-out', async () => {
    const note = localNote()
    resetStore({ notes: [note] })
    await db.notes.put(note)
    backendHarness.signOutError = new Error('Session could not be revoked')

    expect(await useNotesStore.getState().logout()).toBe(false)

    expect(useNotesStore.getState().user).toEqual(expect.objectContaining({ id: 'user-1' }))
    expect(useNotesStore.getState().notes).toHaveLength(1)
    expect(await db.notes.get(note.id)).toBeDefined()
  })

  it('retains local data when sign-out throws', async () => {
    const note = localNote()
    resetStore({ notes: [note] })
    await db.notes.put(note)
    backendHarness.signOutThrows = new Error('Network unavailable')

    expect(await useNotesStore.getState().logout()).toBe(false)

    expect(useNotesStore.getState().user).toEqual(expect.objectContaining({ id: 'user-1' }))
    expect(useNotesStore.getState().notes).toHaveLength(1)
    expect(await db.notes.get(note.id)).toBeDefined()
  })
})
