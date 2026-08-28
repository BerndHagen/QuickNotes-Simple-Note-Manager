import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { createRecognizedContent } from './model'
import {
  correctRecognition,
  getIntelligenceSettings,
  invalidateRecognizedContent,
  listRecognizedContentForNote,
  saveIntelligenceSettings,
  saveRecognizedContent,
} from './repository'

const result = (overrides = {}) => createRecognizedContent({
  ownerId: 'owner-a',
  noteId: 'note-a',
  type: 'ocr',
  sourceKind: 'image',
  sourceResourceId: 'resource-a',
  text: 'Invoice total 42 euro',
  providerId: 'local-ocr',
  processingLocation: 'local',
  sourceFingerprint: 'sha256:one',
  ...overrides,
})

describe('intelligence repository', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('owner-a')
  })

  it('isolates recognized content by owner and preserves corrections when invalidated', async () => {
    const saved = await saveRecognizedContent(result())
    const corrected = await correctRecognition(saved.id, 'Invoice total €42')
    expect(corrected.userEdited).toBe(true)

    expect(await listRecognizedContentForNote('note-a')).toHaveLength(1)
    setActiveWorkspaceOwner('owner-b')
    expect(await listRecognizedContentForNote('note-a')).toHaveLength(0)
    setActiveWorkspaceOwner('owner-a')

    expect(await invalidateRecognizedContent({ noteId: 'note-a', sourceResourceId: 'resource-a' })).toBe(1)
    expect((await db.recognizedContent.get(saved.id))).toMatchObject({
      status: 'stale',
      text: 'Invoice total €42',
      userEdited: true,
    })
  })

  it('defaults to local-only processing and persists a small owner-scoped policy', async () => {
    expect(await getIntelligenceSettings()).toMatchObject({ mode: 'localOnly', confirmExternalEveryTime: true })
    await saveIntelligenceSettings({ mode: 'externalAllowed', confirmExternalEveryTime: false })
    expect(await getIntelligenceSettings()).toMatchObject({ mode: 'externalAllowed', confirmExternalEveryTime: true })
  })
})
