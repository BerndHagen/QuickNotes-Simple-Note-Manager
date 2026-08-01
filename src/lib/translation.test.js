import { describe, expect, it, vi } from 'vitest'
import {
  MAX_TRANSLATION_BYTES,
  TranslationError,
  getUtf8ByteLength,
  splitTextForTranslation,
  translateText,
} from './translation'

describe('translation service', () => {
  it('segments long Unicode text without losing content or exceeding the provider limit', () => {
    const input = `${'A useful sentence with spaces. '.repeat(24)}${'\u4f60\u597d\u4e16\u754c'.repeat(80)}`
    const segments = splitTextForTranslation(input)

    expect(segments.length).toBeGreaterThan(1)
    expect(segments.join('')).toBe(input)
    expect(segments.every((segment) => getUtf8ByteLength(segment) <= 480)).toBe(true)
  })

  it('translates every segment and decodes response entities', async () => {
    const fetchImpl = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: `Result &amp; ${new URL(url).searchParams.get('q')}` },
      }),
    }))
    const input = 'One sentence. '.repeat(50)

    const result = await translateText(input, {
      source: 'en',
      target: 'de',
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(splitTextForTranslation(input).length)
    expect(result).toContain('Result & One sentence.')
  })

  it('accepts a valid translation that matches the source text', async () => {
    const result = await translateText('QuickNotes', {
      source: 'en',
      target: 'de',
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'QuickNotes' },
        }),
      })),
    })

    expect(result).toBe('QuickNotes')
  })

  it('rejects oversized input before making a network request', async () => {
    const fetchImpl = vi.fn()

    await expect(
      translateText('x'.repeat(MAX_TRANSLATION_BYTES + 1), {
        source: 'en',
        target: 'de',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(TranslationError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('turns provider failures into actionable errors', async () => {
    await expect(
      translateText('Hello', {
        source: 'en',
        target: 'de',
        fetchImpl: vi.fn(async () => ({ ok: false, status: 429 })),
      })
    ).rejects.toThrow(/busy/i)
  })
})
