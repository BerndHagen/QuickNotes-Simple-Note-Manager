import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNoteComment,
  deleteNoteComment,
  getNoteComments,
  getNoteParticipants,
} from '../../lib/backend'
import NoteCommentsModal from './NoteCommentsModal'

vi.mock('../../lib/backend', () => ({
  createNoteComment: vi.fn(),
  deleteNoteComment: vi.fn(),
  getNoteComments: vi.fn(),
  getNoteParticipants: vi.fn(),
  subscribeToNoteComments: vi.fn(() => ({ unsubscribe: vi.fn() })),
}))

const note = { id: 'note-a', title: 'Release plan', isShared: true }

describe('NoteCommentsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getNoteComments.mockResolvedValue([])
    getNoteParticipants.mockResolvedValue([
      { user_id: 'owner-a', username: 'Bernd', participant_role: 'owner', permission: 'edit' },
      { user_id: 'collaborator-a', username: 'Mara', participant_role: 'collaborator', permission: 'edit' },
    ])
    createNoteComment.mockResolvedValue('comment-a')
    deleteNoteComment.mockResolvedValue(true)
  })

  it('creates a stable note comment and sends mentions only to actual participants', async () => {
    const user = userEvent.setup()
    render(<NoteCommentsModal open onClose={() => {}} note={note} currentUserId="owner-a" anchorId="heading-a" />)

    expect(await screen.findByText('No comments yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '@Mara' }))
    await user.type(screen.getByLabelText('Add a comment'), 'Please confirm the timing.')
    await user.click(screen.getByRole('button', { name: 'Comment' }))

    await waitFor(() => expect(createNoteComment).toHaveBeenCalledWith({
      noteId: 'note-a',
      body: '@Mara Please confirm the timing.',
      mentionedUserIds: ['collaborator-a'],
      anchorId: 'heading-a',
      objectId: null,
    }))
  })

  it('shows provenance and permits the author to delete their own comment', async () => {
    const user = userEvent.setup()
    getNoteComments.mockResolvedValue([{
      id: 'comment-a',
      author_id: 'owner-a',
      author_username: 'Bernd',
      body: 'Reviewed the source.',
      mentioned_usernames: ['Mara'],
      created_at: '2026-08-28T10:00:00.000Z',
      anchor_id: null,
      object_id: 'object-a',
    }])
    render(<NoteCommentsModal open onClose={() => {}} note={note} currentUserId="owner-a" />)

    expect(await screen.findByText('Reviewed the source.')).toBeInTheDocument()
    expect(screen.getByText('Notified @Mara')).toBeInTheDocument()
    expect(screen.getByText('Anchored to workspace object')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete comment' }))
    await waitFor(() => expect(deleteNoteComment).toHaveBeenCalledWith('comment-a'))
  })
})
