import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizeNoteHtml } from '../lib/sanitizeHtml'
import { backend } from '../lib/backend'
import { useNotesStore, useUIStore } from '../store'
import NoteLinkPopover, { useBacklinks, useNoteLinkHandler } from './NoteLinkPopover'
import NotePreviewPopover from './NotePreviewPopover'
import EditorSettingsModal, { normalizeEditorSettings, useEditorSettings } from './EditorSettingsModal'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'
import NoteTypesModal from './NoteTypesModal'
import TagManagerModal from './TagManagerModal'
import TableBubbleMenu from './TableBubbleMenu'
import { ConfirmDialog, FolderDialog } from './FolderDialogs'
import SharedNotesView from './SharedNotesView'
import PasswordRecoveryScreen from './PasswordRecoveryScreen'

vi.mock('@tiptap/react', () => ({
  BubbleMenu: ({ children }) => <div>{children}</div>,
}))

const originalNotesState = useNotesStore.getState()
const originalUIState = useUIStore.getState()

function createEditor() {
  const chain = {}
  for (const command of [
    'focus',
    'insertContent',
    'addColumnBefore',
    'addColumnAfter',
    'deleteColumn',
    'addRowBefore',
    'addRowAfter',
    'deleteRow',
    'setCellAttribute',
    'mergeCells',
    'splitCell',
    'toggleHeaderRow',
    'toggleHeaderColumn',
    'deleteTable',
    'command',
  ]) {
    chain[command] = vi.fn(() => chain)
  }
  chain.run = vi.fn(() => true)

  return {
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({ mergeCells: () => true, splitCell: () => true })),
    getAttributes: vi.fn(() => ({})),
    isActive: vi.fn(() => true),
    state: {
      selection: { $from: { depth: 0 } },
      doc: { nodesBetween: vi.fn() },
    },
    testChain: chain,
  }
}

