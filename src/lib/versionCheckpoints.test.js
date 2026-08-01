import { describe, expect, it } from 'vitest'
import {
  advanceVersionCheckpoint,
  createVersionCheckpointTracker,
  createVersionSnapshot,
  VERSION_CHECKPOINT_INTERVAL_MS,
} from './versionCheckpoints'

const note = {
  id: 'note-1',
  title: 'Original title',
  content: '<p>Original</p>',
  noteData: null,
  noteType: 'standard',
}

describe('version checkpoint tracking', () => {
  it('captures the complete pre-edit state on the first meaningful change', () => {
    const initial = createVersionSnapshot(note)
    const result = advanceVersionCheckpoint(
      createVersionCheckpointTracker(initial),
      { ...initial, content: '<p>Original!</p>' },
      1_000
    )

    expect(result.checkpoint).toEqual(initial)
    expect(result.tracker.latest.content).toBe('<p>Original!</p>')
  })

  it('does not create checkpoints for duplicate events or every keystroke', () => {
    const initial = createVersionSnapshot(note)
    const first = advanceVersionCheckpoint(
      createVersionCheckpointTracker(initial),
      { ...initial, title: 'Original title!' },
      1_000
    )
    const duplicate = advanceVersionCheckpoint(first.tracker, first.tracker.latest, 1_100)
    const nextKey = advanceVersionCheckpoint(
      duplicate.tracker,
      { ...duplicate.tracker.latest, title: 'Original title!!' },
      1_200
    )

    expect(duplicate.checkpoint).toBeNull()
    expect(nextKey.checkpoint).toBeNull()
  })

  it('captures the latest pre-change state after the checkpoint interval', () => {
    const initial = createVersionSnapshot(note)
    const first = advanceVersionCheckpoint(
      createVersionCheckpointTracker(initial),
      { ...initial, content: '<p>First edit</p>' },
      1_000
    )
    const second = advanceVersionCheckpoint(
      first.tracker,
      { ...first.tracker.latest, content: '<p>Second edit</p>' },
      1_000 + VERSION_CHECKPOINT_INTERVAL_MS
    )

    expect(second.checkpoint.content).toBe('<p>First edit</p>')
  })

  it('starts a fresh session when the selected note changes', () => {
    const tracker = createVersionCheckpointTracker(createVersionSnapshot(note))
    const result = advanceVersionCheckpoint(tracker, {
      ...note,
      id: 'note-2',
      title: 'Another note',
    })

    expect(result.checkpoint).toBeNull()
    expect(result.tracker.latest.id).toBe('note-2')
  })

  it('copies structured data so later mutations cannot change a checkpoint', () => {
    const source = { tasks: [{ id: 'task-1', text: 'Before' }] }
    const initial = createVersionSnapshot({ ...note, noteType: 'todo', noteData: source })
    const result = advanceVersionCheckpoint(
      createVersionCheckpointTracker(initial),
      { ...initial, noteData: { tasks: [{ id: 'task-1', text: 'After' }] } },
      1_000
    )

    source.tasks[0].text = 'Mutated later'
    expect(result.checkpoint.noteData.tasks[0].text).toBe('Before')
  })
})
