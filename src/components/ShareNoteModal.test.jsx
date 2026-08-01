import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backend } from '../lib/backend'
import { useNotesStore, useUIStore } from '../store'
import ShareNoteModal, { validateShareEmail } from './ShareNoteModal'

const originalNotesState = useNotesStore.getState()
const originalUIState = useUIStore.getState()
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

const mockShareQuery = (...results) => {
  const eq = vi.fn()
  results.forEach((result) => eq.mockResolvedValueOnce(result))
  if (results.length) eq.mockResolvedValue(results.at(-1))
  vi.spyOn(backend, 'from').mockReturnValue({
    select: vi.fn(() => ({ eq })),
  })
  return eq
}

describe('ShareNoteModal', () => {
  let shareNote
  let removeShare
  let loadSharedNotes

  beforeEach(() => {
    shareNote = vi.fn().mockResolvedValue({ id: 'share-new' })
    removeShare = vi.fn().mockResolvedValue(undefined)
    loadSharedNotes = vi.fn().mockResolvedValue(undefined)
    useNotesStore.setState({
      notes: [
        { id: 'note-1', title: 'Project brief' },
        { id: 'note-2', title: 'Research notes' },
      ],
      shareNote,
      removeShare,
      loadSharedNotes,
    })
    useUIStore.setState({ shareModalOpen: true, shareNoteId: 'note-1' })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalNotesState, true)
    useUIStore.setState(originalUIState, true)
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor)
    } else {
      delete navigator.clipboard
    }
    vi.restoreAllMocks()
  })

  it('validates and normalizes invitations through associated controls', async () => {
    const user = userEvent.setup()
    mockShareQuery({ data: [], error: null })
    render(<ShareNoteModal />)

    const dialog = screen.getByRole('dialog', { name: 'Share note' })
    expect(dialog).toHaveAccessibleDescription('Project brief')
    await screen.findByText('No invitations yet')
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'invalid' } })
    await user.click(screen.getByRole('button', { name: 'Create invitation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('valid email address')
    expect(shareNote).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: ' Person@Example.COM ' },
    })
    await user.click(screen.getByRole('radio', { name: /read only/i }))
    await user.click(screen.getByRole('button', { name: 'Create invitation' }))

    await waitFor(() =>
      expect(shareNote).toHaveBeenCalledWith('note-1', 'person@example.com', 'view')
    )
  })

  it('shows a recoverable load error instead of leaving stale or empty sharing details', async () => {
    const user = userEvent.setup()
    const eq = mockShareQuery({ data: null, error: new Error('network unavailable') })
    render(<ShareNoteModal />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sharing details could not be loaded: network unavailable'
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(eq).toHaveBeenCalledTimes(2))
  })

  it('provides a selectable fallback when clipboard permission is blocked', async () => {
    const user = userEvent.setup()
    mockShareQuery({
      data: [
        {
          id: 'share-1',
          email: 'person@example.com',
          permission: 'edit',
          status: 'pending',
          share_link: 'token-1',
        },
      ],
      error: null,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    render(<ShareNoteModal />)

    await user.click(
      await screen.findByRole('button', { name: 'Copy share link for person@example.com' })
    )

    const manualLink = await screen.findByLabelText('Share link for person@example.com')
    expect(manualLink).toHaveValue(
      `${window.location.origin}${window.location.pathname}?share=token-1`
    )
    expect(manualLink).toHaveAttribute('readonly')
  })

  it('ignores a late response after switching to another note', async () => {
    let resolveFirst
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve
    })
    const eq = vi
      .fn()
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'share-2',
            email: 'second@example.com',
            permission: 'view',
            status: 'accepted',
            share_link: 'token-2',
          },
        ],
        error: null,
      })
    vi.spyOn(backend, 'from').mockReturnValue({ select: vi.fn(() => ({ eq })) })
    render(<ShareNoteModal />)
    await waitFor(() => expect(eq).toHaveBeenCalledTimes(1))

    act(() => useUIStore.setState({ shareNoteId: 'note-2' }))
    expect(await screen.findByText('second@example.com')).toBeInTheDocument()

    await act(async () => {
      resolveFirst({
        data: [
          {
            id: 'share-1',
            email: 'first@example.com',
            permission: 'edit',
            status: 'pending',
            share_link: 'token-1',
          },
        ],
        error: null,
      })
      await firstResponse
    })

    expect(screen.queryByText('first@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('second@example.com')).toBeInTheDocument()
  })
})

describe('validateShareEmail', () => {
  it('normalizes a usable address and rejects malformed boundaries', () => {
    expect(validateShareEmail(' Person@Example.COM ')).toEqual({
      value: 'person@example.com',
      error: '',
    })
    expect(validateShareEmail('.person@example.com').error).toMatch(/valid email/i)
    expect(validateShareEmail('person@example').error).toMatch(/valid email/i)
  })
})
