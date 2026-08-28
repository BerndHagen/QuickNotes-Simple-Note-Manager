import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalData,
  db,
  getNoteVersions,
  getPendingSyncItems,
  getWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  deleteNoteOffline,
  saveNoteOffline,
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
    corruptedNotes: [],
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
    collaborationConflict: null,
    collaborationConflicts: [],
    catalogConflicts: [],
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

  it('isolates a malformed note without deleting its raw canonical row', async () => {
    const healthy = {
      id: 'healthy-note',
      title: 'Healthy',
      content: '<p>Readable</p>',
      noteType: 'standard',
      tags: [],
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:00.000Z',
      syncStatus: 'synced',
    }
    const malformed = {
      ...healthy,
      id: 'malformed-note',
      title: 'Do not discard',
      content: { unexpected: '<p>raw payload</p>' },
    }
    await saveWorkspaceSnapshot('local', {
      notes: [healthy, malformed],
      folders: [],
      tags: [],
      savedViews: [],
      noteTemplates: [],
    })

    expect(await useNotesStore.getState().activateLocalUser(localUser)).toBe(true)
    expect(useNotesStore.getState().notes.map((note) => note.id)).toEqual(['healthy-note'])
    expect(useNotesStore.getState().corruptedNotes).toEqual([
      expect.objectContaining({
        entityId: 'malformed-note',
        reason: 'The note document body is not text.',
        raw: malformed,
      }),
    ])
    expect(await db.notes.get('malformed-note')).toEqual(malformed)

    await useNotesStore.getState().persistWorkspace()
    expect((await getWorkspaceSnapshot('local')).notes).toEqual([
      expect.objectContaining({ ...healthy, contentKind: 'document', contentSchemaVersion: 1 }),
      malformed,
    ])
  })

  it('requires review and checkpoints a stale tab before accepting another tab note update', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const note = useNotesStore.getState().createNote({ title: 'Original', content: '<p>Original</p>' })
    await waitForQueue('Original')

    const incoming = {
      ...note,
      title: 'Other tab',
      content: '<p>Other tab content</p>',
      updatedAt: '2026-08-28T12:00:00.000Z',
      syncStatus: 'pending',
    }
    await saveNoteOffline(incoming)
    const stale = {
      ...note,
      title: 'My tab',
      content: '<p>Unsaved tab content</p>',
      updatedAt: '2026-08-28T11:59:00.000Z',
      syncStatus: 'pending',
    }
    useNotesStore.setState({ notes: [stale], selectedNoteId: note.id })

    await expect(useNotesStore.getState().applyExternalWorkspaceMutation({
      ownerId: 'local',
      noteId: note.id,
    })).resolves.toBe(true)

    expect(useNotesStore.getState().notes[0]).toEqual(expect.objectContaining({
      title: 'My tab',
      syncStatus: 'conflict',
    }))
    expect(useNotesStore.getState().collaborationConflicts).toEqual([
      expect.objectContaining({ source: 'tab', noteId: note.id, remote: incoming }),
    ])
    expect(await getNoteVersions(note.id)).toEqual([
      expect.objectContaining({ title: 'My tab', content: '<p>Unsaved tab content</p>' }),
    ])

    await expect(
      useNotesStore.getState().resolveCollaborationConflict('incoming', note.id)
    ).resolves.toBe(true)
    expect(useNotesStore.getState().notes[0]).toEqual(incoming)
    expect(useNotesStore.getState().collaborationConflicts).toEqual([])
    expect(await db.notes.get(note.id)).toEqual(incoming)
  })

  it('keeps a stale tab note recoverable when another tab deletes it', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const note = useNotesStore.getState().createNote({ title: 'Delete race', content: '<p>Keep me</p>' })
    await waitForQueue('Delete race')
    const stale = {
      ...note,
      title: 'Still editing',
      updatedAt: '2026-08-28T11:59:00.000Z',
      syncStatus: 'pending',
    }
    await deleteNoteOffline(note.id)
    useNotesStore.setState({ notes: [stale], selectedNoteId: note.id })

    await useNotesStore.getState().applyExternalWorkspaceMutation({ ownerId: 'local', noteId: note.id })
    expect(useNotesStore.getState().collaborationConflicts[0]).toEqual(
      expect.objectContaining({ source: 'tab', remote: null })
    )
    expect(await getNoteVersions(note.id)).toEqual([
      expect.objectContaining({ title: 'Still editing' }),
    ])

    await useNotesStore.getState().resolveCollaborationConflict('incoming', note.id)
    expect(useNotesStore.getState().notes).toEqual([])
    expect(useNotesStore.getState().selectedNoteId).toBeNull()
  })

  it('serializes simultaneous note conflicts instead of dropping the first one', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const first = useNotesStore.getState().createNote({ title: 'First' })
    const second = useNotesStore.getState().createNote({ title: 'Second' })
    await waitForQueue('First')
    await waitForQueue('Second')
    const localNotes = [first, second].map((note) => ({
      ...note,
      title: `${note.title} local`,
      syncStatus: 'pending',
    }))
    await saveNoteOffline({ ...first, title: 'First remote' })
    await saveNoteOffline({ ...second, title: 'Second remote' })
    useNotesStore.setState({ notes: localNotes })

    await useNotesStore.getState().applyExternalWorkspaceMutation({ ownerId: 'local', noteId: first.id })
    await useNotesStore.getState().applyExternalWorkspaceMutation({ ownerId: 'local', noteId: second.id })

    expect(useNotesStore.getState().collaborationConflicts.map((conflict) => conflict.noteId)).toEqual([
      first.id,
      second.id,
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

  it('keeps all existing recovery versions if retention fails while adding the replacement', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    for (let index = 0; index < 30; index += 1) {
      await db.noteVersions.add({
        ownerId: 'local',
        noteId: 'quota-version-note',
        title: `Version ${index}`,
        content: `<p>${index}</p>`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      })
    }
    const before = await db.noteVersions
      .where('[ownerId+noteId]')
      .equals(['local', 'quota-version-note'])
      .toArray()
    const add = vi.spyOn(db.noteVersions, 'add').mockRejectedValueOnce(
      new DOMException('Storage is full', 'QuotaExceededError')
    )

    await expect(saveNoteVersion(
      'quota-version-note',
      '<p>new version</p>',
      'Replacement'
    )).rejects.toThrow('Storage is full')
    add.mockRestore()

    expect(await db.noteVersions
      .where('[ownerId+noteId]')
      .equals(['local', 'quota-version-note'])
      .toArray()).toEqual(before)
    const ordered = await getNoteVersions('quota-version-note')
    expect(ordered[0].title).toBe('Version 29')
    expect(ordered.at(-1).title).toBe('Version 0')
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

  it('permanently deletes one complete canonical graph and its workspace snapshot atomically', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const note = useNotesStore.getState().createNote({ title: 'Delete complete graph' })
    await waitForQueue('Delete complete graph')
    await saveNoteVersion(note.id, '<p>Earlier</p>', 'Earlier')
    await Promise.all([
      db.spatialDocuments.put({ noteId: note.id, ownerId: 'local', kind: 'canvas' }),
      db.spatialPages.put({ id: 'page-delete', noteId: note.id, ownerId: 'local', order: 0 }),
      db.resources.put({ id: 'resource-delete', ownerId: 'local', kind: 'image', data: 'data:image/png;base64,AA==' }),
      db.resourceBlobs.put({ resourceId: 'resource-delete', ownerId: 'local', data: new Blob(['payload']) }),
      db.noteResources.put({ id: 'link-delete', noteId: note.id, resourceId: 'resource-delete', ownerId: 'local' }),
      db.recordingSessions.put({ id: 'recording-delete', noteId: note.id, ownerId: 'local', status: 'recording' }),
      db.recognizedContent.put({ id: 'recognition-delete', noteId: note.id, ownerId: 'local', sourceResourceId: 'resource-delete' }),
      db.spatialAnnotations.put({ id: 'annotation-delete', noteId: note.id, resourceId: 'resource-delete', ownerId: 'local' }),
      db.searchDocuments.put({ ownerId: 'local', noteId: note.id }),
      db.knowledgeLinks.put({ id: 'knowledge-delete', ownerId: 'local', sourceNoteId: note.id, targetNoteId: 'other-note' }),
      db.semanticEmbeddings.put({ id: 'semantic-delete', ownerId: 'local', noteId: note.id }),
      db.captureSyncState.put({ ownerId: 'local', conflicts: [{ id: 'conflict-delete', noteId: note.id }] }),
    ])
    await Promise.all([
      db.spatialObjects.put({ id: 'object-delete', noteId: note.id, pageId: 'page-delete', ownerId: 'local', kind: 'image', data: { resourceId: 'resource-delete' } }),
      db.resourceChunks.add({ ownerId: 'local', recordingId: 'recording-delete', sequence: 0, data: new Blob(['chunk']) }),
      db.spatialAnnotationPages.put({ id: 'annotation-page-delete', annotationId: 'annotation-delete', noteId: note.id, resourceId: 'resource-delete', ownerId: 'local' }),
    ])
    await db.spatialAnnotationObjects.put({
      id: 'annotation-object-delete', annotationId: 'annotation-delete', pageId: 'annotation-page-delete',
      noteId: note.id, resourceId: 'resource-delete', ownerId: 'local', kind: 'stroke',
    })

    await expect(useNotesStore.getState().permanentlyDeleteNote(note.id)).resolves.toBe(true)

    expect(useNotesStore.getState().notes).toEqual([])
    expect(await db.notes.get(note.id)).toBeUndefined()
    expect(await getNoteVersions(note.id)).toEqual([])
    expect(await db.spatialDocuments.get(note.id)).toBeUndefined()
    expect(await db.spatialObjects.where('noteId').equals(note.id).count()).toBe(0)
    expect(await db.spatialAnnotations.where('noteId').equals(note.id).count()).toBe(0)
    expect(await db.noteResources.where('noteId').equals(note.id).count()).toBe(0)
    expect(await db.recognizedContent.where('noteId').equals(note.id).count()).toBe(0)
    expect(await db.recordingSessions.where('noteId').equals(note.id).count()).toBe(0)
    expect(await db.resourceChunks.where('recordingId').equals('recording-delete').count()).toBe(0)
    expect(await db.resources.get('resource-delete')).toBeUndefined()
    expect(await db.resourceBlobs.get('resource-delete')).toBeUndefined()
    expect(await db.searchDocuments.get(['local', note.id])).toBeUndefined()
    expect(await db.knowledgeLinks.get('knowledge-delete')).toBeUndefined()
    expect(await db.semanticEmbeddings.get('semantic-delete')).toBeUndefined()
    expect((await db.captureSyncState.get('local')).conflicts).toEqual([])
    expect((await getWorkspaceSnapshot('local')).notes).toEqual([])
  })

  it('keeps the note and its graph visible when permanent deletion cannot journal the tombstone', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const note = useNotesStore.getState().createNote({ title: 'Deletion must roll back' })
    await waitForQueue('Deletion must roll back')
    await db.syncQueue.clear()
    await db.spatialDocuments.put({ noteId: note.id, ownerId: 'local', kind: 'canvas' })
    const add = vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(
      new DOMException('Storage quota exceeded', 'QuotaExceededError')
    )

    await expect(useNotesStore.getState().permanentlyDeleteNote(note.id)).resolves.toBe(false)

    add.mockRestore()
    expect(useNotesStore.getState().notes).toEqual([
      expect.objectContaining({ id: note.id, title: 'Deletion must roll back' }),
    ])
    expect(await db.notes.get(note.id)).toBeTruthy()
    expect(await db.spatialDocuments.get(note.id)).toBeTruthy()
    expect(useNotesStore.getState().persistenceError).toEqual(
      expect.objectContaining({ source: 'indexeddb' })
    )
  })

  it('does not reintroduce a note into the workspace snapshot when permanent deletions overlap', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const first = useNotesStore.getState().createNote({ title: 'Delete first' })
    const second = useNotesStore.getState().createNote({ title: 'Delete second' })
    await waitForQueue('Delete first')
    await waitForQueue('Delete second')

    await Promise.all([
      useNotesStore.getState().permanentlyDeleteNote(first.id),
      useNotesStore.getState().permanentlyDeleteNote(second.id),
    ])

    expect(useNotesStore.getState().notes).toEqual([])
    expect((await getWorkspaceSnapshot('local')).notes).toEqual([])
    expect(await db.notes.count()).toBe(0)
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

    expect(counts).toEqual({
      notes: 1,
      folders: 1,
      tags: 1,
      savedViews: 0,
      noteTemplates: 0,
    })
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

  it('rolls back every imported row when the outbox write fails midway', async () => {
    await useNotesStore.getState().activateLocalUser(localUser)
    const queueWrite = vi.spyOn(db.syncQueue, 'bulkAdd').mockRejectedValueOnce(new Error('quota exhausted'))

    await expect(useNotesStore.getState().importWorkspaceBackup({
      format: 'quicknotes-workspace-backup',
      schemaVersion: 1,
      folders: [{ id: 'source-folder', name: 'Must roll back' }],
      tags: [{ id: 'source-tag', name: 'rollback' }],
      notes: [{ id: 'source-note', title: 'Must not survive', folderId: 'source-folder' }],
    })).rejects.toThrow('could not be saved')
    queueWrite.mockRestore()

    expect(useNotesStore.getState().notes).toEqual([])
    expect(await db.notes.count()).toBe(0)
    expect(await db.folders.count()).toBe(0)
    expect(await db.tags.count()).toBe(0)
    expect(await getPendingSyncItems()).toEqual([])
    expect((await getWorkspaceSnapshot('local'))?.notes || []).toEqual([])
  })
})
