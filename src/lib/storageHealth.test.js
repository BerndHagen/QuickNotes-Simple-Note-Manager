import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatStorageBytes,
  getBrowserStorageHealth,
  requestBrowserStoragePersistence,
} from './storageHealth'

const originalStorage = navigator.storage

afterEach(() => {
  Object.defineProperty(navigator, 'storage', { configurable: true, value: originalStorage })
})

describe('browser storage health', () => {
  it('reports origin usage, quota, and persistence without requesting permission', async () => {
    const persist = vi.fn(async () => true)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn(async () => ({ usage: 75, quota: 100 })),
        persisted: vi.fn(async () => false),
        persist,
      },
    })
    await expect(getBrowserStorageHealth()).resolves.toEqual({
      supported: true,
      canRequestPersistence: true,
      persisted: false,
      usage: 75,
      quota: 100,
      ratio: 0.75,
    })
    expect(persist).not.toHaveBeenCalled()
    await expect(requestBrowserStoragePersistence()).resolves.toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('formats bounded storage values and degrades when the API is absent', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined })
    await expect(getBrowserStorageHealth()).resolves.toMatchObject({ supported: false })
    expect(formatStorageBytes(1536)).toBe('1.50 KB')
    expect(formatStorageBytes(null)).toBe('Unavailable')
  })
})
