// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloud', () => ({
  fetchRemoteSpatialWorkspace: vi.fn(),
  queueNewSpatialDocumentInTransaction: vi.fn(),
  queueSpatialChangesInTransaction: vi.fn(),
  queueSpatialWorkspaceDeletionInTransaction: vi.fn(),
}))

import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { createBoundedObject, createSpatialDocument } from './model'
import { fetchRemoteSpatialWorkspace } from './cloud'
import { loadSpatialWorkspace } from './repository'

const ownerId = '00000000-0000-4000-8000-000000000001'

const graph = (title, updatedAt, revision) => {
  const document = {
    ...createSpatialDocument('conflict-canvas', 'canvas', ownerId),
    revision,
    updatedAt,
  }
  const object = {
    ...createBoundedObject({
      noteId: document.noteId,
      kind: 'sticky',
      point: { x: 10, y: 20 },
      text: title,
      zIndex: 1,
    }),
    id: `${title.toLowerCase()}-object`,
    ownerId,
    updatedAt,
  }
  return { document, pages: [], objects: [object], resources: [] }
}

describe('spatial hydration conflict safety', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner(ownerId)
    vi.clearAllMocks()
  })

  it('does not overwrite an unsynced local graph with a clock-newer remote graph', async () => {
    const local = graph('Local', '2026-01-01T00:00:00.000Z', 2)
    const remote = graph('Remote', '2030-01-01T00:00:00.000Z', 99)
    await db.spatialDocuments.put(local.document)
    await db.spatialObjects.bulkPut(local.objects)
    await db.syncQueue.add({
      ownerId,
      table: 'spatial_documents',
      operation: 'update',
      data: { ...local.document, id: local.document.noteId },
      mutationId: 'pending-local-graph',
      timestamp: local.document.updatedAt,
    })
    fetchRemoteSpatialWorkspace.mockResolvedValue(remote)

    const opened = await loadSpatialWorkspace(local.document.noteId, 'canvas')

    expect(opened.document).toMatchObject({ revision: 2 })
    expect(opened.objects.map((object) => object.data.text)).toEqual(['Local'])
    expect(await db.spatialObjects.get('local-object')).toBeTruthy()
    expect(await db.spatialObjects.get('remote-object')).toBeUndefined()
  })

  it('hydrates a newer remote graph when no local mutation is pending', async () => {
    const local = graph('Local', '2026-01-01T00:00:00.000Z', 2)
    const remote = graph('Remote', '2026-01-02T00:00:00.000Z', 3)
    await db.spatialDocuments.put(local.document)
    await db.spatialObjects.bulkPut(local.objects)
    fetchRemoteSpatialWorkspace.mockResolvedValue(remote)

    const opened = await loadSpatialWorkspace(local.document.noteId, 'canvas')

    expect(opened.document).toMatchObject({ revision: 3 })
    expect(opened.objects.map((object) => object.data.text)).toEqual(['Remote'])
    expect(await db.spatialObjects.get('local-object')).toBeUndefined()
    expect(await db.spatialObjects.get('remote-object')).toBeTruthy()
  })
})
