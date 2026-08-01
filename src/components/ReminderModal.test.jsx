import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore, useUIStore } from '../store'
import ReminderModal from './ReminderModal'

const originalNotesState = useNotesStore.getState()
const originalUIState = useUIStore.getState()

describe('ReminderModal', () => {
  let updateNote

  beforeEach(() => {
    updateNote = vi.fn()
    useNotesStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Project brief',
          reminders: [],
        },
      ],
      selectedNoteId: 'note-1',
      updateNote,
    })
    useUIStore.setState({
      reminderModalOpen: true,
      reminderNoteId: 'note-1',
      language: 'en',
    })

    class NotificationMock {
      static permission = 'granted'
      static requestPermission = vi.fn().mockResolvedValue('granted')
    }
    vi.stubGlobal('Notification', NotificationMock)
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalNotesState, true)
    useUIStore.setState(originalUIState, true)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses associated, responsive form controls and stores a future reminder', async () => {
    const user = userEvent.setup()
    render(<ReminderModal />)

    const dialog = screen.getByRole('dialog', { name: 'Reminders' })
    expect(dialog).toHaveAccessibleDescription('Set reminders for your notes')
    expect(screen.getByLabelText('Date').closest('.grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2')

    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), '2099-01-15')
    await user.clear(screen.getByLabelText('Time'))
    await user.type(screen.getByLabelText('Time'), '10:30')
    await user.selectOptions(screen.getByLabelText('Repeat'), 'weekly')
    await user.click(screen.getByRole('button', { name: 'Add Reminder' }))

    await waitFor(() => expect(updateNote).toHaveBeenCalled())
    const [, update] = updateNote.mock.calls.at(-1)
    expect(update.reminders).toHaveLength(1)
    expect(update.reminders[0]).toMatchObject({ repeat: 'weekly', notified: false })
    expect(new Date(update.reminders[0].datetime).getFullYear()).toBe(2099)
  })

  it('gives each destructive reminder action a specific accessible name', async () => {
    const reminder = {
      id: 'reminder-1',
      datetime: '2099-01-15T10:30:00.000Z',
      repeat: 'none',
      notified: false,
    }
    useNotesStore.setState({
      notes: [{ id: 'note-1', title: 'Project brief', reminders: [reminder] }],
    })
    const user = userEvent.setup()
    render(<ReminderModal />)

    const deleteButton = await screen.findByRole('button', { name: /delete reminder for/i })
    await user.click(deleteButton)

    const [, update] = updateNote.mock.calls.at(-1)
    expect(update).toEqual({ reminders: [] })
  })
})
