// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fake, backend } = vi.hoisted(() => {
  const state = {
    rows: {
      resources: [],
      note_resources: [],
      recognized_content: [],
    },
    storage: new Map(),
    standardUploads: 0,
    resumableUploads: 0,
    tusOptions: null,
  }
  const matches = (row, filters) => filters.every(({ kind, field, value }) =>
    kind === 'eq' ? row[field] === value : value.includes(row[field])
  )
  const builderFor = (table) => {
    let operation = 'select'
    let payload = null
    let filters = []
    let range = null
    const builder = {
      select: () => builder,
      upsert: (value) => {
        operation = 'upsert'
        payload = value
        return builder
      },
      delete: () => {
        operation = 'delete'
        return builder
      },
      eq: (field, value) => {
        filters.push({ kind: 'eq', field, value })
        return builder
      },
      in: (field, value) => {
        filters.push({ kind: 'in', field, value })
        return builder
      },
      order: () => builder,
      limit: (count) => {
        range = [0, count - 1]
        return builder
      },
      range: (start, end) => {
        range = [start, end]
        return builder
      },
      then: (resolve, reject) => Promise.resolve().then(() => {
        if (operation === 'upsert') {
          const values = Array.isArray(payload) ? payload : [payload]
          for (const value of values) {
            const index = state.rows[table].findIndex((row) => row.id === value.id)
            if (index >= 0) state.rows[table][index] = structuredClone(value)
            else state.rows[table].push(structuredClone(value))
          }
          return { data: values, error: null }
        }
        if (operation === 'delete') {
          const matched = state.rows[table].filter((row) => matches(row, filters))
          const blocked = table === 'resources' && matched.some((resource) =>
            state.rows.note_resources.some((row) => row.resource_id === resource.id)
          )
          if (!blocked) state.rows[table] = state.rows[table].filter((row) => !matches(row, filters))
          return { data: blocked ? [] : structuredClone(matched), error: null }
        }
        let data = state.rows[table].filter((row) => matches(row, filters))
        data = [...data].sort((left, right) => String(left.id).localeCompare(String(right.id)))
        if (range) data = data.slice(range[0], range[1] + 1)
        return { data: structuredClone(data), error: null }
      }).then(resolve, reject),
    }
    return builder
  }
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'capture-test-token' } },
        error: null,
      }),
    },
    from: (table) => builderFor(table),
    storage: {
      from: () => ({
        upload: async (path, blob) => {
          state.standardUploads += 1
          state.storage.set(path, blob)
          return { data: { path }, error: null }
        },
        download: async (path) => ({
          data: state.storage.get(path) || null,
          error: state.storage.has(path) ? null : { status: 404, message: 'Missing' },
        }),
        remove: async (paths) => {
          paths.forEach((path) => state.storage.delete(path))
          return { data: paths, error: null }
        },
      }),
    },
    channel: () => ({
      on() { return this },
      subscribe() { return this },
    }),
    removeChannel: async () => 'ok',
  }
  return { fake: state, backend: client }
})

vi.mock('../backend', () => ({
  backend,
  getBackendResumableUploadEndpoint: () => 'https://owner-a.storage.supabase.co/storage/v1/upload/resumable',
  isBackendConfigured: () => true,
}))

vi.mock('tus-js-client', () => ({
  Upload: class FakeTusUpload {
    constructor(blob, options) {
      this.blob = blob
      this.options = options
      fake.tusOptions = options
    }

    async findPreviousUploads() {
      return []
    }

    start() {
      fake.resumableUploads += 1
      fake.storage.set(this.options.metadata.objectName, this.blob)
      this.options.onSuccess()
    }
  },
}))

import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import {
  attachResourceToNote,
  checksumBlob,
  duplicateNoteResourceLinks,
  removeNoteResource,
  updateCanonicalResourceMetadata,
} from '../resources/repository'
import { createRecognizedContent } from '../intelligence/model'
import { correctRecognition, saveRecognizedContent } from '../intelligence/repository'
import {
  CAPTURE_RESOURCE_QUEUE_TABLE,
  captureStoragePath,
  hydrateSharedCaptureGraph,
  listCaptureConflicts,
  resolveCaptureConflict,
  syncCaptureCloud,
} from './cloud'
import { CAPTURE_RESUMABLE_CHUNK_BYTES } from './resumableUpload'

const ownerId = 'owner-a'

