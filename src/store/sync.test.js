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
    selectedNoteId: null,
    selectedFolderId: null,
    selectedTagFilter: null,
    searchQuery: '',
    isSyncing: false,
    lastSyncTime: null,
    lastSyncError: null,
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
    backend.auth.signOut.mockClear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    resetStore()
    useUIStore.setState({ showSyncNotifications: false })
  })

  afterEach(async () => {
    await clearLocalData()
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

  it('keeps a newer cloud update instead of uploading stale offline content', async () => {
    const note = localNote({ syncStatus: SyncStatus.PENDING })
    resetStore({ notes: [note] })
    backendHarness.tables.notes = [remoteNote()]
    await db.notes.put(note)
    await addToSyncQueue('notes', 'update', { id: note.id })

    expect(await useNotesStore.getState().syncWithBackend()).toBe(true)

    expect(useNotesStore.getState().notes[0]).toEqual(
      expect.objectContaining({ title: 'Cloud note', syncStatus: SyncStatus.SYNCED })
    )
    expect(writesFor('notes')).toEqual([])
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

  it('keeps a newer cloud folder instead of overwriting it with a stale edit', async () => {
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
      expect.objectContaining({ name: 'New cloud name', syncStatus: SyncStatus.SYNCED }),
    ])
    expect(writesFor('folders')).toEqual([])
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
