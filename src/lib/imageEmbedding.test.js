import { describe, expect, it } from 'vitest'
import {
  MAX_EMBEDDED_IMAGE_BYTES,
  SAFE_LOCAL_STORAGE_BUDGET_BYTES,
  estimateDataUrlStorageBytes,
  measureStorageBytes,
  validateEmbeddedImage,
} from './imageEmbedding'

const storageWith = (entries = {}) => {
  const values = new Map(Object.entries(entries))
  return {
    get length() {
      return values.size
    },
    key: (index) => Array.from(values.keys())[index] ?? null,
    getItem: (key) => values.get(key) ?? null,
  }
}

describe('embedded image limits', () => {
  it('reproduces the unsafe expansion of the former 5 MiB allowance', () => {
    const formerMaximum = { size: 5 * 1024 * 1024, type: 'image/png' }
    expect(estimateDataUrlStorageBytes(formerMaximum)).toBeGreaterThan(
      SAFE_LOCAL_STORAGE_BUDGET_BYTES
    )
    expect(validateEmbeddedImage(formerMaximum, storageWith()).code).toBe('file-too-large')
  })

  it('accepts a supported image only when its projected workspace remains safe', () => {
    const file = { size: 100 * 1024, type: 'image/webp' }
    expect(validateEmbeddedImage(file, storageWith()).ok).toBe(true)

    const nearlyFull = storageWith({
      'quicknotes-storage': 'x'.repeat(SAFE_LOCAL_STORAGE_BUDGET_BYTES / 2 - 1000),
    })
    expect(validateEmbeddedImage(file, nearlyFull)).toMatchObject({
      ok: false,
      code: 'workspace-too-large',
    })
  })

  it('rejects unsupported, empty, and over-budget files before reading them', () => {
    expect(validateEmbeddedImage({ size: 10, type: 'image/svg+xml' }, storageWith()).code).toBe(
      'unsupported-type'
    )
    expect(validateEmbeddedImage({ size: 0, type: 'image/png' }, storageWith()).code).toBe(
      'empty-file'
    )
    expect(
      validateEmbeddedImage(
        { size: MAX_EMBEDDED_IMAGE_BYTES + 1, type: 'image/jpeg' },
        storageWith()
      ).code
    ).toBe('file-too-large')
  })

  it('measures Web Storage strings conservatively as UTF-16 data', () => {
    expect(measureStorageBytes(storageWith({ ab: '123' }))).toBe(10)
  })
})
