import { describe, expect, it } from 'vitest'
import {
  correctRecognizedContent,
  createRecognizedContent,
  mergeRecognitionRerun,
} from './model'

const imageResult = (overrides = {}) => createRecognizedContent({
  ownerId: 'owner-a',
  noteId: 'note-a',
  type: 'ocr',
  sourceKind: 'image',
  sourceResourceId: 'image-a',
  text: 'Machine output',
  providerId: 'local-ocr',
  modelId: 'eng',
  modelVersion: '1',
  processingLocation: 'local',
  sourceFingerprint: 'sha256:source',
  ...overrides,
})

describe('recognized content model', () => {
  it('requires source provenance and compatible source types', () => {
    expect(() => imageResult({ sourceResourceId: null })).toThrow(/source resource/i)
    expect(() => imageResult({ type: 'transcript' })).toThrow(/does not match/i)
    expect(() => createRecognizedContent({
      ownerId: 'owner-a',
      noteId: 'paper-a',
      type: 'handwriting',
      sourceKind: 'ink',
      sourceObjectIds: [],
      text: 'Hello',
      providerId: 'ink-provider',
      processingLocation: 'external',
      sourceFingerprint: 'ink-revision',
    })).toThrow(/source ink/i)
  })

  it('preserves a correction when recognition is rerun', () => {
    const original = imageResult({ id: 'result-a' })
    const corrected = correctRecognizedContent(original, 'Corrected by the user')
    const rerun = imageResult({ id: 'replacement', text: 'New machine output', sourceFingerprint: 'sha256:new' })
    const merged = mergeRecognitionRerun(corrected, rerun)

    expect(merged.id).toBe('result-a')
    expect(merged.machineText).toBe('New machine output')
    expect(merged.text).toBe('Corrected by the user')
    expect(merged.userEdited).toBe(true)
    expect(merged.sourceFingerprint).toBe('sha256:new')
  })
})