beforeEach(() => {
  useNotesStore.setState({
    notes: [],
    folders: [],
    tags: [],
    sharedNotes: [],
    pendingShares: [],
  })
  useUIStore.setState({
    editorSettingsOpen: false,
    shortcutsModalOpen: false,
    noteTypesModalOpen: false,
    tagManagerOpen: false,
    sharedNotesViewOpen: false,
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  useNotesStore.setState(originalNotesState, true)
  useUIStore.setState(originalUIState, true)
})

describe('internal note links', () => {
  it('inserts a sanitization-safe link without interpreting the title as markup', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    useNotesStore.setState({
      notes: [{ id: 'note-2', title: '"><img src=x onerror=alert(1)>', content: '', updatedAt: '2026-01-01' }],
    })

    render(<NoteLinkPopover editor={editor} isOpen onClose={() => {}} position={{ x: 0, y: 0 }} />)
    await user.click(screen.getByRole('option'))

    const inserted = editor.testChain.insertContent.mock.calls[0][0]
    expect(inserted).toContain('href="#note/note-2"')
    expect(inserted).toContain('data-note-id="note-2"')
    expect(inserted).not.toContain('<img')
    expect(sanitizeNoteHtml(inserted)).toContain('data-note-id="note-2"')
  })

  it('does not offer the current note or notes in trash as link targets', () => {
    useNotesStore.setState({
      notes: [
        { id: 'current', title: 'Current', content: '', updatedAt: '2026-01-03' },
        { id: 'deleted', title: 'Deleted', content: '', deleted: true, updatedAt: '2026-01-02' },
        { id: 'target', title: 'Target', content: '', updatedAt: '2026-01-01' },
      ],
    })

    render(
      <NoteLinkPopover
        editor={createEditor()}
        isOpen
        currentNoteId="current"
        onClose={() => {}}
        position={{ x: 0, y: 0 }}
      />
    )

    expect(screen.getByRole('option', { name: /Target/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Current/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Deleted/ })).not.toBeInTheDocument()
  })

  it('navigates safe internal links without changing the URL and resolves their backlinks', () => {
    const setSelectedNote = vi.fn()
    useNotesStore.setState({
      notes: [
        { id: 'target', title: 'Target', content: '' },
        { id: 'source', title: 'Source', content: '<p><a href="#note/target" class="note-link" data-note-id="target">Target</a></p>' },
      ],
      setSelectedNote,
    })
    function LinkHarness() {
      useNoteLinkHandler()
      const backlinks = useBacklinks('target')
      return (
        <>
          <a href="#note/target" className="note-link" data-note-id="target">Open target</a>
          <output aria-label="Backlinks">{backlinks.map((note) => note.id).join(',')}</output>
        </>
      )
    }
    render(<LinkHarness />)

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(screen.getByRole('link', { name: 'Open target' }).dispatchEvent(click)).toBe(false)
    expect(setSelectedNote).toHaveBeenCalledWith('target')
    expect(screen.getByLabelText('Backlinks')).toHaveTextContent('source')
  })

  it('treats links to trashed notes as unavailable', () => {
    const setSelectedNote = vi.fn()
    useNotesStore.setState({
      notes: [{ id: 'target', title: 'Target', content: '', deleted: true }],
      setSelectedNote,
    })
    function LinkHarness() {
      useNoteLinkHandler()
      return <a href="#note/target" className="note-link" data-note-id="target">Open target</a>
    }
    render(<LinkHarness />)

    fireEvent.click(screen.getByRole('link', { name: 'Open target' }))
    expect(setSelectedNote).not.toHaveBeenCalled()
  })
})

describe('note previews', () => {
  it('falls back to the available side, supports focus, and preserves child handlers', async () => {
    vi.useFakeTimers()
    const onFocus = vi.fn()
    useNotesStore.setState({
      notes: [{ id: 'n1', title: 'Preview me', content: '<p>Body</p>', updatedAt: '2026-01-01' }],
    })
    render(
      <NotePreviewPopover noteId="n1" position="right">
        <button type="button" onFocus={onFocus}>Preview trigger</button>
      </NotePreviewPopover>
    )
    const trigger = screen.getByRole('button', { name: 'Preview trigger' })
    trigger.getBoundingClientRect = () => ({ left: 980, right: 1000, top: 20, bottom: 40, width: 20, height: 20 })

    fireEvent.focus(trigger)
    act(() => vi.runOnlyPendingTimers())

    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(Number.parseFloat(screen.getByRole('tooltip').style.left)).toBeGreaterThanOrEqual(10)
    expect(trigger).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
  })
})

describe('editor preferences and shortcuts', () => {
  it('normalizes JSON-valid but unsupported editor settings', () => {
    expect(normalizeEditorSettings({
      defaultFontFamily: 'url(javascript:alert(1))',
      defaultFontSize: '999px',
      defaultLineHeight: -4,
      tabSize: 999,
      wordWrap: 'yes',
      showRuler: true,
      documentWidth: 'wide',
      ribbonDensity: 'compact',
      defaultCheckboxStyle: 'circle',
    })).toMatchObject({
      defaultFontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      defaultFontSize: '16px',
      defaultLineHeight: '1.5',
      tabSize: 4,
      wordWrap: true,
      showRuler: true,
      documentWidth: 'wide',
      ribbonDensity: 'compact',
      defaultCheckboxStyle: 'circle',
    })
  })

  it('uses the application spell-check preference as the single source of truth', () => {
    localStorage.setItem('editorSettings', JSON.stringify({ spellCheck: true }))
    useUIStore.setState({ spellCheck: false })
    const { result } = renderHook(() => useEditorSettings())
    expect(result.current.spellCheck).toBe(false)
  })

  it('reports browser storage failures instead of throwing from the settings effect', async () => {
    useUIStore.setState({ editorSettingsOpen: true })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    render(<EditorSettingsModal />)

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    expect(screen.getByLabelText('Default Font Family')).toBeInTheDocument()
  })

  it('keeps shortcut changes dirty and explains when saving fails', async () => {
    const user = userEvent.setup()
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    const shortcut = await screen.findByRole('button', { name: /Change shortcut for New quick note/i })
    await user.click(shortcut)
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('have not been applied')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })
})

describe('table tools', () => {
  it('opens menus and runs table commands from the keyboard', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    render(<TableBubbleMenu editor={editor} />)

    const columns = screen.getByRole('button', { name: 'Columns' })
    act(() => columns.focus())
    await user.keyboard('{Enter}')
    expect(columns).toHaveFocus()
    const insertLeft = screen.getByRole('menuitem', { name: /(?:Insert Left|Add Column Before)/ })
    act(() => insertLeft.focus())
    await user.keyboard('{Enter}')

    expect(editor.testChain.addColumnBefore).toHaveBeenCalledTimes(1)
  })
})

