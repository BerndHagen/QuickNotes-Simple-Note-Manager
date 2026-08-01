import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore, useUIStore } from '../store'
import QuickNoteModal from './QuickNoteModal'

const originalNotesState = useNotesStore.getState()
const originalUIState = useUIStore.getState()

describe('QuickNoteModal', () => {
  let createNote

  beforeEach(() => {
    createNote = vi.fn()
    useNotesStore.setState({
      notes: [],
      folders: [{ id: 'work', name: 'Work', icon: '📁', color: '#10b981' }],
      tags: [{ id: 'urgent', name: 'urgent', color: '#ef4444' }],
      createNote,
      createTag: vi.fn(),
    })
    useUIStore.setState({ quickNoteOpen: true, language: 'en' })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalNotesState, true)
    useUIStore.setState(originalUIState, true)
    vi.restoreAllMocks()
  })

  it('keeps folder and tag selection usable without dismissing the dialog', async () => {
    const user = userEvent.setup()
    render(<QuickNoteModal />)

    const dialog = screen.getByRole('dialog', { name: 'Quick Note' })
    expect(dialog).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/note title/i)).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Select folder' }))
    const folderMenu = await screen.findByRole('menu', { name: 'Select folder' })
    expect(folderMenu).toHaveClass('!z-popover')
    await user.click(screen.getByRole('menuitem', { name: /work/i }))

    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Work' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add tags' }))
    expect(await screen.findByRole('dialog', { name: 'Add tags' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '#urgent' }))

    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove tag urgent' })).toBeInTheDocument()
  })

  it('saves escaped content with the selected metadata using the displayed keyboard command', async () => {
    const user = userEvent.setup()
    render(<QuickNoteModal />)

    await user.type(screen.getByLabelText(/note title/i), 'Launch plan')
    const content = screen.getByLabelText(/note content/i)
    await user.type(content, '<draft>\nNext step')

    await user.click(screen.getByRole('button', { name: 'Select folder' }))
    await user.click(await screen.findByRole('menuitem', { name: /work/i }))
    await user.click(screen.getByRole('button', { name: 'Add tags' }))
    await user.click(await screen.findByRole('button', { name: '#urgent' }))

    expect(screen.getAllByText(/Ctrl \+ Enter/).length).toBeGreaterThan(0)
    fireEvent.keyDown(content, { key: 'Enter', ctrlKey: true })

    expect(createNote).toHaveBeenCalledWith({
      title: 'Launch plan',
      content: '<p>&lt;draft&gt;</p><p>Next step</p>',
      folderId: 'work',
      tags: ['urgent'],
    })
    expect(screen.queryByRole('dialog', { name: 'Quick Note' })).not.toBeInTheDocument()
  })

  it('does not install a second hard-coded new-note shortcut', async () => {
    useUIStore.setState({ quickNoteOpen: false })
    const user = userEvent.setup()
    render(<QuickNoteModal />)

    await user.keyboard('{Control>}n{/Control}')

    expect(useUIStore.getState().quickNoteOpen).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
