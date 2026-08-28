// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const remote = vi.hoisted(() => ({
  rows: {
    spatial_documents: [],
    spatial_pages: [],
    spatial_objects: [],
    resources: [],
  },
  writes: [],
}))

vi.mock('../backend', () => ({
  isBackendConfigured: () => true,
  backend: {
    from: (table) => {
      let rows = [...remote.rows[table]]
      let deleting = false
      const query = {
        select: () => query,
        delete: () => { deleting = true; return query },
        eq: (field, value) => {
          rows = rows.filter((row) => row[field] === value)
          return query
        },
        in: (field, values) => { rows = rows.filter((row) => values.includes(row[field])); return query },
        order: () => query,
        limit: (count) => { rows = rows.slice(0, count); return query },
        upsert: async () => { remote.writes.push(`${table}:upsert`); return { error: null } },
        then: (resolve) => {
          if (deleting) remote.writes.push(`${table}:delete`)
          return resolve({ data: deleting ? null : rows, error: null })
        },
      }
      return query
    },
  },
}))

import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { fetchRemoteSpatialWorkspace, resolveSpatialConflict, syncSpatialQueue } from './cloud'

const ownerId = 'owner-spatial'
const noteId = 'canvas-note'
const timestamp = '2026-08-28T12:00:00.000Z'
const localDocument = (revision = 2) => ({
  noteId,
  ownerId,
  kind: 'canvas',
  schemaVersion: 1,
  revision,
  settings: {},
  viewport: { panX: 0, panY: 0, zoom: 1 },
  createdAt: timestamp,
  updatedAt: timestamp,
})
const localObject = (id, text) => ({
  id,
  noteId,
  pageId: null,
  ownerId,
  schemaVersion: 1,
  kind: 'sticky',
  zIndex: 1,
  bounds: { x: 20, y: 20, width: 180, height: 120 },
  data: { text, color: 'yellow' },
  createdAt: timestamp,
  updatedAt: timestamp,
})
const remoteDocument = (revision = 2) => ({
  note_id: noteId,
  user_id: ownerId,
  kind: 'canvas',
  schema_version: 1,
  revision,
  settings: {},
  viewport: { panX: 0, panY: 0, zoom: 1 },
  created_at: timestamp,
  updated_at: '2026-08-28T13:00:00.000Z',
})
const remoteObject = (id, text) => ({
  id,
  note_id: noteId,
  page_id: null,
  user_id: ownerId,
  schema_version: 1,
  kind: 'sticky',
  z_index: 1,
  bounds: { x: 20, y: 20, width: 180, height: 120 },
  data: { text, color: 'yellow' },
  created_at: timestamp,
  updated_at: '2026-08-28T13:00:00.000Z',
})

describe('Paper/Canvas same-owner conflict safety', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner(ownerId)
    remote.rows.spatial_documents = [remoteDocument(2)]
    remote.rows.spatial_pages = []
    remote.rows.spatial_objects = []
    remote.rows.resources = []
    remote.writes = []
  })

  it('blocks queued graph mutations when the remote revision advanced', async () => {
    await db.spatialDocuments.put(localDocument(2))
    await db.spatialSyncState.put({ ownerId, noteId, revision: 1, lastSyncedAt: timestamp })
    await db.syncQueue.bulkAdd([
      { ownerId, table: 'spatial_objects', operation: 'delete', data: { id: 'object-a', noteId }, timestamp, mutationId: 'mutation-object' },
      { ownerId, table: 'spatial_documents', operation: 'update', data: { ...localDocument(2), id: noteId }, timestamp, mutationId: 'mutation-document' },
    ])

    expect(await syncSpatialQueue(ownerId)).toBe(0)
    expect(remote.writes).toEqual([])
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(2)
    expect((await db.spatialSyncState.get([ownerId, noteId])).conflict).toMatchObject({
      kind: 'concurrent-update',
      remoteRevision: 2,
    })
  })

  it('lets an explicit parent permanent deletion win over a later remote graph revision', async () => {
    remote.rows.spatial_documents = [remoteDocument(9)]
    await db.syncQueue.add({
      ownerId,
      table: 'spatial_documents',
      operation: 'delete',
      data: { id: noteId },
      timestamp,
      mutationId: 'mutation-document-delete',
    })

    expect(await syncSpatialQueue(ownerId)).toBe(1)
    expect(remote.writes).toEqual(['spatial_documents:delete'])
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
    expect(await db.spatialSyncState.get([ownerId, noteId])).toBeUndefined()
  })

  it('keeps reviewed local mutations while merging untouched remote objects', async () => {
    const localChanged = localObject('object-local', 'Local edit')
    await db.spatialDocuments.put(localDocument(2))
    await db.spatialObjects.put(localChanged)
    await db.spatialSyncState.put({
      ownerId,
      noteId,
      revision: 1,
      lastSyncedAt: timestamp,
      conflict: { kind: 'concurrent-update', noteId },
    })
    await db.syncQueue.bulkAdd([
      { ownerId, table: 'spatial_objects', operation: 'update', data: localChanged, timestamp, mutationId: 'mutation-object' },
      { ownerId, table: 'spatial_documents', operation: 'update', data: { ...localDocument(2), id: noteId }, timestamp, mutationId: 'mutation-document' },
    ])
    remote.rows.spatial_objects = [
      remoteObject('object-local', 'Remote conflicting edit'),
      remoteObject('object-remote-only', 'Remote addition'),
    ]

    expect((await fetchRemoteSpatialWorkspace(noteId)).objects.map((object) => object.id)).toEqual([
      'object-local',
      'object-remote-only',
    ])

    await resolveSpatialConflict(noteId, 'local', ownerId)

    expect(await db.spatialObjects.get('object-local')).toMatchObject({ data: { text: 'Local edit' } })
    expect(await db.spatialObjects.get('object-remote-only')).toMatchObject({ data: { text: 'Remote addition' } })
    expect(await db.spatialDocuments.get(noteId)).toMatchObject({ revision: 3 })
    expect((await db.spatialSyncState.get([ownerId, noteId])).conflict).toBeNull()
  })

  it('applies a reviewed remote deletion atomically', async () => {
    await db.spatialDocuments.put(localDocument(2))
    await db.spatialObjects.put(localObject('object-local', 'Recoverable until review'))
    await db.spatialSyncState.put({
      ownerId,
      noteId,
      revision: 1,
      lastSyncedAt: timestamp,
      conflict: { kind: 'remote-delete', noteId },
    })
    await db.syncQueue.add({
      ownerId,
      table: 'spatial_documents',
      operation: 'update',
      data: { ...localDocument(2), id: noteId },
      timestamp,
      mutationId: 'mutation-document',
    })
    remote.rows.spatial_documents = []

    const result = await resolveSpatialConflict(noteId, 'incoming', ownerId)

    expect(result.remoteExists).toBe(false)
    expect(await db.spatialDocuments.get(noteId)).toBeUndefined()
    expect(await db.spatialObjects.get('object-local')).toBeUndefined()
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
    expect(await db.spatialSyncState.get([ownerId, noteId])).toBeUndefined()
  })
})