describe('creation and destructive workflows', () => {
  it('creates the selected starter from Enter even when the optional title is blank', async () => {
    const createNote = vi.fn(() => ({ id: 'created' }))
    useNotesStore.setState({ createNote })
    useUIStore.setState({ noteTypesModalOpen: true })
    render(<NoteTypesModal />)

    const title = screen.getByLabelText('Note title')
    fireEvent.change(title, { target: { value: '' } })
    fireEvent.keyDown(title, { key: 'Enter' })

    expect(createNote).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) }))
    expect(createNote.mock.calls[0][0].title.length).toBeGreaterThan(0)
  })

  it('keeps a confirmation open and surfaces a rejected action', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => Promise.reject(new Error('Server refused the request'))}
        title="Delete item?"
      />
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Server refused the request')
    expect(screen.getByRole('dialog', { name: 'Delete item?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('ignores malformed existing folder names during duplicate validation', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <FolderDialog
        open
        onClose={() => {}}
        onSubmit={onSubmit}
        existingNames={[null, 42, 'Projects']}
      />
    )
    await user.type(screen.getByLabelText(/Folder name/i), 'Inbox')
    await user.click(screen.getByRole('button', { name: /^Create(?: folder)?$/ }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Inbox' }))
  })

  it('filters the folder icon library without changing the selected icon', async () => {
    const user = userEvent.setup()
    render(
      <FolderDialog
        open
        onClose={() => {}}
        onSubmit={() => {}}
      />
    )

    const selectedIcon = screen.getByRole('radio', { name: 'Folder' })
    expect(selectedIcon).toHaveAttribute('aria-checked', 'true')

    await user.type(screen.getByRole('searchbox', { name: 'Search folder icons' }), 'anchor')
    expect(screen.getByRole('radio', { name: 'Anchor' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Folder' })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Search folder icons' }))
    expect(screen.getByRole('radio', { name: 'Folder' })).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps tag input intact when creation fails and ignores malformed stored tags', async () => {
    const user = userEvent.setup()
    const createTag = vi.fn(() => {
      throw new Error('Tag storage is unavailable')
    })
    useNotesStore.setState({ tags: [null], createTag })
    useUIStore.setState({ tagManagerOpen: true })
    render(<TagManagerModal />)

    await user.click(screen.getByRole('button', { name: /Add New Tag/i }))
    const name = screen.getByRole('textbox', { name: 'Tag name' })
    await user.type(name, '  Project  ')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(createTag).toHaveBeenCalledWith({ name: 'Project', color: '#3b82f6' })
    expect(name).toHaveValue('  Project  ')
    expect(screen.getByRole('radiogroup', { name: 'New tag colour' })).toBeInTheDocument()
  })
})

