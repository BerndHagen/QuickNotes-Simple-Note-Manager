// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { attachResourceToNote } from '../resources/repository'
import { createSearchDocument } from '../knowledge/document'
import { saveBrowserManagedTranscript } from './service'

describe('intelligence capture service', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('owner-a')
  })

  it('links timestamped live transcript segments to canonical audio and search locations', async () => {
    const note = {
      id: 'audio-note',
      userId: 'owner-a',
      title: 'Deployment meeting',
      noteType: 'standard',
      contentKind: 'document',
      content: '',
      tags: [],
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
    }
    await db.notes.put(note)
    const { resource } = await attachResourceToNote({
      noteId: note.id,
      blob: new Blob(['audio'], { type: 'audio/webm' }),
      fileName: 'meeting.webm',
      kind: 'audio',
      durationMs: 8_000,
    })

    const rows = await saveBrowserManagedTranscript({
      noteId: note.id,
      resourceId: resource.id,
      language: 'en-US',
      segments: [
        { startMs: 500, endMs: 2_500, text: 'Discuss the deployment timeline', confidence: 0.8 },
        { startMs: 2_500, endMs: 6_000, text: 'Confirm the release owner', confidence: 0.7 },
      ],
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      sourceResourceId: resource.id,
      sourceTimeRange: { startMs: 500, endMs: 2_500 },
      processingLocation: 'browserManaged',
    })
    const searchDocument = createSearchDocument({ ownerId: 'owner-a', note, recognizedContent: rows })
    expect(searchDocument.recognizedText).toContain('deployment timeline')
    expect(searchDocument.locations).toEqual(expect.arrayContaining([
      expect.objectContaining({ recognitionId: rows[0].id, resourceId: resource.id, timeMs: 500 }),
    ]))
  })
})
