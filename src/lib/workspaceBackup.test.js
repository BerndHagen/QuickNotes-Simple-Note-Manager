import { describe, expect, it } from 'vitest'
import {
  createWorkspaceArchive,
  createWorkspaceBackup,
  mergeWorkspaceNoteVersionsForBackup,
  parseWorkspaceArchive,
  parseWorkspaceBackup,
  prepareWorkspaceImport,
  WORKSPACE_BACKUP_FORMAT,
} from './workspaceBackup'

const makeIds = () => {
  let value = 0
  return () => `new-${++value}`
}

describe('workspace backups', () => {
  it('merges local and server-retained history without duplicates and caps each note at thirty versions', () => {
    const versions = Array.from({ length: 31 }, (_, index) => ({
      noteId: 'n1',
      title: `Version ${index}`,
      content: `<p>${index}</p>`,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      snapshotHash: `hash-${index}`,
    }))
    const duplicate = { ...versions[30], id: 'remote-copy', source: 'remote' }
    const otherNote = { noteId: 'n2', title: 'Other', content: '<p>Other</p>', createdAt: '2026-01-01T00:00:00.000Z' }

    const merged = mergeWorkspaceNoteVersionsForBackup(versions, [duplicate, otherNote])

    expect(merged.filter((version) => version.noteId === 'n1')).toHaveLength(30)
    expect(merged.filter((version) => version.noteId === 'n1').map((version) => version.title)).not.toContain('Version 0')
    expect(merged.filter((version) => version.snapshotHash === 'hash-30')).toHaveLength(1)
    expect(merged).toContain(otherNote)
  })

  it('exports a versioned document without sync or account metadata', () => {
    const backup = createWorkspaceBackup({
      notes: [{ id: 'n1', title: 'Plan', content: '<p>Body</p>', syncStatus: 'synced', userId: 'u1' }],
      folders: [{ id: 'f1', name: 'Work', syncStatus: 'pending' }],
      tags: [{ id: 't1', name: 'important', syncStatus: 'pending' }],
    }, '2026-08-01T10:00:00.000Z')

    expect(backup).toMatchObject({
      format: WORKSPACE_BACKUP_FORMAT,
      schemaVersion: 6,
      exportedAt: '2026-08-01T10:00:00.000Z',
    })
    expect(backup.notes[0]).not.toHaveProperty('syncStatus')
    expect(backup.notes[0]).not.toHaveProperty('userId')
    expect(backup.folders[0]).not.toHaveProperty('syncStatus')
    expect(backup.manifest).toMatchObject({
      application: 'QuickNotes',
      applicationVersion: '3.0.1',
      counts: expect.objectContaining({ notes: 1, folders: 1, tags: 1 }),
    })
  })

  it('accepts legacy exports and rejects malformed or newer backups', () => {
    expect(parseWorkspaceBackup(JSON.stringify({ notes: [], folders: [{ id: 'f', name: 'Work' }], tags: [] }))).toMatchObject({
      folders: [{ id: 'f', name: 'Work' }],
    })
    expect(() => parseWorkspaceBackup('{bad json')).toThrow('valid JSON')
    expect(() => parseWorkspaceBackup({ notes: 'wrong' })).toThrow('notes list')
    expect(() => parseWorkspaceBackup({ schemaVersion: 7, notes: [] })).toThrow('newer')

    const current = createWorkspaceBackup({ notes: [{ id: 'note', title: 'One' }] })
    current.manifest.counts.notes = 2
    expect(() => parseWorkspaceBackup(current)).toThrow('manifest count')
  })

  it('round-trips a binary archive and rejects a corrupted attachment checksum', async () => {
    const bytes = new TextEncoder().encode('%PDF')
    const checksum = 'sha256:315d429b7714cedb6ad04ac31240145257692630457f3c88253c5beceac76027'
    const input = {
      notes: [{ id: 'note', title: 'Archive source', content: '<p>Body</p>' }],
      noteVersions: [{
        noteId: 'note',
        title: 'Earlier title',
        content: '<p>Earlier body</p>',
        noteType: 'standard',
        createdAt: '2026-08-01T09:00:00.000Z',
      }],
      canonicalResources: [{
        id: 'pdf',
        schemaVersion: 1,
        kind: 'pdf',
        mimeType: 'application/pdf',
        fileName: 'source.pdf',
        byteSize: bytes.byteLength,
        checksum,
        source: 'attachment',
        durationMs: null,
        pageCount: 1,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      }],
      noteResources: [{
        id: 'link',
        noteId: 'note',
        resourceId: 'pdf',
        role: 'attachment',
        label: null,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      }],
      resourcePayloads: [{
        resourceId: 'pdf',
        mimeType: 'application/pdf',
        byteSize: bytes.byteLength,
        checksum,
        data: new Blob([bytes], { type: 'application/pdf' }),
      }],
    }
    const archive = await createWorkspaceArchive(input, '2026-08-02T10:00:00.000Z')
    const parsed = await parseWorkspaceArchive(archive)
    const imported = await prepareWorkspaceImport(parsed, { notes: [], folders: [], tags: [] }, {
      createId: makeIds(),
      now: '2026-08-03T10:00:00.000Z',
    })
    expect(imported.notes).toHaveLength(1)
    expect(imported.noteVersions).toEqual([
      expect.objectContaining({ noteId: imported.notes[0].id, title: 'Earlier title' }),
    ])
    expect(imported.resourceBlobs[0].data).toBeInstanceOf(Blob)
    expect(await imported.resourceBlobs[0].data.text()).toBe('%PDF')

    const corruptedBytes = new Uint8Array(await archive.arrayBuffer())
    corruptedBytes[corruptedBytes.length - 1] ^= 0xff
    await expect(parseWorkspaceArchive(new Blob([corruptedBytes]))).rejects.toThrow('checksum')
  })

  it('merges safely, remaps hierarchy and internal links, and preserves structured data', async () => {
    const result = await prepareWorkspaceImport({
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

  it('never uses the plain-paragraph import fast path for executable or attributed HTML', async () => {
    const result = await prepareWorkspaceImport({
      notes: [{
        id: 'unsafe-note',
        title: 'Sanitize me',
        content: '<p onclick="alert(1)">Body<script>alert(2)</script></p>',
      }],
      folders: [],
      tags: [],
    }, { notes: [], folders: [], tags: [] }, { createId: makeIds() })

    expect(result.notes[0].content).toContain('<p>Body</p>')
    expect(result.notes[0].content).not.toMatch(/onclick|script/iu)
  })

  it('breaks cyclic folder parents and strips prototype-pollution keys', async () => {
    const structured = JSON.parse('{"safe":true,"__proto__":{"polluted":true}}')
    const result = await prepareWorkspaceImport({
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

  it('remaps a complete spatial graph and rejects missing resources atomically', async () => {
    const source = {
      schemaVersion: 3,
      notes: [
        { id: 'paper', title: 'Imported paper', noteType: 'paper', contentKind: 'paper', contentSchemaVersion: 1 },
        { id: 'target', title: 'Linked target', noteType: 'standard' },
      ],
      folders: [],
      tags: [],
      spatialDocuments: [{ noteId: 'paper', kind: 'paper', schemaVersion: 1, revision: 4, settings: {}, viewport: { panX: 0, panY: 0, zoom: 0.8 } }],
      spatialPages: [{ id: 'page', noteId: 'paper', schemaVersion: 1, order: 0, name: 'Page 1', size: 'a4', width: 794, height: 1123, pattern: 'dot', surface: 'warm' }],
      spatialObjects: [
        { id: 'link', noteId: 'paper', pageId: 'page', schemaVersion: 1, kind: 'noteLink', zIndex: 1, bounds: { x: 20, y: 20, width: 240, height: 72 }, data: { targetNoteId: 'target', text: '', resourceId: null } },
        { id: 'image', noteId: 'paper', pageId: 'page', schemaVersion: 1, kind: 'image', zIndex: 2, bounds: { x: 20, y: 120, width: 100, height: 100 }, data: { resourceId: 'resource', text: '', targetNoteId: null } },
      ],
      resources: [{ id: 'resource', kind: 'image', mimeType: 'image/png', name: 'pixel.png', byteSize: 4, data: 'data:image/png;base64,iVBORw==' }],
      spatialAnnotations: [{
        id: 'annotation', noteId: 'paper', resourceId: 'resource', kind: 'paper', scope: 'annotation',
        schemaVersion: 1, revision: 2, settings: { sourceKind: 'attachment' },
        viewport: { panX: 0, panY: 0, zoom: 0.8 },
      }],
      spatialAnnotationPages: [{
        id: 'annotation-page', annotationId: 'annotation', noteId: 'paper', resourceId: 'resource',
        pageNumber: 1, schemaVersion: 1, order: 0, name: 'Source page 1', size: 'free',
        width: 640, height: 480, pattern: 'blank', surface: 'white',
      }],
      spatialAnnotationObjects: [{
        id: 'annotation-shape', annotationId: 'annotation', noteId: 'paper', resourceId: 'resource',
        pageId: 'annotation-page', schemaVersion: 1, kind: 'shape', zIndex: 1,
        bounds: { x: 20, y: 20, width: 120, height: 40 },
        data: { shape: 'rectangle', geometry: { x: 20, y: 20, width: 120, height: 40 }, color: '#b42318', width: 3, fill: 'transparent' },
      }],
    }
    const result = await prepareWorkspaceImport(source, { notes: [], folders: [], tags: [] }, { createId: makeIds() })
    const paper = result.notes.find((note) => note.noteType === 'paper')
    const target = result.notes.find((note) => note.noteType === 'standard')
    expect(result.spatialDocuments[0]).toMatchObject({ noteId: paper.id, kind: 'paper', revision: 0 })
    expect(result.spatialObjects.find((object) => object.kind === 'noteLink').data.targetNoteId).toBe(target.id)
    expect(result.spatialObjects.find((object) => object.kind === 'image').data.resourceId).toBe(result.resources[0].id)
    expect(result.spatialObjects.every((object) => object.pageId === result.spatialPages[0].id)).toBe(true)
    expect(result.spatialAnnotations[0]).toMatchObject({
      noteId: paper.id,
      resourceId: result.resources[0].id,
      revision: 0,
      scope: 'annotation',
    })
    expect(result.spatialAnnotationPages[0]).toMatchObject({
      annotationId: result.spatialAnnotations[0].id,
      resourceId: result.resources[0].id,
    })
    expect(result.spatialAnnotationObjects[0]).toMatchObject({
      annotationId: result.spatialAnnotations[0].id,
      pageId: result.spatialAnnotationPages[0].id,
      noteId: paper.id,
    })

    await expect(prepareWorkspaceImport(
      { ...source, resources: [] },
      { notes: [], folders: [], tags: [] },
      { createId: makeIds() }
    )).rejects.toThrow('missing')
  })

  it('round-trips a Brainstorm canvas together with its structured idea register', async () => {
    const source = createWorkspaceBackup({
      notes: [{
        id: 'brainstorm',
        title: 'Launch ideas',
        noteType: 'brainstorm',
        contentKind: 'canvas',
        contentSchemaVersion: 1,
        noteData: {
          topic: 'Launch',
          viewMode: 'register',
          ideas: [{ id: 'idea-1', text: 'Interview customers', category: 'research', votes: 2 }],
          categories: [{ id: 'research', name: 'Research' }],
        },
      }],
      folders: [],
      tags: [],
      spatialDocuments: [{
        noteId: 'brainstorm',
        kind: 'canvas',
        schemaVersion: 1,
        revision: 3,
        settings: {},
        viewport: { panX: 12, panY: 18, zoom: 0.9 },
      }],
      spatialPages: [],
      spatialObjects: [{
        id: 'sticky-1',
        noteId: 'brainstorm',
        pageId: null,
        schemaVersion: 1,
        kind: 'sticky',
        zIndex: 1,
        bounds: { x: 40, y: 60, width: 220, height: 160 },
        data: { text: 'Interview customers' },
      }],
    })

    const result = await prepareWorkspaceImport(
      source,
      { notes: [], folders: [], tags: [] },
      { createId: makeIds(), now: '2026-08-30T12:00:00.000Z' }
    )

    const brainstorm = result.notes[0]
    expect(brainstorm).toMatchObject({
      noteType: 'brainstorm',
      contentKind: 'canvas',
      noteData: expect.objectContaining({
        topic: 'Launch',
        ideas: [expect.objectContaining({ text: 'Interview customers', votes: 2 })],
      }),
    })
    expect(result.spatialDocuments).toEqual([
      expect.objectContaining({ noteId: brainstorm.id, kind: 'canvas', revision: 0 }),
    ])
    expect(result.spatialObjects).toEqual([
      expect.objectContaining({
        noteId: brainstorm.id,
        pageId: null,
        kind: 'sticky',
        data: expect.objectContaining({ text: 'Interview customers' }),
      }),
    ])
  })

  it('remaps durable attachment payloads and corrected recognition together', async () => {
    const checksum = 'sha256:315d429b7714cedb6ad04ac31240145257692630457f3c88253c5beceac76027'
    const result = await prepareWorkspaceImport({
      schemaVersion: 4,
      notes: [
        {
          id: 'n1',
          title: 'Imported source',
          reminders: [{
            id: 'reminder-1',
            datetime: '2099-01-01T10:00:00.000Z',
            source: {
              type: 'anchor',
              noteId: 'n1',
              recognitionId: 'recognition-1',
              resourceId: 'pdf-1',
              label: 'Approved total',
            },
          }],
        },
        {
          id: 'tasks-1',
          title: 'Captured tasks',
          noteType: 'todo',
          noteData: {
            tasks: [{
              id: 'task-1',
              text: 'Approve total',
              source: {
                schemaVersion: 1,
                kind: 'recognizedContent',
                noteId: 'n1',
                recognitionId: 'recognition-1',
                recognitionType: 'pdfText',
                sourceKind: 'pdf',
                resourceId: 'pdf-1',
                objectId: null,
                pageId: null,
                pageNumber: 1,
                timeMs: null,
                region: null,
              },
            }],
          },
        },
        {
          id: 'meeting-1',
          title: 'Imported meeting',
          noteType: 'meeting',
          noteData: {
            actionItems: [{
              id: 'action-1',
              task: 'Approve total',
              source: {
                schemaVersion: 1,
                kind: 'recognizedContent',
                noteId: 'n1',
                recognitionId: 'recognition-1',
                recognitionType: 'pdfText',
                sourceKind: 'pdf',
                resourceId: 'pdf-1',
                objectId: null,
                pageId: null,
                pageNumber: 1,
                timeMs: null,
                region: null,
              },
            }],
            decisions: [],
          },
        },
      ],
      folders: [],
      tags: [],
      canonicalResources: [{
        id: 'pdf-1',
        schemaVersion: 1,
        kind: 'pdf',
        mimeType: 'application/pdf',
        fileName: 'brief.pdf',
        byteSize: 4,
        checksum,
        source: 'attachment',
        durationMs: null,
        pageCount: 1,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      }],
      noteResources: [{
        id: 'link-1',
        noteId: 'n1',
        resourceId: 'pdf-1',
        role: 'attachment',
        label: null,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      }],
      resourcePayloads: [{
        resourceId: 'pdf-1',
        mimeType: 'application/pdf',
        byteSize: 4,
        data: 'data:application/pdf;base64,JVBERg==',
      }],
      recognizedContent: [{
        id: 'recognition-1',
        schemaVersion: 1,
        noteId: 'n1',
        sourceKind: 'pdf',
        sourceResourceId: 'pdf-1',
        sourceObjectIds: [],
        sourcePageId: null,
        sourcePageNumber: 1,
        sourceRegion: null,
        sourceTimeRange: null,
        type: 'pdfText',
        machineText: 'Draft total 42',
        text: 'Approved total 42',
        confidence: 1,
        providerId: 'pdfjs-local-text',
        modelId: 'pdfjs',
        modelVersion: 'test',
        processingLocation: 'local',
        language: 'en',
        sourceFingerprint: checksum,
        status: 'current',
        userEdited: true,
        editedAt: '2026-08-01T11:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
        generatedAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T11:00:00.000Z',
      }],
    }, { notes: [], folders: [], tags: [] }, {
      createId: makeIds(),
      now: '2026-08-02T10:00:00.000Z',
    })

    expect(result.canonicalResources).toHaveLength(1)
    expect(result.resourceBlobs[0].data).toBeInstanceOf(Blob)
    const sourceNote = result.notes.find((note) => note.title === 'Imported source')
    const taskNote = result.notes.find((note) => note.title === 'Captured tasks')
    const meetingNote = result.notes.find((note) => note.title === 'Imported meeting')
    expect(result.noteResources[0]).toMatchObject({
      noteId: sourceNote.id,
      resourceId: result.canonicalResources[0].id,
    })
    expect(result.recognizedContent[0]).toMatchObject({
      noteId: sourceNote.id,
      sourceResourceId: result.canonicalResources[0].id,
      text: 'Approved total 42',
      userEdited: true,
    })
    expect(taskNote.noteData.tasks[0].source).toMatchObject({
      noteId: sourceNote.id,
      recognitionId: result.recognizedContent[0].id,
      resourceId: result.canonicalResources[0].id,
      pageNumber: 1,
    })
    expect(sourceNote.reminders[0].source).toMatchObject({
      type: 'anchor',
      noteId: sourceNote.id,
      recognitionId: result.recognizedContent[0].id,
      resourceId: result.canonicalResources[0].id,
    })
    expect(meetingNote.noteData.actionItems[0].source).toMatchObject({
      noteId: sourceNote.id,
      recognitionId: result.recognizedContent[0].id,
      resourceId: result.canonicalResources[0].id,
    })
  })

  it('validates and remaps a maximum-size 10,000-note library without partial state', async () => {
    const notes = Array.from({ length: 10_000 }, (_, index) => ({
      id: `source-${index}`,
      title: `Historical note ${index}`,
      content: `<p>Bounded restore record ${index}</p>`,
      noteType: index % 8 === 0 ? 'journal' : 'standard',
      noteData: index % 8 === 0 ? { freeWrite: `Entry ${index}` } : null,
      tags: index % 5 === 0 ? ['archive'] : [],
      createdAt: new Date(1_700_000_000_000 + index).toISOString(),
    }))
    let id = 0
    const result = await prepareWorkspaceImport({ notes, folders: [], tags: [] }, {
      notes: [], folders: [], tags: [], savedViews: [], noteTemplates: [],
    }, {
      createId: () => `restored-${++id}`,
      now: '2026-08-28T12:00:00.000Z',
    })

    expect(result.notes).toHaveLength(10_000)
    expect(new Set(result.notes.map((note) => note.id)).size).toBe(10_000)
    expect(result.notes[0]).toMatchObject({ title: 'Historical note 0', syncStatus: 'pending' })
    expect(result.notes.at(-1)).toMatchObject({ title: 'Historical note 9999', syncStatus: 'pending' })
  }, 30_000)
})
