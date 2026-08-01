import { describe, expect, it } from 'vitest'
import {
  createWorkspaceBackup,
  parseWorkspaceBackup,
  prepareWorkspaceImport,
  WORKSPACE_BACKUP_FORMAT,
} from './workspaceBackup'

const makeIds = () => {
  let value = 0
  return () => `new-${++value}`
}

describe('workspace backups', () => {
  it('exports a versioned document without sync or account metadata', () => {
    const backup = createWorkspaceBackup({
      notes: [{ id: 'n1', title: 'Plan', content: '<p>Body</p>', syncStatus: 'synced', userId: 'u1' }],
      folders: [{ id: 'f1', name: 'Work', syncStatus: 'pending' }],
      tags: [{ id: 't1', name: 'important', syncStatus: 'pending' }],
    }, '2026-08-01T10:00:00.000Z')

    expect(backup).toMatchObject({
      format: WORKSPACE_BACKUP_FORMAT,
      schemaVersion: 1,
      exportedAt: '2026-08-01T10:00:00.000Z',
    })
    expect(backup.notes[0]).not.toHaveProperty('syncStatus')
    expect(backup.notes[0]).not.toHaveProperty('userId')
    expect(backup.folders[0]).not.toHaveProperty('syncStatus')
  })

  it('accepts legacy exports and rejects malformed or newer backups', () => {
    expect(parseWorkspaceBackup(JSON.stringify({ notes: [], folders: [{ id: 'f', name: 'Work' }], tags: [] }))).toMatchObject({
      folders: [{ id: 'f', name: 'Work' }],
    })
    expect(() => parseWorkspaceBackup('{bad json')).toThrow('valid JSON')
    expect(() => parseWorkspaceBackup({ notes: 'wrong' })).toThrow('notes list')
    expect(() => parseWorkspaceBackup({ schemaVersion: 2, notes: [] })).toThrow('newer')
  })

  it('merges safely, remaps hierarchy and internal links, and preserves structured data', () => {
    const result = prepareWorkspaceImport({
      notes: [
        {
          id: 'n1',
          title: 'Imported project',
          content: '<p><a href="note://n2" data-note-id="n2">Next</a><script>alert(1)</script></p>',
          folderId: 'child',
          tags: ['Important', 'invalid'.repeat(20)],
          noteType: 'project',
          noteData: { columns: [{ id: 'todo', tasks: [] }] },
          reminders: [{ id: 'r1', datetime: '2099-01-01T10:00:00.000Z' }],
        },
        { id: 'n2', title: 'Target', content: '<p>Target</p>' },
      ],
      folders: [
        { id: 'parent', name: 'Work' },
        { id: 'child', name: 'Child', parentId: 'parent' },
      ],
      tags: [{ id: 't1', name: 'Important', color: '#ff0000' }],
    }, {
      notes: [],
      folders: [{ id: 'existing-folder', name: 'Work' }],
      tags: [{ id: 'existing-tag', name: 'important' }],
    }, {
      createId: makeIds(),
      now: '2026-08-01T12:00:00.000Z',
    })

    expect(result.folders.map((folder) => folder.name)).toEqual(['Work (imported)', 'Child'])
    expect(result.folders[1].parentId).toBe(result.folders[0].id)
    expect(result.tags).toHaveLength(0)
    expect(result.notes[0]).toMatchObject({
      folderId: result.folders[1].id,
      tags: ['important'],
      noteType: 'project',
      noteData: { columns: [{ id: 'todo', tasks: [] }] },
      reminders: [{ id: 'r1', datetime: '2099-01-01T10:00:00.000Z' }],
      syncStatus: 'pending',
    })
    expect(result.notes[0].content).not.toContain('<script')
    expect(result.notes[0].content).toContain('href="#"')
    expect(result.notes[0].content).toContain(`data-note-id="${result.notes[1].id}"`)
  })

  it('breaks cyclic folder parents and strips prototype-pollution keys', () => {
    const structured = JSON.parse('{"safe":true,"__proto__":{"polluted":true}}')
    const result = prepareWorkspaceImport({
      notes: [{ id: 'n1', title: 'Safe', noteData: structured }],
      folders: [
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
      tags: [],
    }, { notes: [], folders: [], tags: [] }, { createId: makeIds() })

    expect(result.folders.every((folder) => folder.parentId === null)).toBe(true)
    expect(result.notes[0].noteData).toEqual({ safe: true })
    expect({}.polluted).toBeUndefined()
  })
})
