// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { createRecognizedContent } from '../intelligence/model'
import {
  appendRecordingChunk,
  attachResourceToNote,
  beginRecordingSession,
  deleteNoteResourceLinks,
  duplicateNoteResourceLinks,
  finalizeRecordingSession,
  getLinkedResource,
  listNoteResources,
  removeNoteResource,
} from './repository'

describe('canonical note resources', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('owner-a')
    await db.notes.bulkPut([
      { id: 'note-a', title: 'Source' },
      { id: 'note-b', title: 'Duplicate' },
    ])
  })

  it('stores PDF bytes outside note JSON and loads them only through a note link', async () => {
    const blob = new Blob(['%PDF-1.7 test'], { type: 'application/pdf' })
    const saved = await attachResourceToNote({ noteId: 'note-a', blob, fileName: 'brief.pdf' })

    expect(await db.notes.get('note-a')).not.toHaveProperty('resources')
    expect(await db.resourceBlobs.get(saved.resource.id)).toMatchObject({ byteSize: blob.size })
    await expect(getLinkedResource(saved.resource.id, 'note-a')).resolves.toMatchObject({
      resource: { kind: 'pdf', fileName: 'brief.pdf' },
    })
    await expect(getLinkedResource(saved.resource.id, 'note-b')).resolves.toBeNull()
  })

  it('keeps damaged attachment references visible without deleting recovery evidence', async () => {
    const saved = await attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob(['%PDF-1.7 test'], { type: 'application/pdf' }),
      fileName: 'recovery.pdf',
    })
    await db.resources.delete(saved.resource.id)

    await expect(listNoteResources('note-a')).resolves.toEqual([
      expect.objectContaining({
        link: expect.objectContaining({ id: saved.link.id, resourceId: saved.resource.id }),
        resource: null,
        status: 'missingMetadata',
      }),
    ])
    expect(await db.noteResources.get(saved.link.id)).toBeTruthy()
    expect(await db.resourceBlobs.get(saved.resource.id)).toBeTruthy()
  })

  it('keeps a shared immutable payload until its final note reference is removed', async () => {
    const saved = await attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob(['audio'], { type: 'audio/webm' }),
      fileName: 'standup.webm',
      role: 'recording',
    })
    await duplicateNoteResourceLinks('note-a', 'note-b')
    expect(await listNoteResources('note-b')).toHaveLength(1)

    await removeNoteResource(saved.link.id)
    expect(await db.resources.get(saved.resource.id)).toBeTruthy()
    await deleteNoteResourceLinks('note-b')
    expect(await db.resources.get(saved.resource.id)).toBeUndefined()
    expect(await db.resourceBlobs.get(saved.resource.id)).toBeUndefined()
  })

  it('removes recognition derived from a detached source without touching another note', async () => {
    const saved = await attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob(['audio'], { type: 'audio/webm' }),
      fileName: 'meeting.webm',
    })
    await duplicateNoteResourceLinks('note-a', 'note-b')
    const recognized = (noteId) => createRecognizedContent({
      ownerId: 'owner-a',
      noteId,
      type: 'transcript',
      sourceKind: 'audio',
      sourceResourceId: saved.resource.id,
      text: `Transcript for ${noteId}`,
      providerId: 'test',
      processingLocation: 'local',
      sourceFingerprint: saved.resource.checksum,
    })
    await db.recognizedContent.bulkPut([recognized('note-a'), recognized('note-b')])

    await removeNoteResource(saved.link.id)
    expect(await db.recognizedContent.where('[ownerId+noteId]').equals(['owner-a', 'note-a']).count()).toBe(0)
    expect(await db.recognizedContent.where('[ownerId+noteId]').equals(['owner-a', 'note-b']).count()).toBe(1)
  })

  it('persists recording chunks incrementally and atomically promotes them to an audio resource', async () => {
    const session = await beginRecordingSession('note-a', 'audio/webm')
    await appendRecordingChunk(session.id, new Blob(['first'], { type: 'audio/webm' }))
    await appendRecordingChunk(session.id, new Blob(['second'], { type: 'audio/webm' }))
    expect(await db.resourceChunks.where('recordingId').equals(session.id).count()).toBe(2)

    const saved = await finalizeRecordingSession(session.id, 12_000)
    expect(saved.resource).toMatchObject({ kind: 'audio', durationMs: 12_000, byteSize: 11 })
    expect(await db.recordingSessions.get(session.id)).toBeUndefined()
    expect(await db.resourceChunks.where('recordingId').equals(session.id).count()).toBe(0)
    expect((await getLinkedResource(saved.resource.id, 'note-a')).blob.size).toBe(11)
  })

  it('rolls back an attachment when browser storage rejects its payload', async () => {
    vi.spyOn(db.resourceBlobs, 'add').mockRejectedValueOnce(
      new DOMException('Browser storage is full', 'QuotaExceededError')
    )

    await expect(attachResourceToNote({
      noteId: 'note-a',
      blob: new Blob(['%PDF-1.7 quota'], { type: 'application/pdf' }),
      fileName: 'quota.pdf',
    })).rejects.toMatchObject({ name: 'QuotaExceededError' })

    expect(await db.resources.count()).toBe(0)
    expect(await db.resourceBlobs.count()).toBe(0)
    expect(await db.noteResources.count()).toBe(0)
  })

  it('retains recoverable recording chunks if final promotion runs out of storage', async () => {
    const session = await beginRecordingSession('note-a', 'audio/webm')
    await appendRecordingChunk(session.id, new Blob(['recover me'], { type: 'audio/webm' }))
    vi.spyOn(db.resourceBlobs, 'add').mockRejectedValueOnce(
      new DOMException('Browser storage is full', 'QuotaExceededError')
    )

    await expect(finalizeRecordingSession(session.id, 3_000)).rejects.toMatchObject({ name: 'QuotaExceededError' })

    expect(await db.recordingSessions.get(session.id)).toBeTruthy()
    expect(await db.resourceChunks.where('recordingId').equals(session.id).count()).toBe(1)
    expect(await db.resources.count()).toBe(0)
    expect(await db.noteResources.count()).toBe(0)
  })

  it('does not advance a recording session when a chunk write fails', async () => {
    const session = await beginRecordingSession('note-a', 'audio/webm')
    vi.spyOn(db.resourceChunks, 'add').mockRejectedValueOnce(
      new DOMException('Browser storage is full', 'QuotaExceededError')
    )

    await expect(appendRecordingChunk(
      session.id,
      new Blob(['rejected'], { type: 'audio/webm' })
    )).rejects.toMatchObject({ name: 'QuotaExceededError' })

    expect(await db.resourceChunks.where('recordingId').equals(session.id).count()).toBe(0)
    expect(await db.recordingSessions.get(session.id)).toMatchObject({ byteSize: 0, nextSequence: 0 })
  })
})
