import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import {
  QUICKNOTES_DB_SCHEMA_V3,
  QUICKNOTES_DB_SCHEMA_V4,
  QUICKNOTES_DB_SCHEMA_V5,
  QUICKNOTES_DB_SCHEMA_V6,
  QUICKNOTES_DB_SCHEMA_V7,
  QUICKNOTES_DB_SCHEMA_V8,
  QUICKNOTES_DB_SCHEMA_V9,
  QUICKNOTES_DB_SCHEMA_V10,
} from '../db'

const databases = []

const LEGACY_SCHEMA_V1 = {
  notes: 'id, title, content, folderId, userId, createdAt, updatedAt, syncStatus',
  folders: 'id, name, parentId, userId, createdAt, updatedAt, syncStatus',
  tags: 'id, name, color, userId, syncStatus',
  noteTags: '[noteId+tagId], noteId, tagId',
  noteVersions: '++id, noteId, content, createdAt',
  syncQueue: '++id, table, operation, data, timestamp',
}

const LEGACY_SCHEMA_V2 = {
  ...LEGACY_SCHEMA_V1,
  noteVersions: '++id, ownerId, [ownerId+noteId], noteId, content, createdAt',
  syncQueue: '++id, ownerId, [ownerId+table], table, operation, data, timestamp',
  workspaceSnapshots: '&ownerId, updatedAt',
}

const registerCurrentSchema = (database) => {
  database.version(1).stores(LEGACY_SCHEMA_V1)
  database.version(2).stores(LEGACY_SCHEMA_V2)
  database.version(3).stores(QUICKNOTES_DB_SCHEMA_V3)
  database.version(4).stores(QUICKNOTES_DB_SCHEMA_V4)
  database.version(5).stores(QUICKNOTES_DB_SCHEMA_V5)
  database.version(6).stores(QUICKNOTES_DB_SCHEMA_V6)
  database.version(7).stores(QUICKNOTES_DB_SCHEMA_V7)
  database.version(8).stores(QUICKNOTES_DB_SCHEMA_V8)
  database.version(9).stores(QUICKNOTES_DB_SCHEMA_V9)
  database.version(10).stores(QUICKNOTES_DB_SCHEMA_V10)
}

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close()
    await Dexie.delete(database.name)
  }
})

