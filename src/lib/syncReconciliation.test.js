import { describe, expect, it } from 'vitest'
import { buildFolderIdRemap, remapNoteFolder } from './syncReconciliation'

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
