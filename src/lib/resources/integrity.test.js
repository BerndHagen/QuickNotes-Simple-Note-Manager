// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { auditLocalDataIntegrity } from './integrity'

describe('local canonical data integrity audit', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('owner-a')
    await db.notes.put({ id: 'note-a', userId: 'owner-a', title: 'Audit source' })
  })

  it('reports broken graph edges and preserves every row', async () => {
    await db.noteResources.put({
      id: 'missing-resource-link', ownerId: 'owner-a', noteId: 'note-a', resourceId: 'missing-resource',
    })
    await db.resourceBlobs.put({
      resourceId: 'payload-only', ownerId: 'owner-a', data: new Blob(['raw']), byteSize: 3,
    })
    await db.resources.bulkPut([
      { id: 'missing-payload', ownerId: 'owner-a', kind: 'pdf' },
      { id: 'orphan', ownerId: 'owner-a', kind: 'image' },
    ])
    await db.noteResources.put({
      id: 'payload-link', ownerId: 'owner-a', noteId: 'note-a', resourceId: 'missing-payload',
    })
    await db.resourceChunks.add({ ownerId: 'owner-a', recordingId: 'missing-session', sequence: 0, data: new Blob(['x']) })

    const report = await auditLocalDataIntegrity('owner-a')
    expect(report.issues.missingResourceMetadata).toMatchObject({ count: 1, sampleIds: ['missing-resource'] })
    expect(report.issues.missingResourcePayloads).toMatchObject({ count: 1, sampleIds: ['missing-payload'] })
    expect(report.issues.payloadsWithoutMetadata).toMatchObject({ count: 1, sampleIds: ['payload-only'] })
    expect(report.issues.unreferencedResources).toMatchObject({ count: 1, sampleIds: ['orphan'] })
    expect(report.issues.detachedRecordingChunks.count).toBe(1)
    expect(report.issueCount).toBe(5)

    expect(await db.noteResources.get('missing-resource-link')).toBeTruthy()
    expect(await db.resources.get('orphan')).toBeTruthy()
    expect(await db.resourceBlobs.get('payload-only')).toBeTruthy()
  })

  it('does not call an owner resource orphaned while another graph still references it', async () => {
    await db.resources.put({ id: 'shared-resource', ownerId: 'owner-a', kind: 'image' })
    await db.spatialObjects.put({
      id: 'shared-placement', ownerId: 'owner-b', noteId: 'shared-note', kind: 'image', data: { resourceId: 'shared-resource' },
    })

    const report = await auditLocalDataIntegrity('owner-a')
    expect(report.issues.unreferencedResources.count).toBe(0)
  })
})
