import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalData, db, getPendingSyncItems, setActiveWorkspaceOwner, SyncStatus } from '../lib/db'
import { MAX_NOTE_TITLE_LENGTH } from '../lib/dataValidation'
import { useNotesStore } from './index'

const resetStore = (overrides = {}) => {
  setActiveWorkspaceOwner(overrides.cacheOwnerId || 'local')
  useNotesStore.setState({
    notes: [],
    folders: [],
    tags: [],
    selectedNoteId: null,
    selectedFolderId: null,
    selectedTagFilter: null,
    searchQuery: '',
    sharedNotes: [],
    pendingShares: [],
    sharedDraftRevisions: {},
    collaborationConflict: null,
    collaborationConflicts: [],
    cacheOwnerId: 'local',
    hydratedWorkspaceOwnerId: 'local',
    ...overrides,
  })

}

const waitForQueuedWrite = async (predicate) => {
  await vi.waitFor(async () => {
    expect((await getPendingSyncItems()).some(predicate)).toBe(true)
  })
}

describe('notes store data invariants', () => {
  beforeEach(async () => {
    await clearLocalData()
    resetStore()
  })

  afterEach(async () => {
    await clearLocalData()
  })

  it('requires an explicit choice when an inbound shared edit conflicts with a local draft', async () => {
    const sharedNote = {
      id: 'shared-note',
      title: 'Shared plan',
      content: '<p>Original</p>',
      noteType: 'standard',
      noteData: null,
      isShared: true,
      sharePermission: 'edit',
    }
    resetStore({
      selectedNoteId: sharedNote.id,
      sharedNotes: [{ id: 'share-a', note_id: sharedNote.id, permission: 'edit', notes: sharedNote }],
    })

    useNotesStore.getState().updateNoteDraft(sharedNote.id, { content: '<p>My unsaved draft</p>' })
    useNotesStore.getState().applyExternalUpdate(sharedNote.id, {
      content: '<p>Incoming collaborator edit</p>',
      updatedAt: '2026-08-28T10:00:00.000Z',
    })

    expect(useNotesStore.getState().getSelectedNote().content).toBe('<p>My unsaved draft</p>')
    expect(useNotesStore.getState().collaborationConflict).toMatchObject({ noteId: sharedNote.id })

    await expect(useNotesStore.getState().resolveCollaborationConflict('incoming')).resolves.toBe(true)
    expect(useNotesStore.getState().getSelectedNote().content).toBe('<p>Incoming collaborator edit</p>')
    expect(useNotesStore.getState().collaborationConflict).toBeNull()
  })

  it('respects an explicit unfiled note even when a folder is selected', () => {
    resetStore({ selectedFolderId: 'work' })

    const unfiled = useNotesStore.getState().createNote({ title: 'Inbox', folderId: null })
    const contextual = useNotesStore.getState().createNote({ title: 'Contextual' })

    expect(unfiled.folderId).toBeNull()
    expect(contextual.folderId).toBe('work')
  })

  it('initializes every starter record as a pending cloud create', async () => {
    useNotesStore.getState().initializeStarterContent()

    const { notes, folders, tags } = useNotesStore.getState()
    expect([...notes, ...folders, ...tags].every(
      (record) => record.syncStatus === SyncStatus.PENDING
    )).toBe(true)
    await vi.waitFor(async () => {
      const queued = await getPendingSyncItems()
      expect(queued.filter((item) => item.operation === 'insert')).toHaveLength(
        notes.length + folders.length + tags.length
      )
    })
  })

  it('keeps duplicate titles within the database limit', () => {
    resetStore({
      notes: [
        {
          id: 'source',
          title: 'T'.repeat(MAX_NOTE_TITLE_LENGTH),
          content: '',
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          syncStatus: SyncStatus.SYNCED,
        },
      ],
    })

    useNotesStore.getState().duplicateNote('source')

    const duplicate = useNotesStore.getState().notes.find((note) => note.id !== 'source')
    expect(duplicate.title).toHaveLength(MAX_NOTE_TITLE_LENGTH)
    expect(duplicate.title.endsWith('(Copy)')).toBe(true)
  })

  it('marks every affected note pending when a tag is renamed', async () => {
    resetStore({
      notes: [
        {
          id: 'tagged',
          title: 'Tagged',
          content: '',
          tags: ['old'],
          updatedAt: '2026-01-01T00:00:00.000Z',
          syncStatus: SyncStatus.SYNCED,
        },
        {
          id: 'untagged',
          title: 'Untagged',
          content: '',
          tags: [],
          updatedAt: '2026-01-01T00:00:00.000Z',
          syncStatus: SyncStatus.SYNCED,
        },
      ],
      tags: [{ id: 'tag', name: 'old', color: '#000000', syncStatus: SyncStatus.SYNCED }],
    })

    useNotesStore.getState().updateTag('tag', { name: 'new' })

    const tagged = useNotesStore.getState().notes.find((note) => note.id === 'tagged')
    const untagged = useNotesStore.getState().notes.find((note) => note.id === 'untagged')
    expect(tagged.tags).toEqual(['new'])
    expect(tagged.syncStatus).toBe(SyncStatus.PENDING)
    expect(tagged.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
    expect(untagged.syncStatus).toBe(SyncStatus.SYNCED)
    await waitForQueuedWrite(
      (item) => item.table === 'notes' && item.operation === 'update' && item.data.id === 'tagged'
    )
  })

  it('marks every affected note pending when a tag is deleted', async () => {
    resetStore({
      notes: [
        {
          id: 'tagged',
          title: 'Tagged',
          content: '',
          tags: ['remove', 'keep'],
          updatedAt: '2026-01-01T00:00:00.000Z',
          syncStatus: SyncStatus.SYNCED,
        },
      ],
      tags: [{ id: 'tag', name: 'remove', color: '#000000', syncStatus: SyncStatus.SYNCED }],
    })

    useNotesStore.getState().deleteTag('tag')

    const note = useNotesStore.getState().notes[0]
    expect(note.tags).toEqual(['keep'])
    expect(note.syncStatus).toBe(SyncStatus.PENDING)
    await waitForQueuedWrite(
      (item) => item.table === 'notes' && item.operation === 'update' && item.data.id === 'tagged'
    )
  })

  it('queues repeated soft deletion once and keeps the local tombstone timestamps consistent', async () => {
    resetStore({
      user: null,
      notes: [
        {
          id: 'delete-once',
          title: 'Delete once',
          content: '',
          tags: [],
          deleted: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          syncStatus: SyncStatus.SYNCED,
        },
      ],
    })

    useNotesStore.getState().deleteNote('delete-once')
    useNotesStore.getState().deleteNote('delete-once')

    await vi.waitFor(async () => {
      const queued = (await getPendingSyncItems()).filter((item) => item.data?.id === 'delete-once')
      expect(queued).toHaveLength(1)
      expect(queued[0].operation).toBe('update')
    })
    const stateNote = useNotesStore.getState().notes[0]
    const cachedNote = await db.notes.get('delete-once')
    expect(stateNote).toMatchObject({ deleted: true, syncStatus: SyncStatus.PENDING })
    expect(cachedNote.deletedAt).toBe(stateNote.deletedAt)
    expect(cachedNote.updatedAt).toBe(stateNote.updatedAt)
  })

  it('coalesces rapid delete and restore into one ordered durable mutation', async () => {
    resetStore({
      notes: [{
        id: 'delete-restore',
        title: 'Keep this note',
        content: '<p>Canonical</p>',
        tags: [],
        deleted: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        syncStatus: SyncStatus.SYNCED,
      }],
    })

    useNotesStore.getState().deleteNote('delete-restore')
    useNotesStore.getState().restoreNote('delete-restore')

    await vi.waitFor(async () => {
      const queued = (await getPendingSyncItems()).filter((item) => item.data?.id === 'delete-restore')
      expect(queued).toHaveLength(1)
      expect(queued[0]).toMatchObject({ operation: 'update', data: { deleted: false, deletedAt: null } })
    })
    expect(useNotesStore.getState().notes[0]).toMatchObject({ deleted: false, deletedAt: null })
    expect(await db.notes.get('delete-restore')).toMatchObject({ deleted: false, deletedAt: null })
  })

  it('replaces a cloud insert with an idempotent delete when an offline note is removed', async () => {
    resetStore({ user: null })
    const created = useNotesStore.getState().createNote({ title: 'Never uploaded' })
    await useNotesStore.getState().permanentlyDeleteNote(created.id)

    await vi.waitFor(async () => {
      const queued = (await getPendingSyncItems()).filter((item) => item.data?.id === created.id)
      expect(queued).toHaveLength(1)
      expect(queued[0].operation).toBe('delete')
    })
    expect(useNotesStore.getState().notes).toEqual([])
    expect(await db.notes.get(created.id)).toBeUndefined()
  })

  it('reparents children and unfiles notes when deleting a folder', async () => {
    resetStore({
      folders: [
        { id: 'grandparent', name: 'Grandparent', parentId: null, syncStatus: SyncStatus.SYNCED },
        { id: 'parent', name: 'Parent', parentId: 'grandparent', syncStatus: SyncStatus.SYNCED },
        { id: 'child', name: 'Child', parentId: 'parent', syncStatus: SyncStatus.SYNCED },
      ],
      notes: [
        {
          id: 'note',
          title: 'In parent',
          content: '',
          folderId: 'parent',
          tags: [],
          syncStatus: SyncStatus.SYNCED,
        },
      ],
    })

    useNotesStore.getState().deleteFolder('parent')

    expect(useNotesStore.getState().folders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'child',
          parentId: 'grandparent',
          syncStatus: SyncStatus.PENDING,
        }),
      ])
    )
    expect(useNotesStore.getState().notes[0]).toEqual(
      expect.objectContaining({ folderId: null, syncStatus: SyncStatus.PENDING })
    )
    await waitForQueuedWrite(
      (item) => item.table === 'folders' && item.operation === 'update' && item.data.id === 'child'
    )
  })

  it('does not assign synthetic order values to notes outside a reordered view', () => {
    resetStore({
      notes: [
        { id: 'visible-a', order: 0 },
        { id: 'visible-b', order: 1 },
        { id: 'hidden' },
      ],
    })

    useNotesStore.getState().reorderNotes(['visible-b', 'visible-a'])

    expect(useNotesStore.getState().notes.find((note) => note.id === 'hidden').order).toBeUndefined()
  })
})
