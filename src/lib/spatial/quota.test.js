// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backend', () => ({
  isBackendConfigured: () => true,
  backend: {
    from: vi.fn(() => {
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        then: (resolve) => resolve({ data: [], error: null }),
      }
      return query
    }),
  },
}))

import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { createStrokeObject } from './model'
import {
  deleteSpatialWorkspace,
  duplicateSpatialWorkspace,
  loadSpatialWorkspace,
  saveSpatialChanges,
} from './repository'

const ownerId = '00000000-0000-4000-8000-000000000001'
const quotaError = () => new DOMException('Browser storage is full', 'QuotaExceededError')

describe('spatial quota failure atomicity', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner(ownerId)
  })

  it('does not create an unjournaled spatial document', async () => {
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(quotaError())

    await expect(loadSpatialWorkspace('quota-create', 'canvas')).rejects.toMatchObject({ name: 'QuotaExceededError' })

    expect(await db.spatialDocuments.get('quota-create')).toBeUndefined()
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
  })

  it('rolls back a completed stroke when its outbox write fails', async () => {
    const workspace = await loadSpatialWorkspace('quota-edit', 'canvas')
    await db.syncQueue.clear()
    const stroke = createStrokeObject({
      noteId: 'quota-edit',
      points: [[1, 2, 0.5, 0, 0, 0], [8, 9, 0.6, 0, 0, 10]],
      brush: 'pen',
      color: '#18352a',
      width: 2.5,
      opacity: 1,
      zIndex: 1,
    })
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(quotaError())

    await expect(saveSpatialChanges('quota-edit', { putObjects: [stroke] })).rejects.toMatchObject({ name: 'QuotaExceededError' })

    expect(await db.spatialObjects.get(stroke.id)).toBeUndefined()
    expect(await db.spatialDocuments.get('quota-edit')).toMatchObject({ revision: workspace.document.revision })
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
  })

  it('rolls back duplication when any outbox row cannot be stored', async () => {
    const source = await loadSpatialWorkspace('quota-source', 'canvas')
    const stroke = createStrokeObject({
      noteId: source.document.noteId,
      points: [[1, 2, 0.5, 0, 0, 0], [8, 9, 0.6, 0, 0, 10]],
      brush: 'pen', color: '#18352a', width: 2.5, opacity: 1, zIndex: 1,
    })
    await saveSpatialChanges(source.document.noteId, { putObjects: [stroke] })
    await db.syncQueue.clear()
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(quotaError())

    await expect(duplicateSpatialWorkspace('quota-source', 'quota-copy')).rejects.toMatchObject({ name: 'QuotaExceededError' })

    expect(await db.spatialDocuments.get('quota-copy')).toBeUndefined()
    expect(await db.spatialObjects.where('noteId').equals('quota-copy').count()).toBe(0)
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
  })

  it('rolls back destructive graph deletion when its tombstone cannot be journaled', async () => {
    await loadSpatialWorkspace('quota-delete', 'paper')
    const before = await db.spatialPages.where('noteId').equals('quota-delete').toArray()
    await db.syncQueue.clear()
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(quotaError())

    await expect(deleteSpatialWorkspace('quota-delete')).rejects.toMatchObject({ name: 'QuotaExceededError' })

    expect(await db.spatialDocuments.get('quota-delete')).toBeTruthy()
    expect(await db.spatialPages.where('noteId').equals('quota-delete').toArray()).toEqual(before)
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
  })
})
