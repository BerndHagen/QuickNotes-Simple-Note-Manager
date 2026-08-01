import { describe, expect, it } from 'vitest'
import { createShareUrl, normalizeWebUrl } from './webUrls'

describe('normalizeWebUrl', () => {
  it('adds HTTPS to ordinary host names and preserves valid HTTP addresses', () => {
    expect(normalizeWebUrl('example.com/docs').value).toBe('https://example.com/docs')
    expect(normalizeWebUrl('http://localhost:3000/image.png').value).toBe(
      'http://localhost:3000/image.png'
    )
  })

  it('rejects executable, credential-bearing, malformed, and oversized addresses', () => {
    expect(normalizeWebUrl('javascript:alert(1)').error).toMatch(/HTTP and HTTPS/i)
    expect(normalizeWebUrl('https://person:secret@example.com').error).toMatch(/username/i)
    expect(normalizeWebUrl('https://').error).toMatch(/valid web address/i)
    expect(normalizeWebUrl(`https://example.com/${'a'.repeat(2100)}`).error).toMatch(/valid/i)
  })
})

describe('createShareUrl', () => {
  it('keeps the deployed subdirectory while replacing stale query and hash state', () => {
    const location = {
      href: 'https://notes.example/app/index.html?folder=work#section',
    }
    expect(createShareUrl('abc/123', location)).toBe(
      'https://notes.example/app/index.html?share=abc%2F123'
    )
  })
})
