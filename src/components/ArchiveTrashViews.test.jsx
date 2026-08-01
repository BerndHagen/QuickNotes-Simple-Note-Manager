import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore, useUIStore } from '../store'
import ArchiveView from './ArchiveView'
import TrashView from './TrashView'

const originalNotesState = useNotesStore.getState()
const originalUIState = useUIStore.getState()

describe('archive and trash views', () => {
  beforeEach(() => {
    useNotesStore.setState({ notes: [], folders: [] })
    useUIStore.setState({ archiveViewOpen: false, showTrash: false, language: 'en' })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalNotesState, true)
    useUIStore.setState(originalUIState, true)
    vi.restoreAllMocks()
  })

  it('filters archived notes and exposes every note action by name', async () => {
    const user = userEvent.setup()
    const unarchiveNote = vi.fn()
    const setSelectedNote = vi.fn()
    useNotesStore.setState({
      notes: [
        {
          id: 'archive-1',
          title: 'Launch plan',
          content: '<p>Milestones and owners</p>',
          folderId: 'work',
          archived: true,
          deleted: false,
          archivedAt: '2026-07-31T10:00:00.000Z',
          createdAt: '2026-07-01T10:00:00.000Z',
        },
        {
          id: 'archive-2',
          title: 'Travel ideas',
          content: '<p>Mountain route</p>',
          archived: true,
          deleted: false,
          archivedAt: '2026-07-30T10:00:00.000Z',
          createdAt: '2026-07-02T10:00:00.000Z',
        },
      ],
      folders: [{ id: 'work', name: 'Work' }],
      unarchiveNote,
      setSelectedNote,
    })
    useUIStore.setState({ archiveViewOpen: true })
    render(<ArchiveView />)

    expect(screen.getByRole('dialog', { name: 'Archive' })).toHaveAccessibleDescription(
      '2 archived notes'
    )
    expect(screen.getByRole('region', { name: 'Archive' })).toHaveAttribute('tabindex', '0')
    expect(
      screen.getByRole('button', { name: 'Remove from archive: Launch plan' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open Launch plan' })).toBeVisible()

    await user.type(screen.getByRole('searchbox', { name: 'Search in archive...' }), 'mountain')
    expect(screen.queryByText('Launch plan')).not.toBeInTheDocument()
    expect(screen.getByText('Travel ideas')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Search in archive...' }))
    await user.click(screen.getByRole('button', { name: 'Remove from archive: Launch plan' }))
    expect(unarchiveNote).toHaveBeenCalledWith('archive-1')
  })

  it('names restore and permanent-delete actions and confirms the exact destructive target', async () => {
    const user = userEvent.setup()
    const restoreNote = vi.fn()
    const permanentlyDeleteNote = vi.fn()
    useNotesStore.setState({
      notes: [
        {
          id: 'trash-1',
          title: 'Discarded draft',
          content: '<p>Old content</p>',
          deleted: true,
          deletedAt: '2026-07-31T10:00:00.000Z',
        },
      ],
      restoreNote,
      permanentlyDeleteNote,
    })
    useUIStore.setState({ showTrash: true })
    render(<TrashView />)

    expect(screen.getByRole('dialog', { name: 'Trash' })).toHaveAccessibleDescription(
      /1 note · auto-deleted after 30 days/i
    )
    expect(screen.getByRole('region', { name: 'Trash' })).toHaveAttribute('tabindex', '0')

    await user.click(screen.getByRole('button', { name: 'Restore Discarded draft' }))
    expect(restoreNote).toHaveBeenCalledWith('trash-1')

    await user.click(
      screen.getByRole('button', { name: 'Permanently delete: Discarded draft' })
    )
    const confirmation = screen.getByRole('dialog', { name: 'Permanently delete' })
    expect(confirmation).toHaveAccessibleDescription(/“Discarded draft”/)

    await user.click(screen.getByRole('button', { name: 'Permanently delete', exact: true }))
    await waitFor(() => expect(permanentlyDeleteNote).toHaveBeenCalledWith('trash-1'))
  })
})
