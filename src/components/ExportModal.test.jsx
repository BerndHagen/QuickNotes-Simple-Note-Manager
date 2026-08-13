import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useNotesStore, useUIStore } from '../store'
import ExportModal from './ExportModal'

describe('ExportModal visual hierarchy', () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [{
        id: 'export-note',
        title: 'Export contract',
        content: '<p>Body</p>',
        tags: [],
        deleted: false,
        noteType: 'standard',
      }],
      selectedNoteId: 'export-note',
    })
    useUIStore.setState({ exportModalOpen: true })
  })

  afterEach(() => {
    cleanup()
    useUIStore.setState({ exportModalOpen: false })
  })

  it('reserves the textured surface for the banner and uses a standard primary action', () => {
    render(<ExportModal />)

    const dialog = screen.getByRole('dialog', { name: 'Export notes' })
    const exportButton = screen.getByRole('button', { name: 'Export Note' })

    expect(dialog.querySelectorAll('.qn-banner-surface')).toHaveLength(0)
    expect(dialog.querySelector('.qn-dialog-header')).toBeInTheDocument()
    expect(exportButton).not.toHaveClass('qn-banner-surface')
    expect(exportButton).toHaveClass('bg-accent')
  })
})
