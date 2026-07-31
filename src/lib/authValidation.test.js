import { describe, expect, it } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  getAuthErrorMessage,
  validateNewPassword,
} from './authValidation'

describe('validateNewPassword', () => {
  it('requires a password', () => {
    expect(validateNewPassword('')).toBe('Password is required')
  })

  it('requires the documented minimum length', () => {
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toContain(
      String(MIN_PASSWORD_LENGTH)
    )
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBe('')
  })

  it('rejects unreasonably long values', () => {
    expect(validateNewPassword('a'.repeat(129))).toBe('Use no more than 128 characters')
  })
})

describe('getAuthErrorMessage', () => {
  it('maps stable Supabase error codes to useful messages', () => {
    expect(getAuthErrorMessage({ code: 'over_email_send_rate_limit' })).toMatch(/rate-limited/i)
    expect(getAuthErrorMessage({ code: 'email_not_confirmed' })).toMatch(/confirm your email/i)
  })

  it('falls back to a supplied error message', () => {
    expect(getAuthErrorMessage({ message: 'Custom failure' })).toBe('Custom failure')
  })
})