describe('knowledge storage migration', () => {
  it('upgrades a populated version 1 library directly to the current schema without rewriting canonical rows', async () => {
    const name = `QuickNotesFullLegacyMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(1).stores(LEGACY_SCHEMA_V1)
    await legacy.open()
    const note = {
      id: 'v1-note',
      title: 'Long-lived note',
      content: '<p>Original v1 bytes</p>',
      folderId: 'v1-folder',
      userId: 'owner-a',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      syncStatus: 'pending',
      unknownLegacyField: { retain: true },
    }
    const folder = { id: 'v1-folder', name: 'Archive', parentId: null, userId: 'owner-a' }
    const tag = { id: 'v1-tag', name: 'history', color: '#123456', userId: 'owner-a' }
    await legacy.transaction('rw', legacy.notes, legacy.folders, legacy.tags, legacy.noteVersions, legacy.syncQueue, async () => {
      await legacy.notes.put(note)
      await legacy.folders.put(folder)
      await legacy.tags.put(tag)
      await legacy.noteVersions.add({ noteId: note.id, title: note.title, content: note.content, createdAt: note.updatedAt })
      await legacy.syncQueue.add({ table: 'notes', operation: 'update', data: note, timestamp: note.updatedAt })
    })
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    registerCurrentSchema(upgraded)
    await upgraded.open()

    expect(upgraded.verno).toBe(10)
    expect(await upgraded.notes.get(note.id)).toEqual(note)
    expect(await upgraded.folders.get(folder.id)).toEqual(folder)
    expect(await upgraded.tags.get(tag.id)).toEqual(tag)
    expect(await upgraded.noteVersions.toArray()).toEqual([
      expect.objectContaining({ noteId: note.id, content: note.content }),
    ])
    expect(await upgraded.syncQueue.toArray()).toEqual([
      expect.objectContaining({ table: 'notes', operation: 'update', data: note }),
    ])
    expect(upgraded.tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      'workspaceSnapshots',
      'spatialDocuments',
      'searchDocuments',
      'recognizedContent',
      'spatialAnnotations',
      'semanticEmbeddings',
      'spatialSyncState',
    ]))
    expect(await upgraded.searchDocuments.count()).toBe(0)
    expect(await upgraded.semanticEmbeddings.count()).toBe(0)
  })

  it('rolls back an interrupted schema upgrade and can retry from the intact legacy database', async () => {
    const name = `QuickNotesInterruptedMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(1).stores(LEGACY_SCHEMA_V1)
    await legacy.open()
    const note = { id: 'atomic-note', title: 'Before upgrade', content: '<p>Keep me</p>' }
    await legacy.notes.put(note)
    legacy.close()

    const failing = new Dexie(name)
    databases.push(failing)
    failing.version(1).stores(LEGACY_SCHEMA_V1)
    failing.version(2).stores(LEGACY_SCHEMA_V2).upgrade(async (transaction) => {
      await transaction.table('notes').update(note.id, { title: 'Half migrated' })
      throw new Error('simulated migration interruption')
    })
    await expect(failing.open()).rejects.toThrow('simulated migration interruption')
    failing.close()

    const retried = new Dexie(name)
    databases.push(retried)
    registerCurrentSchema(retried)
    await retried.open()
    expect(retried.verno).toBe(10)
    expect(await retried.notes.get(note.id)).toEqual(note)
  })

  it('opens a version 3 workspace at version 4 without rewriting canonical rows', async () => {
    const name = `QuickNotesMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(3).stores(QUICKNOTES_DB_SCHEMA_V3)
    await legacy.open()
    const canonicalNote = {
      id: 'legacy-note',
      title: 'Preserved document',
      content: '<p>Canonical content stays byte-for-byte intact.</p>',
      contentKind: 'document',
      userId: 'owner-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    await legacy.notes.put(canonicalNote)
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    upgraded.version(3).stores(QUICKNOTES_DB_SCHEMA_V3)
    upgraded.version(4).stores(QUICKNOTES_DB_SCHEMA_V4)
    await upgraded.open()

    expect(upgraded.verno).toBe(4)
    expect(await upgraded.notes.get(canonicalNote.id)).toEqual(canonicalNote)
    expect(upgraded.tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      'searchDocuments',
      'knowledgeLinks',
      'knowledgeIndexState',
    ]))
    expect(await upgraded.searchDocuments.count()).toBe(0)
    expect(await upgraded.knowledgeLinks.count()).toBe(0)
  })

  it('opens a version 4 workspace at version 5 without rewriting canonical or derived rows', async () => {
    const name = `QuickNotesIntelligenceMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(4).stores(QUICKNOTES_DB_SCHEMA_V4)
    await legacy.open()
    const canonicalNote = {
      id: 'preserved-note',
      title: 'Preserved after intelligence migration',
      content: '<p>Original source</p>',
      userId: 'owner-a',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const searchDocument = {
      ownerId: 'owner-a',
      noteId: canonicalNote.id,
      schemaVersion: 1,
      title: canonicalNote.title,
    }
    await legacy.notes.put(canonicalNote)
    await legacy.searchDocuments.put(searchDocument)
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    upgraded.version(4).stores(QUICKNOTES_DB_SCHEMA_V4)
    upgraded.version(5).stores(QUICKNOTES_DB_SCHEMA_V5)
    await upgraded.open()

    expect(upgraded.verno).toBe(5)
    expect(await upgraded.notes.get(canonicalNote.id)).toEqual(canonicalNote)
    expect(await upgraded.searchDocuments.get(['owner-a', canonicalNote.id])).toEqual(searchDocument)
    expect(upgraded.tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      'recognizedContent',
      'intelligenceJobs',
      'intelligenceSettings',
    ]))
    expect(await upgraded.recognizedContent.count()).toBe(0)
    expect(await upgraded.intelligenceJobs.count()).toBe(0)
  })

  it('opens a version 5 workspace at version 6 without rewriting capture or correction rows', async () => {
    const name = `QuickNotesCaptureSyncMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(5).stores(QUICKNOTES_DB_SCHEMA_V5)
    await legacy.open()
    const recognition = {
      id: 'recognition-a',
      ownerId: 'owner-a',
      noteId: 'note-a',
      text: 'Corrected source text',
      machineText: 'Source text',
      userEdited: true,
      updatedAt: '2026-08-27T10:00:00.000Z',
    }
    await legacy.recognizedContent.put(recognition)
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    upgraded.version(5).stores(QUICKNOTES_DB_SCHEMA_V5)
    upgraded.version(6).stores(QUICKNOTES_DB_SCHEMA_V6)
    await upgraded.open()

    expect(upgraded.verno).toBe(6)
    expect(await upgraded.recognizedContent.get(recognition.id)).toEqual(recognition)
    expect(await upgraded.captureSyncState.count()).toBe(0)
  })

  it('opens a version 6 workspace at version 7 without rewriting capture rows', async () => {
    const name = `QuickNotesAnnotationMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(6).stores(QUICKNOTES_DB_SCHEMA_V6)
    await legacy.open()
    const resource = {
      id: 'resource-a',
      ownerId: 'owner-a',
      kind: 'pdf',
      mimeType: 'application/pdf',
      updatedAt: '2026-08-27T10:00:00.000Z',
    }
    await legacy.resources.put(resource)
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    upgraded.version(6).stores(QUICKNOTES_DB_SCHEMA_V6)
    upgraded.version(7).stores(QUICKNOTES_DB_SCHEMA_V7)
    await upgraded.open()

    expect(upgraded.verno).toBe(7)
    expect(await upgraded.resources.get(resource.id)).toEqual(resource)
    expect(await upgraded.spatialAnnotations.count()).toBe(0)
    expect(await upgraded.spatialAnnotationPages.count()).toBe(0)
    expect(await upgraded.spatialAnnotationObjects.count()).toBe(0)
  })

  it('opens a version 7 workspace at version 8 without rewriting canonical annotations', async () => {
    const name = `QuickNotesAnnotationSyncMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(7).stores(QUICKNOTES_DB_SCHEMA_V7)
    await legacy.open()
    const annotation = {
      id: 'annotation-a', ownerId: 'owner-a', noteId: 'note-a', resourceId: 'resource-a',
      kind: 'paper', scope: 'annotation', schemaVersion: 1, revision: 2,
      updatedAt: '2026-08-28T10:00:00.000Z',
    }
    await legacy.spatialAnnotations.put(annotation)
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    upgraded.version(7).stores(QUICKNOTES_DB_SCHEMA_V7)
    upgraded.version(8).stores(QUICKNOTES_DB_SCHEMA_V8)
    await upgraded.open()

    expect(upgraded.verno).toBe(8)
    expect(await upgraded.spatialAnnotations.get(annotation.id)).toEqual(annotation)
    expect(await upgraded.annotationSyncState.count()).toBe(0)
  })

  it('opens a version 8 workspace at version 9 with an empty rebuildable semantic index', async () => {
    const name = `QuickNotesSemanticMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(8).stores(QUICKNOTES_DB_SCHEMA_V8)
    await legacy.open()
    const note = { id: 'note-a', title: 'Canonical note', content: '<p>Still canonical.</p>', updatedAt: '2026-08-28T10:00:00.000Z' }
    const searchDocument = { ownerId: 'owner-a', noteId: note.id, title: note.title, sourceFingerprint: 'source-a' }
    await legacy.notes.put(note)
    await legacy.searchDocuments.put(searchDocument)
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    upgraded.version(8).stores(QUICKNOTES_DB_SCHEMA_V8)
    upgraded.version(9).stores(QUICKNOTES_DB_SCHEMA_V9)
    await upgraded.open()

    expect(upgraded.verno).toBe(9)
    expect(await upgraded.notes.get(note.id)).toEqual(note)
    expect(await upgraded.searchDocuments.get(['owner-a', note.id])).toEqual(searchDocument)
    expect(await upgraded.semanticEmbeddings.count()).toBe(0)
    expect(await upgraded.semanticIndexState.count()).toBe(0)
  })

  it('opens a version 9 workspace at version 10 without rewriting a canonical spatial graph', async () => {
    const name = `QuickNotesSpatialSyncMigration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    databases.push(legacy)
    legacy.version(9).stores(QUICKNOTES_DB_SCHEMA_V9)
    await legacy.open()
    const document = {
      noteId: 'canvas-a', ownerId: 'owner-a', kind: 'canvas', schemaVersion: 1, revision: 4,
      settings: {}, viewport: { panX: 0, panY: 0, zoom: 1 },
      updatedAt: '2026-08-28T10:00:00.000Z',
    }
    const object = {
      id: 'object-a', ownerId: 'owner-a', noteId: document.noteId, pageId: null,
      schemaVersion: 1, kind: 'sticky', zIndex: 1,
      bounds: { x: 1, y: 2, width: 100, height: 80 }, data: { text: 'Preserve me' },
      updatedAt: document.updatedAt,
    }
    await legacy.spatialDocuments.put(document)
    await legacy.spatialObjects.put(object)
    legacy.close()

    const upgraded = new Dexie(name)
    databases.push(upgraded)
    upgraded.version(9).stores(QUICKNOTES_DB_SCHEMA_V9)
    upgraded.version(10).stores(QUICKNOTES_DB_SCHEMA_V10)
    await upgraded.open()

    expect(upgraded.verno).toBe(10)
    expect(await upgraded.spatialDocuments.get(document.noteId)).toEqual(document)
    expect(await upgraded.spatialObjects.get(object.id)).toEqual(object)
    expect(await upgraded.spatialSyncState.count()).toBe(0)
  })
})
