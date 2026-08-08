import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore } from '../store'
import { SaveStatus } from './SyncStatus'

vi.mock('../lib/backend', () => ({ isBackendConfigured: () => true }))

const originalState = useNotesStore.getState()
const note = {
  id: 'note-1',
  title: 'Status note',
  updatedAt: '2026-08-08T12:00:00.000Z',
  syncStatus: 'pending',
}

describe('SaveStatus', () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [note],
      user: { id: 'user-1', isLocal: false },
      isOnline: true,
      isSyncing: false,
      lastSyncError: null,
      lastSyncTime: null,
    })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalState, true)
  })

  it('labels a durable cloud backlog as waiting to sync instead of saving', () => {
    render(<SaveStatus note={note} />)
    expect(screen.getByText(/Saved locally.*Waiting to sync/i)).toBeInTheDocument()
    expect(screen.queryByText(/Saving/i)).not.toBeInTheDocument()
  })

  it('distinguishes synchronization, offline, failure, and synchronized states', () => {
    const { rerender } = render(<SaveStatus note={note} />)

    act(() => useNotesStore.setState({ isSyncing: true }))
    rerender(<SaveStatus note={note} />)
    expect(screen.getByText(/Syncing|Synchronizing/i)).toBeInTheDocument()

    act(() => useNotesStore.setState({ isSyncing: false, isOnline: false }))
    rerender(<SaveStatus note={note} />)
    expect(screen.getByText(/Saved locally.*Offline/i)).toBeInTheDocument()

    act(() => useNotesStore.setState({ isOnline: true, lastSyncError: 'Network unavailable' }))
    rerender(<SaveStatus note={note} />)
    expect(screen.getByText(/Saved locally.*Sync failed/i)).toBeInTheDocument()

    act(() => useNotesStore.setState({
      notes: [{ ...note, syncStatus: 'synced' }],
      lastSyncError: null,
    }))
    rerender(<SaveStatus note={{ ...note, syncStatus: 'synced' }} />)
    expect(screen.getByText(/Synced|Synchronized/i)).toBeInTheDocument()
  })
})
