import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalUser,
  getLocalWorkspaceName,
  LOCAL_SESSION_KEY,
  setLocalWorkspaceName,
  subscribeToLocalSession,
} from './localSession'

describe('local workspace identity', () => {
  beforeEach(() => localStorage.clear())

  it('uses one workspace name and never creates display-name metadata', () => {
    setLocalWorkspaceName('Private notes')

    expect(getLocalWorkspaceName()).toBe('Private notes')
    expect(createLocalUser()).toMatchObject({
      username: 'Private notes',
      user_metadata: {},
    })
  })

  it('reports local-session changes made by another tab', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToLocalSession(listener)

    window.dispatchEvent(new StorageEvent('storage', {
      key: LOCAL_SESSION_KEY,
      oldValue: 'active',
      newValue: null,
    }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: LOCAL_SESSION_KEY,
      oldValue: null,
      newValue: 'active',
    }))

    expect(listener).toHaveBeenNthCalledWith(1, false)
    expect(listener).toHaveBeenNthCalledWith(2, true)

    unsubscribe()
    window.dispatchEvent(new StorageEvent('storage', {
      key: LOCAL_SESSION_KEY,
      newValue: null,
    }))
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
