import { describe, expect, it } from 'vitest'
import {
  buildFolderIdRemap,
  buildOperationIndex,
  isRemoteNewer,
  remapNoteFolder,
  shouldUploadPendingRecord,
} from './syncReconciliation'

describe('cloud folder reconciliation', () => {
  it('maps same-name local folders to the existing cloud UUID case-insensitively', () => {
    const remap = buildFolderIdRemap(
      [{ id: 'local-work', name: ' Work ' }, { id: 'local-ideas', name: 'Ideas' }],
      [{ id: 'cloud-work', name: 'work' }]
    )

    expect(remap.get('local-work')).toBe('cloud-work')
    expect(remap.has('local-ideas')).toBe(false)
    expect(remapNoteFolder({ id: 'note', folderId: 'local-work' }, remap)).toEqual({
      id: 'note',
      folderId: 'cloud-work',
    })
  })

  it('does not remap a local folder that already has the cloud UUID', () => {
    const remap = buildFolderIdRemap(
      [{ id: 'same-id', name: 'Renamed locally' }],
      [{ id: 'same-id', name: 'Old cloud name' }]
    )
    expect(remap.size).toBe(0)
  })
})

describe('pending record reconciliation', () => {
  const remoteIds = new Set(['remote-record'])
  const operations = buildOperationIndex(
    [
      { table: 'notes', operation: 'insert', data: { id: 'local-create' } },
      { table: 'notes', operation: 'update', data: { id: 'remote-delete' } },
      { table: 'folders', operation: 'insert', data: { id: 'other-table' } },
    ],
    'notes'
  )

  it('uploads creates and updates to rows that still exist remotely', () => {
    expect(
      shouldUploadPendingRecord(
        { id: 'local-create', syncStatus: 'pending' },
        remoteIds,
        operations
      )
    ).toBe(true)
    expect(
      shouldUploadPendingRecord(
        { id: 'remote-record', syncStatus: 'pending' },
        remoteIds,
        operations
      )
    ).toBe(true)
  })

  it('does not resurrect an update-only row deleted on another client', () => {
    expect(
      shouldUploadPendingRecord(
        { id: 'remote-delete', syncStatus: 'pending' },
        remoteIds,
        operations
      )
    ).toBe(false)
  })

  it('adopts legacy pending rows that have no operation journal', () => {
    expect(
      shouldUploadPendingRecord(
        { id: 'legacy', syncStatus: 'pending' },
        remoteIds,
        operations
      )
    ).toBe(true)
  })

  it('uploads legacy creates whose records predate sync status', () => {
    expect(
      shouldUploadPendingRecord(
        { id: 'local-create' },
        remoteIds,
        operations
      )
    ).toBe(true)
  })

  it('never uploads clean rows', () => {
    expect(
      shouldUploadPendingRecord(
        { id: 'remote-record', syncStatus: 'synced' },
        remoteIds,
        operations
      )
    ).toBe(false)
  })

  it('compares valid timestamps with the conflict buffer', () => {
    expect(
      isRemoteNewer('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:03.000Z')
    ).toBe(true)
    expect(
      isRemoteNewer('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z')
    ).toBe(false)
    expect(isRemoteNewer('invalid', '2026-01-01T00:00:03.000Z')).toBe(false)
  })
})
