import { describe, expect, it } from 'vitest'
import {
  MAX_NOTE_TITLE_LENGTH,
  limitNoteTitle,
  normalizeTagName,
  validateFolderName,
} from './dataValidation'

describe('workspace data validation', () => {
  it('caps note titles at the database limit', () => {
    expect(limitNoteTitle('x'.repeat(700))).toHaveLength(MAX_NOTE_TITLE_LENGTH)
  })

  it('enforces case-insensitive folder uniqueness', () => {
    expect(() =>
      validateFolderName(' work ', [{ id: '1', name: 'Work' }])
    ).toThrow('already exists')
    expect(validateFolderName(' Work ', [{ id: '1', name: 'Work' }], '1')).toBe('Work')
  })

  it('normalizes and validates tags', () => {
    expect(normalizeTagName(' Important ')).toBe('important')
    expect(() => normalizeTagName('x'.repeat(61))).toThrow('60 characters')
  })
})
