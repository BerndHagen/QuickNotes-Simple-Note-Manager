import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore } from '../store'
import UpdateReadyBanner from './UpdateReadyBanner'

const originalState = useNotesStore.getState()

describe('controlled application updates', () => {
  beforeEach(() => {
    useNotesStore.setState({ persistWorkspace: vi.fn(async () => true) })
  })

  afterEach(() => {
    cleanup()
    useNotesStore.setState(originalState, true)
  })

  it('does not activate a waiting build when the current workspace cannot be saved', async () => {
    const persistWorkspace = vi.fn(async () => false)
    useNotesStore.setState({ persistWorkspace })
    const activated = vi.fn()
    window.addEventListener('quicknotes:activate-update', activated)
    render(<UpdateReadyBanner ready />)

    fireEvent.click(screen.getByRole('button', { name: /update and reload/i }))
    await waitFor(() => expect(persistWorkspace).toHaveBeenCalledOnce())
    expect(activated).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /update and reload/i })).toBeEnabled()
    window.removeEventListener('quicknotes:activate-update', activated)
  })

  it('activates only after the workspace save completes', async () => {
    let finishSave
    const persistWorkspace = vi.fn(() => new Promise((resolve) => { finishSave = resolve }))
    useNotesStore.setState({ persistWorkspace })
    const activated = vi.fn()
    window.addEventListener('quicknotes:activate-update', activated)
    render(<UpdateReadyBanner ready />)

    fireEvent.click(screen.getByRole('button', { name: /update and reload/i }))
    expect(screen.getByRole('button', { name: /preparing update/i })).toBeDisabled()
    expect(activated).not.toHaveBeenCalled()

    await act(async () => finishSave(true))
    expect(activated).toHaveBeenCalledOnce()
    window.removeEventListener('quicknotes:activate-update', activated)
  })
})