const resetRemote = () => {
  for (const table of Object.keys(fake.rows)) fake.rows[table] = []
  fake.storage.clear()
  fake.standardUploads = 0
  fake.resumableUploads = 0
  fake.tusOptions = null
}

describe('Task 4 capture cloud adapter', () => {
  beforeEach(async () => {
    await clearLocalData()
    resetRemote()
    setActiveWorkspaceOwner(ownerId)
    await db.notes.bulkPut([
      { id: 'note-a', userId: ownerId, title: 'Capture source' },
      { id: 'note-b', userId: ownerId, title: 'Second reference' },
    ])
  })

  it('uploads resources before links and recognition, preserves corrections, and removes only an orphan', async () => {
    const saved = await attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob(['meeting audio'], { type: 'audio/webm' }),
      fileName: 'meeting.webm',
      role: 'recording',
    })
    const recognition = createRecognizedContent({
      ownerId,
      noteId: 'note-a',
      type: 'transcript',
      sourceKind: 'audio',
      sourceResourceId: saved.resource.id,
      text: 'Approve the release',
      providerId: 'browser-speech',
      processingLocation: 'browserManaged',
      sourceFingerprint: saved.resource.checksum,
    })
    await saveRecognizedContent(recognition)

    expect((await db.syncQueue.where('ownerId').equals(ownerId).toArray()).map((row) => row.table))
      .toEqual(expect.arrayContaining([CAPTURE_RESOURCE_QUEUE_TABLE, 'note_resources', 'recognized_content']))

    const result = await syncCaptureCloud(ownerId)
    expect(result).toMatchObject({ skipped: false, resources: 1, links: 1, recognized: 1 })
    expect(fake.rows.resources).toHaveLength(1)
    expect(fake.rows.note_resources).toHaveLength(1)
    expect(fake.rows.recognized_content).toHaveLength(1)
    expect(fake.storage.has(captureStoragePath(ownerId, saved.resource.id))).toBe(true)
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)

    await updateCanonicalResourceMetadata(saved.resource.id, { durationMs: 12_500 })
    await syncCaptureCloud(ownerId)
    expect(fake.rows.resources[0].duration_ms).toBe(12_500)
    expect(fake.standardUploads).toBe(1)

    await correctRecognition(recognition.id, 'Approve the release contract')
    await syncCaptureCloud(ownerId)
    expect(fake.rows.recognized_content[0]).toMatchObject({
      machine_text: 'Approve the release',
      text: 'Approve the release contract',
      user_edited: true,
    })

    const [secondLink] = await duplicateNoteResourceLinks('note-a', 'note-b')
    await syncCaptureCloud(ownerId)
    expect(fake.rows.note_resources).toHaveLength(2)

    await removeNoteResource(saved.link.id)
    await syncCaptureCloud(ownerId)
    expect(fake.rows.note_resources).toHaveLength(1)
    expect(fake.rows.resources).toHaveLength(1)
    expect(fake.storage.size).toBe(1)

    await removeNoteResource(secondLink.id)
    await syncCaptureCloud(ownerId)
    expect(fake.rows.note_resources).toHaveLength(0)
    expect(fake.rows.recognized_content).toHaveLength(0)
    expect(fake.rows.resources).toHaveLength(0)
    expect(fake.storage.size).toBe(0)
  })

  it('keeps a failed binary upload queued and reports the missing canonical payload', async () => {
    const saved = await attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob(['durable source'], { type: 'audio/webm' }),
      fileName: 'durable.webm',
    })
    await db.resourceBlobs.delete(saved.resource.id)

    await expect(syncCaptureCloud(ownerId)).rejects.toThrow('original payload')
    expect(fake.rows.resources).toHaveLength(0)
    expect(await db.syncQueue.where('ownerId').equals(ownerId).filter(
      (row) => row.table === CAPTURE_RESOURCE_QUEUE_TABLE && row.data.id === saved.resource.id
    ).count()).toBe(1)
  })

  it('preserves two concurrent user transcript corrections until explicitly resolved', async () => {
    const saved = await attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob(['meeting audio'], { type: 'audio/webm' }),
      fileName: 'conflict.webm',
      role: 'recording',
    })
    const recognition = createRecognizedContent({
      ownerId,
      noteId: 'note-a',
      type: 'transcript',
      sourceKind: 'audio',
      sourceResourceId: saved.resource.id,
      text: 'Machine text',
      providerId: 'browser-speech',
      processingLocation: 'browserManaged',
      sourceFingerprint: saved.resource.checksum,
    })
    await saveRecognizedContent(recognition)
    await syncCaptureCloud(ownerId)

    await correctRecognition(recognition.id, 'Local reviewed correction')
    const remote = fake.rows.recognized_content[0]
    Object.assign(remote, {
      text: 'Remote reviewed correction',
      user_edited: true,
      edited_at: '2099-01-01T00:00:00.000Z',
      updated_at: '2099-01-01T00:00:00.000Z',
    })

    await syncCaptureCloud(ownerId)

    expect(await db.recognizedContent.get(recognition.id)).toMatchObject({
      text: 'Local reviewed correction',
      userEdited: true,
    })
    const [conflict] = await listCaptureConflicts(ownerId, {
      noteId: 'note-a', resourceId: saved.resource.id,
    })
    expect(conflict).toMatchObject({
      recordId: recognition.id,
      remote: { text: 'Remote reviewed correction', userEdited: true },
    })
    expect(await db.syncQueue.where('ownerId').equals(ownerId).filter(
      (item) => item.table === 'recognized_content' && item.data.id === recognition.id
    ).count()).toBe(1)

    await resolveCaptureConflict(conflict.id, 'incoming', ownerId)
    expect(await db.recognizedContent.get(recognition.id)).toMatchObject({
      text: 'Remote reviewed correction',
      machineText: 'Machine text',
    })
    expect(await listCaptureConflicts(ownerId)).toEqual([])
    expect(await db.syncQueue.where('ownerId').equals(ownerId).filter(
      (item) => item.table === 'recognized_content' && item.data.id === recognition.id
    ).count()).toBe(0)
  })

  it('uses the authenticated resumable Storage path for payloads larger than 6 MB', async () => {
    const saved = await attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob([new Uint8Array(6 * 1024 * 1024 + 1)], { type: 'audio/webm' }),
      fileName: 'long-recording.webm',
      role: 'recording',
    })

    await syncCaptureCloud(ownerId)

    expect(fake.standardUploads).toBe(0)
    expect(fake.resumableUploads).toBe(1)
    expect(fake.tusOptions).toMatchObject({
      endpoint: 'https://owner-a.storage.supabase.co/storage/v1/upload/resumable',
      chunkSize: CAPTURE_RESUMABLE_CHUNK_BYTES,
      removeFingerprintOnSuccess: true,
      uploadDataDuringCreation: true,
      metadata: {
        bucketName: 'quicknotes-resources',
        objectName: captureStoragePath(ownerId, saved.resource.id),
        contentType: 'audio/webm',
      },
    })
    await expect(fake.tusOptions.fingerprint()).resolves.toContain(saved.resource.id)
    expect(fake.rows.resources).toHaveLength(1)
  })

  it('hydrates remote metadata, original bytes, links, and corrected recognition into an empty device', async () => {
    const blob = new Blob(['%PDF remote'], { type: 'application/pdf' })
    const checksum = await checksumBlob(blob)
    const path = captureStoragePath(ownerId, 'resource-a')
    fake.storage.set(path, blob)
    fake.rows.resources.push({
      id: 'resource-a', user_id: ownerId, kind: 'pdf', mime_type: 'application/pdf',
      name: 'brief.pdf', byte_size: blob.size, data: null, thumbnail_data: null,
      pixel_width: null, pixel_height: null, schema_version: 1, file_name: 'brief.pdf',
      checksum, source: 'attachment', duration_ms: null, page_count: 1,
      storage_path: path, created_at: '2026-08-27T10:00:00.000Z', updated_at: '2026-08-27T10:00:00.000Z',
    })
    fake.rows.note_resources.push({
      id: 'link-a', note_id: 'note-a', user_id: ownerId, resource_id: 'resource-a',
      resource_user_id: ownerId, role: 'attachment', label: null,
      created_at: '2026-08-27T10:00:00.000Z', updated_at: '2026-08-27T10:00:00.000Z',
    })
    fake.rows.recognized_content.push({
      id: 'recognition-a', user_id: ownerId, note_id: 'note-a', schema_version: 1,
      source_kind: 'pdf', source_resource_id: 'resource-a', source_resource_user_id: ownerId,
      source_object_ids: [], source_page_id: null, source_page_number: 1,
      source_region: null, source_time_range: null, recognition_type: 'pdfText',
      machine_text: 'Original machine text', text: 'User corrected text', confidence: null,
      provider_id: 'pdfjs', model_id: 'pdfjs', model_version: '1', processing_location: 'local',
      language: 'en', source_fingerprint: checksum, status: 'current', user_edited: true,
      edited_at: '2026-08-27T10:05:00.000Z', created_at: '2026-08-27T10:00:00.000Z',
      generated_at: '2026-08-27T10:00:00.000Z', updated_at: '2026-08-27T10:05:00.000Z',
    })

    await syncCaptureCloud(ownerId)

    expect(await db.resources.get('resource-a')).toMatchObject({ fileName: 'brief.pdf', checksum })
    expect((await db.resourceBlobs.get('resource-a')).data.size).toBe(blob.size)
    expect(await db.noteResources.get('link-a')).toMatchObject({ noteId: 'note-a', resourceId: 'resource-a' })
    expect(await db.recognizedContent.get('recognition-a')).toMatchObject({
      text: 'User corrected text', machineText: 'Original machine text', userEdited: true,
    })
    expect(await db.captureSyncState.get(ownerId)).toMatchObject({ schemaVersion: 1 })
  })

  it('hydrates an accessible shared capture graph under the source owner without queueing viewer writes', async () => {
    const sourceOwnerId = 'shared-owner'
    const blob = new Blob(['shared audio'], { type: 'audio/webm' })
    const checksum = await checksumBlob(blob)
    const path = captureStoragePath(sourceOwnerId, 'shared-resource')
    fake.storage.set(path, blob)
    fake.rows.resources.push({
      id: 'shared-resource', user_id: sourceOwnerId, kind: 'audio', mime_type: 'audio/webm',
      name: 'standup.webm', byte_size: blob.size, data: null, thumbnail_data: null,
      pixel_width: null, pixel_height: null, schema_version: 1, file_name: 'standup.webm',
      checksum, source: 'recording', duration_ms: 4_000, page_count: null,
      storage_path: path, created_at: '2026-08-27T10:00:00.000Z', updated_at: '2026-08-27T10:00:00.000Z',
    })
    fake.rows.note_resources.push({
      id: 'shared-link', note_id: 'shared-note', user_id: sourceOwnerId,
      resource_id: 'shared-resource', resource_user_id: sourceOwnerId,
      role: 'recording', label: null, created_at: '2026-08-27T10:00:00.000Z',
      updated_at: '2026-08-27T10:00:00.000Z',
    })
    fake.rows.recognized_content.push({
      id: 'shared-recognition', user_id: sourceOwnerId, note_id: 'shared-note', schema_version: 1,
      source_kind: 'audio', source_resource_id: 'shared-resource', source_resource_user_id: sourceOwnerId,
      source_object_ids: [], source_page_id: null, source_page_number: null,
      source_region: null, source_time_range: { startMs: 0, endMs: 4_000 }, recognition_type: 'transcript',
      machine_text: 'Shared standup', text: 'Shared standup', confidence: null,
      provider_id: 'browser-speech', model_id: null, model_version: null, processing_location: 'browserManaged',
      language: 'en', source_fingerprint: checksum, status: 'current', user_edited: false,
      edited_at: null, created_at: '2026-08-27T10:00:00.000Z', generated_at: '2026-08-27T10:00:00.000Z',
      updated_at: '2026-08-27T10:00:00.000Z',
    })

    await expect(hydrateSharedCaptureGraph('shared-note', sourceOwnerId)).resolves.toMatchObject({
      resources: 1, links: 1, recognized: 1, skipped: false,
    })

    expect(await db.resources.get('shared-resource')).toMatchObject({ ownerId: sourceOwnerId })
    expect(await db.noteResources.get('shared-link')).toMatchObject({ ownerId: sourceOwnerId, noteId: 'shared-note' })
    expect(await db.recognizedContent.get('shared-recognition')).toMatchObject({ ownerId: sourceOwnerId })
    expect(await db.syncQueue.where('ownerId').equals(ownerId).count()).toBe(0)
  })

  it('keeps a local-only workspace entirely outside the cloud outbox', async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('local')
    await db.notes.put({ id: 'local-note', title: 'Offline capture' })
    await attachResourceToNote({
      noteId: 'local-note',
      blob: new Blob(['offline'], { type: 'audio/webm' }),
      fileName: 'offline.webm',
    })
    expect(await db.syncQueue.count()).toBe(0)
    await expect(syncCaptureCloud('local')).resolves.toMatchObject({ skipped: true })
    expect(fake.rows.resources).toHaveLength(0)
  })
})
