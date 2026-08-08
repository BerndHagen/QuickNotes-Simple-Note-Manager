import { describe, expect, it } from 'vitest'
import { normalizeUsername, validateUsername } from './usernames'

describe('usernames', () => {
  it('preserves the casing of the one public identity', () => {
    expect(normalizeUsername('  VampyrusNoctis  ')).toBe('VampyrusNoctis')
    expect(validateUsername('VampyrusNoctis')).toBe('')
  })

  it('rejects missing, spaced, or malformed usernames', () => {
    expect(validateUsername('')).toBe('Username is required')
    expect(validateUsername('Vampyrus Noctis')).toMatch(/letters, numbers/i)
    expect(validateUsername('-invalid')).toMatch(/letters, numbers/i)
  })
})
