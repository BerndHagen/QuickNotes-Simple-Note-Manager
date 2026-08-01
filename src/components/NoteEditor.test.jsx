import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NoteEditor from './NoteEditor'

const mocks = vi.hoisted(() => {
  const toast = vi.fn()
  toast.error = vi.fn()
  toast.success = vi.fn()
  return {
    toast,
    saveNoteVersion: vi.fn(),
    notesState: {},
    uiState: {},
  }
})

vi.mock('react-hot-toast', () => ({ default: mocks.toast }))
vi.mock('../lib/db', () => ({ saveNoteVersion: mocks.saveNoteVersion }))
vi.mock('../lib/useTranslation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (_key, fallback) => fallback || _key,
  }),
}))
vi.mock('../lib/useCollaboration', () => ({ useRealtimeCollaboration: () => {} }))
vi.mock('../lib/backend', () => ({ isBackendConfigured: () => false }))
vi.mock('./SyncStatus', () => ({ SyncStatusPill: () => null }))
vi.mock('./FindReplaceBar', () => ({ default: () => null }))
vi.mock('./NoteStatistics', () => ({ default: () => null }))
vi.mock('./ImageUploadModal', () => ({ default: () => null }))
vi.mock('./LinkInsertModal', () => ({ default: () => null }))
vi.mock('./HTMLEditorModal', () => ({ default: () => null }))
vi.mock('./VoiceInput', () => ({ default: () => null }))
vi.mock('./FolderDialogs', () => ({ ConfirmDialog: () => null }))
vi.mock('./NoteLinkPopover', () => ({
  default: () => null,
  useBacklinks: () => [],
  useNoteLinkHandler: () => {},
}))
vi.mock('./RichTextEditor', () => ({
  default: ({ onDraftChange }) => (
    <button type="button" onClick={() => onDraftChange('<p>Original!</p>')}>
      Simulate content edit
    </button>
  ),
}))
vi.mock('../store', () => {
  const useNotesStore = () => mocks.notesState
  useNotesStore.getState = () => ({ setSelectedNote: vi.fn() })
  return {
    useNotesStore,
    useUIStore: () => mocks.uiState,
    useThemeStore: () => ({ theme: 'light' }),
  }
})

const createNote = () => ({
  id: 'note-1',
  title: 'Original title',
  content: '<p>Original</p>',
  noteData: null,
  noteType: 'standard',
  updatedAt: '2026-08-01T10:00:00.000Z',
  tags: [],
  reminders: [],
  folderId: null,
  starred: false,
  pinned: false,
})

describe('NoteEditor recovery checkpoints', () => {
  beforeEach(() => {
    const note = createNote()
    mocks.note = note
    mocks.saveNoteVersion.mockReset().mockResolvedValue('version-1')
    mocks.toast.error.mockReset()
    mocks.notesState = {
      folders: [],
      tags: [],
      getSelectedNote: () => mocks.note,
      updateNote: vi.fn().mockResolvedValue(undefined),
      updateNoteDraft: vi.fn(),
      deleteNote: vi.fn(),
      toggleStar: vi.fn(),
      togglePin: vi.fn(),
      duplicateNote: vi.fn(),
      moveNote: vi.fn(),
      addTagToNote: vi.fn(),
      removeTagFromNote: vi.fn(),
      createTag: vi.fn(),
      archiveNote: vi.fn(),
      externalUpdate: { noteId: null, token: 0 },
    }
    mocks.uiState = {
      findReplaceOpen: false,
      setFindReplaceOpen: vi.fn(),
      setReminderModalOpen: vi.fn(),
      setExportModalOpen: vi.fn(),
      setImportModalOpen: vi.fn(),
      noteLinkPopoverOpen: false,
      setNoteLinkPopoverOpen: vi.fn(),
      noteLinkPosition: null,
      setImageUploadOpen: vi.fn(),
      setVersionHistoryOpen: vi.fn(),
      setFocusModeOpen: vi.fn(),
      voiceInputActive: false,
      setVoiceInputActive: vi.fn(),
      setShareModalOpen: vi.fn(),
      showNoteStatistics: false,
      confirmBeforeDelete: true,
    }
  })

  it('saves the pre-edit state before even a one-character content change', () => {
    render(<NoteEditor />)

    fireEvent.click(screen.getByRole('button', { name: 'Simulate content edit' }))

    expect(mocks.saveNoteVersion).toHaveBeenCalledWith(
      'note-1',
      '<p>Original</p>',
      'Original title',
      null,
      'standard'
    )
    expect(mocks.notesState.updateNoteDraft).toHaveBeenCalledWith(
      'note-1',
      { content: '<p>Original!</p>' }
    )
  })

  it('creates a recovery checkpoint for a title-only edit', () => {
    render(<NoteEditor />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Note title' }), {
      target: { value: 'Original title!' },
    })

    expect(mocks.saveNoteVersion).toHaveBeenCalledWith(
      'note-1',
      '<p>Original</p>',
      'Original title',
      null,
      'standard'
    )
  })

  it('reports a checkpoint persistence failure without interrupting editing', async () => {
    mocks.saveNoteVersion.mockRejectedValueOnce(new Error('Quota exceeded'))
    render(<NoteEditor />)

    fireEvent.click(screen.getByRole('button', { name: 'Simulate content edit' }))

    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith('Could not create a recovery checkpoint')
    })
    expect(mocks.notesState.updateNoteDraft).toHaveBeenCalled()
  })

  it('restores the persisted title when a remote title save fails', async () => {
    mocks.notesState.updateNote.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<NoteEditor />)
    const title = screen.getByRole('textbox', { name: 'Note title' })

    fireEvent.change(title, { target: { value: 'Unsaved title' } })
    fireEvent.blur(title)

    await waitFor(() => expect(title).toHaveValue('Original title'))
    expect(mocks.toast.error).toHaveBeenCalledWith('Could not save the title')
  })

  it('checkpoints focused-note edits immediately and persists a debounced draft', async () => {
    mocks.note = {
      ...mocks.note,
      noteType: 'todo',
      content: '',
      noteData: { tasks: [], filter: 'all', sortBy: 'priority' },
    }
    render(<NoteEditor />)

    const taskInput = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.change(taskInput, { target: { value: 'Verify the release' } })
    fireEvent.keyDown(taskInput, { key: 'Enter' })

    await waitFor(() => {
      expect(mocks.notesState.updateNoteDraft).toHaveBeenCalledWith(
        'note-1',
        expect.objectContaining({
          noteData: expect.objectContaining({
            tasks: [expect.objectContaining({ text: 'Verify the release' })],
          }),
        })
      )
    })
    expect(mocks.saveNoteVersion).toHaveBeenCalledWith(
      'note-1',
      '',
      'Original title',
      { tasks: [], filter: 'all', sortBy: 'priority' },
      'todo'
    )
    await waitFor(() => {
      expect(mocks.notesState.updateNote).toHaveBeenCalledWith(
        'note-1',
        expect.objectContaining({ noteData: expect.any(Object) })
      )
    }, { timeout: 1_500 })
  })
})
