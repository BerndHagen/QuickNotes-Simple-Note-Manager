import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalUser, getLocalWorkspaceName, setLocalWorkspaceName } from './localSession'

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
})
