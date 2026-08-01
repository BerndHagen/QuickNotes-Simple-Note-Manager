import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalData,
  db,
  getNoteVersions,
  getPendingSyncItems,
  getWorkspaceSnapshot,
  saveNoteVersion,
} from '../lib/db'
import { useNotesStore } from './index'

const localUser = {
  id: 'quicknotes-local-workspace',
  isLocal: true,
  email: '',
}

const cloudUser = {
  id: 'cloud-user',
  isLocal: false,
  email: 'person@example.com',
}

const resetStore = () => {
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
    user: null,
    sharedNotes: [],
    pendingShares: [],
    cacheOwnerId: null,
    hydratedWorkspaceOwnerId: null,
    persistenceError: null,
    isNewUser: false,
  })
}

const waitForQueue = async (title) => {
  await vi.waitFor(async () => {
    expect((await getPendingSyncItems()).some(
      (item) => item.table === 'notes' && item.data.title === title
    )).toBe(true)
  })
}

describe('owner-scoped offline workspace persistence', () => {
  beforeEach(async () => {
    await clearLocalData()
    resetStore()
  })

  afterEach(async () => {
    if (useNotesStore.getState().cacheOwnerId) {
      await useNotesStore.getState().deactivateWorkspace()
    }
    await clearLocalData()
    resetStore()
  })

  it('preserves separate local and cloud workspaces across owner switches', async () => {
    expect(await useNotesStore.getState().activateLocalUser(localUser)).toBe(true)
    useNotesStore.getState().createNote({ title: 'Local-only note' })
    await waitForQueue('Local-only note')
    await useNotesStore.getState().persistWorkspace()

    expect(await useNotesStore.getState().activateCloudUser(cloudUser)).toBe(true)
    expect(useNotesStore.getState().notes).toEqual([])
    expect(await getPendingSyncItems()).toEqual([])

    useNotesStore.getState().createNote({ title: 'Cloud-only note' })
    await waitForQueue('Cloud-only note')
    await useNotesStore.getState().persistWorkspace()

    expect(await useNotesStore.getState().activateLocalUser(localUser)).toBe(true)
    expect(useNotesStore.getState().notes.map((note) => note.title)).toEqual([
      'Local-only note',
    ])
    expect((await getPendingSyncItems()).map((item) => item.data.title)).toContain(
      'Local-only note'
    )

    expect(await useNotesStore.getState().activateCloudUser(cloudUser)).toBe(true)
    expect(useNotesStore.getState().notes.map((note) => note.title)).toEqual([
      'Cloud-only note',
    ])
    expect((await getPendingSyncItems()).map((item) => item.data.title)).toContain(
      'Cloud-only note'
    )
  })

  it('recovers a workspace from Dexie when the localStorage mirror is empty', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    useNotesStore.getState().createNote({ title: 'Recoverable note' })
    await waitForQueue('Recoverable note')
    await useNotesStore.getState().persistWorkspace()
    expect((await getWorkspaceSnapshot('local')).notes).toHaveLength(1)

    await useNotesStore.getState().deactivateWorkspace()
    useNotesStore.setState({
      notes: [],
      folders: [],
      tags: [],
      cacheOwnerId: 'local',
      hydratedWorkspaceOwnerId: null,
    })
    localStorage.removeItem('quicknotes-storage')

    expect(await useNotesStore.getState().activateLocalUser(localUser)).toBe(true)
    expect(useNotesStore.getState().notes).toEqual([
      expect.objectContaining({ title: 'Recoverable note' }),
    ])
  })

  it('does not overwrite a saved owner when startup metadata is stale', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    useNotesStore.getState().createNote({ title: 'Preserved local note' })
    await useNotesStore.getState().persistWorkspace()

    await useNotesStore.getState().activateCloudUser(cloudUser)
    useNotesStore.getState().createNote({ title: 'Preserved cloud note' })
    await useNotesStore.getState().persistWorkspace()
    await useNotesStore.getState().deactivateWorkspace()

    useNotesStore.setState({
      notes: [],
      folders: [],
      tags: [],
      cacheOwnerId: 'local',
      hydratedWorkspaceOwnerId: null,
    })

    expect(await useNotesStore.getState().activateCloudUser(cloudUser)).toBe(true)
    expect((await getWorkspaceSnapshot('local')).notes).toEqual([
      expect.objectContaining({ title: 'Preserved local note' }),
    ])
    expect(useNotesStore.getState().notes).toEqual([
      expect.objectContaining({ title: 'Preserved cloud note' }),
    ])
  })

  it('surfaces localStorage quota failures while retaining the Dexie snapshot', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    useNotesStore.getState().createNote({ title: 'Large durable note' })

    await vi.waitFor(() => {
      expect(useNotesStore.getState().persistenceError).toEqual(
        expect.objectContaining({ source: 'localstorage' })
      )
    })
    setItem.mockRestore()
    expect(await useNotesStore.getState().persistWorkspace()).toBe(true)
    expect((await getWorkspaceSnapshot('local')).notes).toEqual([
      expect.objectContaining({ title: 'Large durable note' }),
    ])
    expect(JSON.parse(localStorage.getItem('quicknotes-storage')).state.notes).toBeUndefined()
  })

  it('deletes only the requested owner and leaves other workspace snapshots intact', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    useNotesStore.getState().createNote({ title: 'Keep local' })
    await useNotesStore.getState().persistWorkspace()

    await useNotesStore.getState().activateCloudUser(cloudUser)
    useNotesStore.getState().createNote({ title: 'Delete cloud' })
    await useNotesStore.getState().persistWorkspace()

    expect(await useNotesStore.getState().deleteWorkspace(cloudUser.id, { deactivate: true })).toBe(true)
    expect(await getWorkspaceSnapshot(cloudUser.id)).toBeNull()
    expect((await getWorkspaceSnapshot('local')).notes).toEqual([
      expect.objectContaining({ title: 'Keep local' }),
    ])

    expect(await useNotesStore.getState().activateLocalUser(localUser)).toBe(true)
    expect(useNotesStore.getState().notes.map((note) => note.title)).toEqual(['Keep local'])
  })

  it('keeps version histories isolated when two owners use the same note id', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    await saveNoteVersion('shared-id', '<p>Local version</p>', 'Local title')

    await useNotesStore.getState().activateCloudUser(cloudUser)
    await saveNoteVersion('shared-id', '<p>Cloud version</p>', 'Cloud title')
    expect(await getNoteVersions('shared-id')).toEqual([
      expect.objectContaining({ title: 'Cloud title' }),
    ])

    await useNotesStore.getState().activateLocalUser(localUser)
    expect(await getNoteVersions('shared-id')).toEqual([
      expect.objectContaining({ title: 'Local title' }),
    ])
  })

  it('adopts pre-upgrade queue and version records into the first restored owner', async () => {
    await db.syncQueue.add({
      table: 'notes',
      operation: 'insert',
      data: { id: 'legacy-note', title: 'Legacy note' },
      timestamp: new Date().toISOString(),
    })
    await db.noteVersions.add({
      noteId: 'legacy-note',
      title: 'Legacy version',
      content: '<p>Legacy</p>',
      createdAt: new Date().toISOString(),
    })

    expect(await useNotesStore.getState().activateLocalUser(localUser)).toBe(true)

    expect(await getPendingSyncItems()).toEqual([
      expect.objectContaining({ ownerId: 'local', data: expect.objectContaining({ id: 'legacy-note' }) }),
    ])
    expect(await getNoteVersions('legacy-note')).toEqual([
      expect.objectContaining({ ownerId: 'local', title: 'Legacy version' }),
    ])
  })

  it('imports a workspace backup as one durable owner-scoped operation', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)

    const counts = await useNotesStore.getState().importWorkspaceBackup({
      format: 'quicknotes-workspace-backup',
      schemaVersion: 1,
      folders: [{ id: 'source-folder', name: 'Imported folder' }],
      tags: [{ id: 'source-tag', name: 'restored', color: '#047857' }],
      notes: [{
        id: 'source-note',
        title: 'Imported note',
        content: '<p>Durable content</p>',
        folderId: 'source-folder',
        tags: ['restored'],
      }],
    })

    expect(counts).toEqual({ notes: 1, folders: 1, tags: 1 })
    const state = useNotesStore.getState()
    expect(state.notes[0]).toMatchObject({
      title: 'Imported note',
      folderId: state.folders[0].id,
      tags: ['restored'],
      syncStatus: 'pending',
    })
    expect(await db.notes.get(state.notes[0].id)).toMatchObject({ title: 'Imported note' })
    expect((await getWorkspaceSnapshot('local')).notes).toEqual([
      expect.objectContaining({ title: 'Imported note' }),
    ])
    expect(await getPendingSyncItems()).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerId: 'local', table: 'notes', operation: 'insert' }),
      expect.objectContaining({ ownerId: 'local', table: 'folders', operation: 'insert' }),
      expect.objectContaining({ ownerId: 'local', table: 'tags', operation: 'insert' }),
    ]))
  })
})
