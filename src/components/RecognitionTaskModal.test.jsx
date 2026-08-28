import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore } from '../store'
import RecognitionTaskModal from './RecognitionTaskModal'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const originalState = useNotesStore.getState()

const recognition = {
  id: 'recognition-1',
  noteId: 'meeting-1',
  type: 'transcript',
  sourceKind: 'audio',
  sourceResourceId: 'audio-1',
  sourceTimeRange: { startMs: 12_000, endMs: 18_000 },
  text: 'Send the reviewed summary to Alex',
}

describe('RecognitionTaskModal meeting workflow', () => {
  let updateNote

  beforeEach(() => {
    updateNote = vi.fn().mockResolvedValue(undefined)
    useNotesStore.setState({
      notes: [{
        id: 'meeting-1',
        title: 'Weekly review',
        noteType: 'meeting',
        noteData: { actionItems: [], decisions: [] },
      }],
      updateNote,
    })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalState, true)
    vi.clearAllMocks()
  })

  it('defaults a meeting transcript to a reviewed, source-linked action item', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <RecognitionTaskModal
        open
        onClose={onClose}
        recognition={recognition}
        initialText={recognition.text}
      />
    )

    expect(screen.getByLabelText('Destination')).toHaveValue('__meeting_actions__')
    expect(screen.getByRole('button', { name: 'Add action item' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Add action item' }))

    await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1))
    const [, update] = updateNote.mock.calls[0]
    expect(update.noteData.actionItems[0]).toMatchObject({
      task: recognition.text,
      completed: false,
      source: {
        kind: 'recognizedContent',
        noteId: 'meeting-1',
        recognitionId: 'recognition-1',
        resourceId: 'audio-1',
        timeMs: 12_000,
      },
    })
    expect(onClose).toHaveBeenCalled()
  })
})
