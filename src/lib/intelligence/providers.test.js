import { describe, expect, it, vi } from 'vitest'
import { createIntelligenceProviderRegistry, IntelligenceProviderError } from './providers'

describe('intelligence provider registry', () => {
  it('prefers a permitted local provider and does not silently fall back to external', async () => {
    const registry = createIntelligenceProviderRegistry()
    const local = vi.fn(async () => ({ text: 'local' }))
    const external = vi.fn(async () => ({ text: 'external' }))
    registry.register({
      id: 'external-ocr',
      capability: 'ocr',
      processingLocation: 'external',
      recognizeImage: external,
    })
    registry.register({
      id: 'local-ocr',
      capability: 'ocr',
      processingLocation: 'local',
      recognizeImage: local,
    })

    await expect(registry.invoke('ocr', new Uint8Array(), {
      settings: { mode: 'localOnly' },
    })).resolves.toEqual({ text: 'local' })
    expect(local).toHaveBeenCalledOnce()
    expect(external).not.toHaveBeenCalled()

    await expect(registry.invoke('ocr', new Uint8Array(), {
      providerId: 'external-ocr',
      settings: { mode: 'localOnly' },
    })).rejects.toMatchObject({ code: 'unavailable' })
    expect(external).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation for an external provider by default', () => {
    const registry = createIntelligenceProviderRegistry()
    registry.register({
      id: 'cloud-handwriting',
      capability: 'handwriting',
      processingLocation: 'external',
      recognizeInk: vi.fn(),
    })

    expect(() => registry.resolve('handwriting', {
      settings: { mode: 'externalAllowed', confirmExternalEveryTime: true },
      online: true,
    })).toThrow(IntelligenceProviderError)
    expect(() => registry.resolve('handwriting', {
      settings: { mode: 'externalAllowed', confirmExternalEveryTime: true },
      externalConfirmed: true,
      online: true,
    })).not.toThrow()
  })
})
