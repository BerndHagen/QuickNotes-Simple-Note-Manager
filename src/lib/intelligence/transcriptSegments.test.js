import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { createRecognizedContent } from './model'
import { correctRecognition, replaceAudioTranscript } from './repository'
import { matchTranscriptSegments } from './transcriptSegments'

const row = (overrides = {}) => createRecognizedContent({
  ownerId: 'owner-a',
  noteId: 'note-a',
  type: 'transcript',
  sourceKind: 'audio',
  sourceResourceId: 'audio-a',
  sourceTimeRange: { startMs: 0, endMs: 2_000 },
  text: 'Machine transcript',
  providerId: 'openai-whisper-file-v1',
  modelId: 'whisper-1',
  modelVersion: 'provider-managed-alias',
  processingLocation: 'external',
  sourceFingerprint: 'sha256:source:time:0:2000',
  ...overrides,
})

describe('audio transcript reruns', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('owner-a')
  })

  it('matches shifted timestamp segments without using array indexes as identity', () => {
    const existing = [
      row({ id: 'segment-a', sourceTimeRange: { startMs: 0, endMs: 2_000 } }),
      row({ id: 'segment-b', sourceTimeRange: { startMs: 2_000, endMs: 4_000 } }),
    ]
    const matches = matchTranscriptSegments(existing, [
      { text: 'First', startMs: 150, endMs: 2_100 },
      { text: 'Second', startMs: 2_100, endMs: 4_200 },
    ])
    expect(matches.map((match) => match.existing.id)).toEqual(['segment-a', 'segment-b'])
  })

  it('preserves a user correction and supersedes an obsolete segment atomically', async () => {
    const first = row({ id: 'segment-a', providerId: 'browser-speech-live-v1', processingLocation: 'browserManaged' })
    const obsolete = row({ id: 'segment-b', sourceTimeRange: { startMs: 2_000, endMs: 4_000 }, sourceFingerprint: 'sha256:source:time:2000:4000' })
    await db.recognizedContent.bulkPut([first, obsolete])
    await correctRecognition(first.id, 'Reviewed transcript')

    const rerun = row({
      id: first.id,
      machineText: 'New machine transcript',
      text: 'New machine transcript',
      sourceTimeRange: { startMs: 100, endMs: 2_100 },
      sourceFingerprint: 'sha256:source:time:100:2100',
    })
    const saved = await replaceAudioTranscript([rerun], {
      ownerId: 'owner-a',
      noteId: 'note-a',
      resourceId: 'audio-a',
      providerId: 'openai-whisper-file-v1',
    })

    expect(saved[0]).toMatchObject({
      id: 'segment-a',
      machineText: 'New machine transcript',
      text: 'Reviewed transcript',
      userEdited: true,
    })
    expect(await db.recognizedContent.get('segment-b')).toMatchObject({ status: 'superseded' })
  })
})