describe('shared notes', () => {
  it('shows owner provenance and filters accepted shares by owner and permission', async () => {
    const user = userEvent.setup()
    useNotesStore.setState({
      sharedNotes: [
        {
          id: 'accepted-1',
          note_id: 'n1',
          owner_name: 'alex-rivera',
          permission: 'edit',
          notes: { id: 'n1', title: 'Launch plan', content: '<p>Milestones</p>', updatedAt: '2026-08-08' },
        },
        {
          id: 'accepted-2',
          note_id: 'n2',
          owner_name: 'morgan-lee',
          permission: 'view',
          notes: { id: 'n2', title: 'Budget', content: '<p>Forecast</p>', updatedAt: '2026-08-07' },
        },
      ],
      loadSharedNotes: vi.fn().mockResolvedValue(undefined),
      acceptShare: vi.fn(),
      declineShare: vi.fn(),
      leaveSharedNote: vi.fn(),
      setSelectedNoteId: vi.fn(),
    })
    useUIStore.setState({ sharedNotesViewOpen: true })
    render(<SharedNotesView />)

    expect(screen.getByText('Owner: @alex-rivera')).toBeInTheDocument()
    expect(screen.getByText('Owner: @morgan-lee')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search shared notes' }), 'morgan')
    await waitFor(() => {
      expect(screen.queryByText('Launch plan')).not.toBeInTheDocument()
      expect(screen.getByText('Budget')).toBeInTheDocument()
    })

    await user.clear(screen.getByRole('searchbox', { name: 'Search shared notes' }))
    await user.selectOptions(screen.getByLabelText('Filter shared notes by permission'), 'edit')
    await waitFor(() => {
      expect(screen.getByText('Launch plan')).toBeInTheDocument()
      expect(screen.queryByText('Budget')).not.toBeInTheDocument()
    })
  })

  it('prevents duplicate accepts and presents a failed invitation action', async () => {
    const user = userEvent.setup()
    let rejectAccept
    const acceptShare = vi.fn(() => new Promise((_, reject) => { rejectAccept = reject }))
    useNotesStore.setState({
      pendingShares: [{ id: 'share-1', shared_by: 'alex-rivera', permission: 'view', notes: { id: 'n1', title: 'Plan' } }],
      loadSharedNotes: vi.fn().mockResolvedValue(undefined),
      acceptShare,
      declineShare: vi.fn(),
      leaveSharedNote: vi.fn(),
      setSelectedNoteId: vi.fn(),
    })
    useUIStore.setState({ sharedNotesViewOpen: true })
    render(<SharedNotesView />)

    await user.click(await screen.findByRole('tab', { name: /Pending/ }))
    const accept = screen.getByRole('button', { name: 'Accept' })
    await user.click(accept)
    expect(accept).toBeDisabled()
    fireEvent.click(accept)
    expect(acceptShare).toHaveBeenCalledTimes(1)

    act(() => rejectAccept(new Error('Invitation expired')))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invitation expired')
    expect(accept).toBeEnabled()
  })

  it('keeps the decline confirmation open when the server rejects it', async () => {
    const user = userEvent.setup()
    useNotesStore.setState({
      pendingShares: [{ id: 'share-1', shared_by: 'alex@example.com', permission: 'view', notes: { id: 'n1', title: 'Plan' } }],
      loadSharedNotes: vi.fn().mockResolvedValue(undefined),
      acceptShare: vi.fn(),
      declineShare: vi.fn().mockRejectedValue(new Error('Invitation already changed')),
      leaveSharedNote: vi.fn(),
      setSelectedNoteId: vi.fn(),
    })
    useUIStore.setState({ sharedNotesViewOpen: true })
    render(<SharedNotesView />)
    await user.click(await screen.findByRole('tab', { name: /Pending/ }))
    await user.click(screen.getByRole('button', { name: 'Decline' }))

    const dialogs = screen.getAllByRole('dialog')
    const confirmation = dialogs.find((dialog) => within(dialog).queryByText('Decline invitation?'))
    await user.click(within(confirmation).getByRole('button', { name: 'Decline' }))
    expect(await within(confirmation).findByRole('alert')).toHaveTextContent('Invitation already changed')
  })
})

describe('password recovery', () => {
  it('associates a mismatch with the confirmation field and moves focus there', async () => {
    const user = userEvent.setup()
    const updateUser = vi.spyOn(backend.auth, 'updateUser')
    render(<PasswordRecoveryScreen onComplete={() => {}} onCancel={() => {}} />)

    await user.type(screen.getByLabelText('New password'), 'a sufficiently long passphrase')
    await user.type(screen.getByLabelText('Confirm new password'), 'a different long passphrase')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    const confirmation = screen.getByLabelText('Confirm new password')
    expect(confirmation).toHaveFocus()
    expect(confirmation).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(updateUser).not.toHaveBeenCalled()
  })
})
