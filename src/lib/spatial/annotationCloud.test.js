// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { remote, backend } = vi.hoisted(() => {
  const state = {
    rows: {
      spatial_annotations: [],
      spatial_annotation_pages: [],
      spatial_annotation_objects: [],
    },
    writes: [],
  }
  const matches = (row, filters) => filters.every(({ field, value }) => row[field] === value)
  const builderFor = (table) => {
    let operation = 'select'
    let payload = null
    const filters = []
    let limit = null
    const builder = {
      select: () => builder,
      upsert: (value) => { operation = 'upsert'; payload = value; return builder },
      delete: () => { operation = 'delete'; return builder },
      eq: (field, value) => { filters.push({ field, value }); return builder },
      order: () => builder,
      limit: (value) => { limit = value; return builder },
      then: (resolve, reject) => Promise.resolve().then(() => {
        if (operation === 'upsert') {
          const index = state.rows[table].findIndex((row) => row.id === payload.id)
          if (index >= 0) state.rows[table][index] = structuredClone(payload)
          else state.rows[table].push(structuredClone(payload))
          state.writes.push(`${table}:upsert`)
          return { data: [structuredClone(payload)], error: null }
        }
        if (operation === 'delete') {
          const deleted = state.rows[table].filter((row) => matches(row, filters))
          state.rows[table] = state.rows[table].filter((row) => !matches(row, filters))
          if (table === 'spatial_annotations') {
            const ids = new Set(deleted.map((row) => row.id))
            state.rows.spatial_annotation_pages = state.rows.spatial_annotation_pages.filter((row) => !ids.has(row.annotation_id))
            state.rows.spatial_annotation_objects = state.rows.spatial_annotation_objects.filter((row) => !ids.has(row.annotation_id))
          }
          state.writes.push(`${table}:delete`)
          return { data: deleted, error: null }
        }
        let rows = state.rows[table].filter((row) => matches(row, filters))
        if (limit != null) rows = rows.slice(0, limit)
        return { data: structuredClone(rows), error: null }
      }).then(resolve, reject),
    }
    return builder
  }
  return {
    remote: state,
    backend: {
      from: (table) => builderFor(table),
      channel: () => ({ on() { return this }, subscribe() { return this } }),
      removeChannel: async () => 'ok',
    },
  }
})

vi.mock('../backend', () => ({ backend, isBackendConfigured: () => true }))

import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { loadAnnotationWorkspace, saveAnnotationChanges } from './annotations'
import { createShapeObject } from './model'
import {
  getAnnotationConflict,
  hydrateRemoteAnnotationWorkspace,
  resolveAnnotationConflict,
  syncAnnotationQueue,
} from './annotationCloud'

const ownerId = 'annotation-owner'

