import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore, useUIStore } from '../store'
import VersionHistoryModal, {
  getStructuredVersionPreview,
  parseVersionNoteData,
} from './VersionHistoryModal'

const mocks = vi.hoisted(() => ({
  getNoteVersions: vi.fn(),
  getRemoteNoteVersions: vi.fn(),
  isBackendConfigured: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../lib/db', () => ({ getNoteVersions: mocks.getNoteVersions }))
vi.mock('../lib/backend', () => ({
  getRemoteNoteVersions: mocks.getRemoteNoteVersions,
  isBackendConfigured: mocks.isBackendConfigured,
}))
vi.mock('react-hot-toast', () => ({
  default: { success: mocks.toastSuccess, error: mocks.toastError },
}))

const originalNotesState = useNotesStore.getState()
const originalUIState = useUIStore.getState()

describe('VersionHistoryModal', () => {
  let updateNote

  beforeEach(() => {
    updateNote = vi.fn().mockResolvedValue(undefined)
    mocks.getNoteVersions.mockResolvedValue([])
    mocks.getRemoteNoteVersions.mockResolvedValue([])
    mocks.isBackendConfigured.mockReturnValue(false)
    useNotesStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Release checklist',
          noteType: 'todo',
          noteData: { tasks: [{ id: 'current', text: 'Current task', completed: false }] },
          content: '',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
      sharedNotes: [],
      updateNote,
    })
    useUIStore.setState({
      versionHistoryOpen: true,
      versionHistoryNoteId: 'note-1',
      language: 'en',
    })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalNotesState, true)
    useUIStore.setState(originalUIState, true)
    vi.clearAllMocks()
  })

  it('selects history with the keyboard and renders structured data as safe product copy', async () => {
    const user = userEvent.setup()
    const hostileTask = '<img src=x onerror=globalThis.compromised=true>'
    mocks.getNoteVersions.mockResolvedValue([
      {
        id: 'version-1',
        createdAt: '2026-07-31T10:00:00.000Z',
        title: 'Earlier checklist',
        noteType: 'todo',
        noteData: JSON.stringify({
          tasks: [{ id: 'task-1', text: hostileTask, completed: false }],
        }),
      },
    ])

    const { container } = render(<VersionHistoryModal />)
    const versionButton = await screen.findByRole('button', { name: /version 1/i })
    versionButton.focus()
    await user.keyboard('{Enter}')

    expect(versionButton).toHaveAttribute('aria-pressed', 'true')
    const versionsRegion = screen.getByRole('region', { name: 'Saved versions' })
    expect(versionsRegion).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('region', { name: 'Version preview' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByText(hostileTask)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText(/"tasks"\s*:/)).not.toBeInTheDocument()
    expect(versionsRegion.parentElement).toHaveClass(
      'md:grid-cols-[minmax(15rem,0.9fr)_minmax(0,2fr)]'
    )

    await user.click(screen.getByRole('button', { name: 'Restore this version' }))
    const confirmation = screen.getByRole('dialog', { name: 'Restore this version?' })
    expect(confirmation).toHaveAccessibleDescription(/current note will be replaced/i)
    await user.click(screen.getByRole('button', { name: 'Restore version' }))

    await waitFor(() =>
      expect(updateNote).toHaveBeenCalledWith('note-1', {
        noteData: { tasks: [{ id: 'task-1', text: hostileTask, completed: false }] },
        title: 'Earlier checklist',
        noteType: 'todo',
      })
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Version restored')
  })

  it('blocks a damaged structured snapshot instead of exposing or restoring it', async () => {
    const user = userEvent.setup()
    mocks.getNoteVersions.mockResolvedValue([
      {
        id: 'version-bad',
        createdAt: '2026-07-30T10:00:00.000Z',
        noteType: 'todo',
        noteData: '{not valid JSON',
      },
    ])

    render(<VersionHistoryModal />)
    await user.click(await screen.findByRole('button', { name: /version 1/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be restored safely/i)
    expect(screen.getByRole('button', { name: 'Restore this version' })).toBeDisabled()
    expect(updateNote).not.toHaveBeenCalled()
  })

  it('parses object snapshots without evaluating their contents', () => {
    const parsed = parseVersionNoteData('{"ideas":[{"text":"<script>bad()</script>"}]}')
    const preview = getStructuredVersionPreview('brainstorm', parsed.data)

    expect(parsed.error).toBeNull()
    expect(preview.highlights).toEqual(['<script>bad()</script>'])
    expect(globalThis.compromised).toBeUndefined()
  })
})
