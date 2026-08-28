import { describe, expect, it } from 'vitest'
import {
  createRawRecoveryExport,
  makeRecoverySafeValue,
  partitionRecoverableNotes,
} from './recovery'

const validNote = {
  id: 'note-1',
  title: 'Healthy note',
  content: '<p>Preserved</p>',
  noteType: 'standard',
  tags: [],
}

describe('canonical note recovery isolation', () => {
  it('keeps valid legacy notes active and isolates malformed or future records', () => {
    const result = partitionRecoverableNotes([
      validNote,
      { ...validNote, id: 'bad-body', content: { html: '<p>wrong type</p>' } },
      { ...validNote, id: 'future', contentSchemaVersion: 99, futureField: 'retain me' },
      { ...validNote, title: 'Duplicate identity' },
    ])

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]).toMatchObject({
      id: 'note-1',
      contentKind: 'document',
      contentSchemaVersion: 1,
    })
    expect(result.corruptedNotes).toHaveLength(3)
    expect(result.corruptedNotes[0]).toMatchObject({ entityId: 'bad-body' })
    expect(result.corruptedNotes[1].raw).toMatchObject({
      id: 'future',
      contentSchemaVersion: 99,
      futureField: 'retain me',
    })
    expect(result.corruptedNotes[2]).toMatchObject({
      entityId: 'note-1',
      reason: 'The note duplicates another canonical note ID.',
    })
  })

  it('produces bounded JSON-compatible recovery data for structured-clone values', () => {
    const cyclic = { id: 'cyclic', count: 3n }
    cyclic.self = cyclic
    const safe = makeRecoverySafeValue(cyclic)
    const recovery = createRawRecoveryExport([{ raw: safe }], { ownerId: 'owner-a' })

    expect(safe).toEqual({ id: 'cyclic', count: { $bigint: '3' }, self: { $ref: '$' } })
    expect(() => JSON.stringify(recovery)).not.toThrow()
    expect(recovery).toMatchObject({
      format: 'quicknotes-raw-recovery',
      version: 1,
      ownerScope: 'active-workspace',
    })
  })
})