describe('dedicated annotation cloud adapter', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner(ownerId)
    remote.rows.spatial_annotations = []
    remote.rows.spatial_annotation_pages = []
    remote.rows.spatial_annotation_objects = []
    remote.writes = []
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  })

  it('uploads the canonical annotation graph in dependency order and hydrates it on another local cache', async () => {
    const workspace = await loadAnnotationWorkspace({
      noteId: 'note-a', resourceId: 'resource-a', pageNumber: 1, width: 612, height: 792,
    })
    const object = createShapeObject({
      noteId: 'note-a', pageId: workspace.page.id, ownerId, shape: 'rectangle',
      start: { x: 20, y: 30 }, end: { x: 220, y: 130 }, color: '#18352a', width: 2, zIndex: 1,
    })
    await saveAnnotationChanges(workspace.document.id, { putObjects: [object] })

    await expect(syncAnnotationQueue(ownerId)).resolves.toBe(3)
    expect(remote.writes).toEqual([
      'spatial_annotations:upsert',
      'spatial_annotation_pages:upsert',
      'spatial_annotation_objects:upsert',
    ])
    expect(await db.annotationSyncState.get([ownerId, workspace.document.id])).toBeTruthy()

    await Promise.all([
      db.spatialAnnotations.clear(),
      db.spatialAnnotationPages.clear(),
      db.spatialAnnotationObjects.clear(),
      db.annotationSyncState.clear(),
    ])
    await hydrateRemoteAnnotationWorkspace({ noteId: 'note-a', resourceId: 'resource-a', ownerId })

    expect(await db.spatialAnnotations.get(workspace.document.id)).toMatchObject({ resourceId: 'resource-a', revision: 1 })
    expect(await db.spatialAnnotationPages.get(workspace.page.id)).toMatchObject({ pageNumber: 1 })
    expect(await db.spatialAnnotationObjects.get(object.id)).toMatchObject({ kind: 'shape' })
  })

  it('treats a missing previously synchronized remote graph as an authoritative deletion', async () => {
    const workspace = await loadAnnotationWorkspace({
      noteId: 'note-a', resourceId: 'resource-a', pageNumber: 1, width: 612, height: 792,
    })
    await syncAnnotationQueue(ownerId)
    remote.rows.spatial_annotations = []
    remote.rows.spatial_annotation_pages = []
    remote.rows.spatial_annotation_objects = []

    await hydrateRemoteAnnotationWorkspace({ noteId: 'note-a', resourceId: 'resource-a', ownerId })

    expect(await db.spatialAnnotations.get(workspace.document.id)).toBeUndefined()
    expect(await db.spatialAnnotationPages.where('annotationId').equals(workspace.document.id).count()).toBe(0)
    expect(await db.annotationSyncState.get([ownerId, workspace.document.id])).toBeUndefined()
  })

  it('does not erase pending local annotation edits after a remote deletion', async () => {
    const workspace = await loadAnnotationWorkspace({
      noteId: 'note-a', resourceId: 'resource-a', pageNumber: 1, width: 612, height: 792,
    })
    await syncAnnotationQueue(ownerId)
    const object = createShapeObject({
      noteId: 'note-a', pageId: workspace.page.id, ownerId, shape: 'rectangle',
      start: { x: 20, y: 30 }, end: { x: 220, y: 130 }, color: '#18352a', width: 2, zIndex: 1,
    })
    await saveAnnotationChanges(workspace.document.id, { putObjects: [object] })
    remote.rows.spatial_annotations = []
    remote.rows.spatial_annotation_pages = []
    remote.rows.spatial_annotation_objects = []

    await hydrateRemoteAnnotationWorkspace({ noteId: 'note-a', resourceId: 'resource-a', ownerId })

    expect(await db.spatialAnnotationObjects.get(object.id)).toMatchObject({ kind: 'shape' })
    expect(await getAnnotationConflict(workspace.document.id, ownerId)).toMatchObject({
      kind: 'remote-delete',
      annotationId: workspace.document.id,
    })
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBeGreaterThan(0)

    await resolveAnnotationConflict(workspace.document.id, 'incoming', ownerId)
    expect(await db.spatialAnnotations.get(workspace.document.id)).toBeUndefined()
    expect(await db.spatialAnnotationObjects.get(object.id)).toBeUndefined()
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
  })

  it('blocks annotation upload when the remote graph changed from the synced revision', async () => {
    const workspace = await loadAnnotationWorkspace({
      noteId: 'note-a', resourceId: 'resource-a', pageNumber: 1, width: 612, height: 792,
    })
    await syncAnnotationQueue(ownerId)
    const object = createShapeObject({
      noteId: 'note-a', pageId: workspace.page.id, ownerId, shape: 'line',
      start: { x: 20, y: 30 }, end: { x: 220, y: 30 }, color: '#18352a', width: 2, zIndex: 1,
    })
    await saveAnnotationChanges(workspace.document.id, { putObjects: [object] })
    remote.rows.spatial_annotations[0].revision = 2
    remote.rows.spatial_annotations[0].updated_at = '2099-01-01T00:00:00.000Z'

    await syncAnnotationQueue(ownerId)

    expect(remote.rows.spatial_annotation_objects).toHaveLength(0)
    expect(await db.spatialAnnotationObjects.get(object.id)).toBeTruthy()
    expect(await getAnnotationConflict(workspace.document.id, ownerId)).toMatchObject({
      kind: 'concurrent-update',
      remoteRevision: 2,
    })

    await resolveAnnotationConflict(workspace.document.id, 'local', ownerId)
    await syncAnnotationQueue(ownerId)
    expect(remote.rows.spatial_annotation_objects).toHaveLength(1)
    expect(await getAnnotationConflict(workspace.document.id, ownerId)).toBeNull()
  })

  it('does not report a conflict for a server timestamp change at the already-synced revision', async () => {
    const workspace = await loadAnnotationWorkspace({
      noteId: 'note-a', resourceId: 'resource-a', pageNumber: 1, width: 612, height: 792,
    })
    await syncAnnotationQueue(ownerId)
    remote.rows.spatial_annotations[0].updated_at = '2099-01-01T00:00:00.000Z'
    const object = createShapeObject({
      noteId: 'note-a', pageId: workspace.page.id, ownerId, shape: 'line',
      start: { x: 20, y: 30 }, end: { x: 220, y: 30 }, color: '#18352a', width: 2, zIndex: 1,
    })
    await saveAnnotationChanges(workspace.document.id, { putObjects: [object] })

    await syncAnnotationQueue(ownerId)

    expect(remote.rows.spatial_annotation_objects).toHaveLength(1)
    expect(await getAnnotationConflict(workspace.document.id, ownerId)).toBeNull()
  })
})
