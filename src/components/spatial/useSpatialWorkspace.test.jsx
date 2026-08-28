import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  loadSpatialWorkspace: vi.fn(),
  saveSpatialChanges: vi.fn(),
}))

vi.mock('../../lib/spatial/repository', () => repository)
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

import useSpatialWorkspace from './useSpatialWorkspace'

const workspace = {
  document: { noteId: 'canvas', kind: 'canvas', schemaVersion: 1, revision: 0, settings: {}, viewport: { panX: 0, panY: 0, zoom: 1 } },
  pages: [],
  objects: [],
  resources: [],
}

describe('spatial persistence status', () => {
  beforeEach(() => {
    repository.loadSpatialWorkspace.mockReset().mockResolvedValue(structuredClone(workspace))
    repository.saveSpatialChanges.mockReset()
  })

  it('keeps failed work in memory, reports an error, and retries the same transaction', async () => {
    repository.saveSpatialChanges.mockRejectedValueOnce(new Error('Quota exceeded'))
    const { result } = renderHook(() => useSpatialWorkspace({ id: 'canvas' }, 'canvas'))
    await waitFor(() => expect(result.current.workspace).not.toBeNull())

    const object = { id: 'sticky', noteId: 'canvas', kind: 'sticky', zIndex: 1, bounds: { x: 0, y: 0, width: 100, height: 100 }, data: { text: 'Durable draft' } }
    act(() => result.current.commit({ putObjects: [object] }, { label: 'Add sticky' }))
    expect(result.current.workspace.objects).toEqual([object])
    await waitFor(() => expect(result.current.saveStatus).toBe('error'))

    repository.saveSpatialChanges.mockResolvedValue({ ...workspace.document, revision: 1 })
    act(() => result.current.retrySave())
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'))
    expect(repository.saveSpatialChanges).toHaveBeenCalledTimes(2)
    expect(repository.saveSpatialChanges.mock.calls[1][1]).toEqual({ putObjects: [object] })
  })
})
