import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore } from '../store'
import CatalogConflictBanner from './CatalogConflictBanner'

describe('CatalogConflictBanner', () => {
  beforeEach(() => {
    useNotesStore.setState({ catalogConflicts: [] })
  })

  it('explains a remote deletion and requires an explicit choice', async () => {
    const user = userEvent.setup()
    const resolveCatalogConflict = vi.fn(async () => true)
    useNotesStore.setState({
      catalogConflicts: [{
        table: 'folders',
        stateKey: 'folders',
        recordId: 'folder-1',
        remote: null,
      }],
      resolveCatalogConflict,
    })

    render(<CatalogConflictBanner />)

    expect(screen.getByRole('alert')).toHaveTextContent(/deleted on another device/i)
    await user.click(screen.getByRole('button', { name: 'Accept deletion' }))
    expect(resolveCatalogConflict).toHaveBeenCalledWith('incoming')
  })
})
