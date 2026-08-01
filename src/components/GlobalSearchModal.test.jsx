import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore, useUIStore } from '../store'
import GlobalSearchModal from './GlobalSearchModal'

const originalNotesState = useNotesStore.getState()
const originalUIState = useUIStore.getState()

describe('GlobalSearchModal', () => {
  let setSelectedFolder

  beforeEach(() => {
    setSelectedFolder = vi.fn()
    useNotesStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Project brief',
          content: '<p>Project milestones and scope</p>',
          tags: [],
          deleted: false,
          archived: false,
        },
      ],
      folders: [{ id: 'folder-1', name: 'Projects', color: '#10b981' }],
      tags: [{ id: 'tag-1', name: 'project', color: '#3b82f6' }],
      setSelectedNote: vi.fn(),
      setSelectedFolder,
      setSelectedTagFilter: vi.fn(),
    })
    useUIStore.setState({ globalSearchOpen: true, language: 'en' })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalNotesState, true)
    useUIStore.setState(originalUIState, true)
    vi.restoreAllMocks()
  })

  it('exposes one keyboard-driven combobox and keeps its active option in sync', async () => {
    const user = userEvent.setup()
    render(<GlobalSearchModal />)

    const search = screen.getByRole('combobox', {
      name: 'Search notes, folders, or tags...',
    })
    await waitFor(() => expect(search).toHaveFocus())
    await user.type(search, 'project')

    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(3)
    expect(search).toHaveAttribute('aria-activedescendant', 'qn-search-option-0')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}{Enter}')

    expect(setSelectedFolder).toHaveBeenCalledWith('folder-1')
    expect(screen.queryByRole('dialog', { name: 'Global Search' })).not.toBeInTheDocument()
  })

  it('formats the visible command from the saved shortcut registry', () => {
    localStorage.setItem(
      'quicknotes-shortcuts',
      JSON.stringify({ globalSearch: { key: 'g', ctrl: true, alt: false, shift: false } })
    )

    render(<GlobalSearchModal />)

    expect(screen.getByText('Ctrl + G')).toBeInTheDocument()
    expect(screen.queryByText(/Ctrl\+Shift\+F/i)).not.toBeInTheDocument()
  })

  it('does not register the obsolete Ctrl+Shift+F document listener', async () => {
    useUIStore.setState({ globalSearchOpen: false })
    const user = userEvent.setup()
    render(<GlobalSearchModal />)

    await user.keyboard('{Control>}{Shift>}f{/Shift}{/Control}')

    expect(useUIStore.getState().globalSearchOpen).toBe(false)
  })
})
