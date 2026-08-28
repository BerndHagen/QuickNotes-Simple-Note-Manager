import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db, setActiveWorkspaceOwner } from '../../lib/db'
import ResourceManagerModal from './ResourceManagerModal'

describe('ResourceManagerModal damaged attachment recovery', () => {
  beforeEach(async () => {
    setActiveWorkspaceOwner('local')
    await Promise.all([
      db.noteResources.clear(),
      db.resources.clear(),
      db.resourceBlobs.clear(),
      db.recognizedContent.clear(),
      db.intelligenceJobs.clear(),
      db.recordingSessions.clear(),
      db.resourceChunks.clear(),
      db.syncQueue.clear(),
    ])
  })

  it('keeps a broken reference visible and removes it only after explicit confirmation', async () => {
    await db.noteResources.put({
      id: 'link-missing',
      ownerId: 'local',
      noteId: 'note-a',
      resourceId: 'resource-missing',
      role: 'attachment',
      label: 'Lost research.pdf',
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:00.000Z',
    })

    render(
      <ResourceManagerModal
        open
        onClose={vi.fn()}
        note={{ id: 'note-a', title: 'Recovery note' }}
      />
    )

    expect(await screen.findByText('Lost research.pdf')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Attachment source is unavailable' })).toBeInTheDocument()
    expect(screen.getByText(/resource metadata is missing/i)).toBeInTheDocument()
    expect(await db.noteResources.get('link-missing')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove broken reference' }))
    expect(screen.getByRole('button', { name: 'Confirm remove reference' })).toBeInTheDocument()
    expect(await db.noteResources.get('link-missing')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove reference' }))
    await waitFor(async () => expect(await db.noteResources.get('link-missing')).toBeUndefined())
    expect(screen.queryByText('Lost research.pdf')).not.toBeInTheDocument()
  })
})
