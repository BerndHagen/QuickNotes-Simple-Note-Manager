import { describe, expect, it } from 'vitest'
import {
  createCanonicalTaskFromRecognition,
  createRecognitionTaskSource,
  normalizeTaskSource,
  taskSourceToKnowledgeTarget,
} from './taskSources'

const recognition = {
  id: 'recognition-1',
  noteId: 'source-note',
  type: 'transcript',
  sourceKind: 'audio',
  sourceResourceId: 'audio-1',
  sourceObjectIds: [],
  sourcePageId: null,
  sourcePageNumber: null,
  sourceTimeRange: { startMs: 12_500, endMs: 15_000 },
  sourceRegion: null,
}

describe('recognized task sources', () => {
  it('creates a canonical todo task with a bounded stable source locator', () => {
    const task = createCanonicalTaskFromRecognition({
      text: '  Send   the revised proposal  ',
      priority: 'high',
      dueDate: '2026-08-28',
      recognition,
    }, { createId: () => 'task-1', now: '2026-08-27T12:00:00.000Z' })

    expect(task).toMatchObject({
      id: 'task-1',
      text: 'Send the revised proposal',
      completed: false,
      priority: 'high',
      dueDate: '2026-08-28',
      source: {
        schemaVersion: 1,
        kind: 'recognizedContent',
        noteId: 'source-note',
        recognitionId: 'recognition-1',
        resourceId: 'audio-1',
        timeMs: 12_500,
      },
    })
  })

  it('keeps one object fallback for ink while leaving full stroke provenance canonical', () => {
    const source = createRecognitionTaskSource({
      ...recognition,
      type: 'handwriting',
      sourceKind: 'ink',
      sourceResourceId: null,
      sourceObjectIds: ['stroke-a', 'stroke-b'],
      sourcePageId: 'page-1',
      sourceRegion: { x: 1, y: 2, width: 3, height: 4 },
    })

    expect(source.objectId).toBe('stroke-a')
    expect(source).not.toHaveProperty('objectIds')
    expect(taskSourceToKnowledgeTarget(source)).toMatchObject({
      noteId: 'source-note',
      recognitionId: 'recognition-1',
      objectId: 'stroke-a',
      pageId: 'page-1',
    })
  })

  it('ignores malformed imported source metadata', () => {
    expect(normalizeTaskSource({ kind: 'recognizedContent', noteId: 'note' })).toBeNull()
    expect(() => createCanonicalTaskFromRecognition({ text: '', recognition })).toThrow('Enter the task')
    expect(() => createCanonicalTaskFromRecognition({ text: 'Task', dueDate: '2026-02-31', recognition })).toThrow('valid due date')
  })
})
