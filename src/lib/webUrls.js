const MAX_WEB_URL_LENGTH = 2048

export function normalizeWebUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''

  if (!trimmed) {
    return { value: '', error: 'Enter a web address.' }
  }

  const hasControlCharacter = Array.from(trimmed).some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint <= 31 || codePoint === 127
  })

  if (trimmed.length > MAX_WEB_URL_LENGTH || hasControlCharacter) {
    return { value: '', error: 'Enter a valid web address.' }
  }

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      return { value: '', error: 'Only HTTP and HTTPS addresses are supported.' }
    }
    if (parsed.username || parsed.password) {
      return { value: '', error: 'Addresses containing a username or password are not supported.' }
    }
    return { value: parsed.href, error: '' }
  } catch {
    return { value: '', error: 'Enter a valid web address.' }
  }
}

export function createShareUrl(shareToken, location = window.location) {
  if (!shareToken) return ''
  const url = new URL(location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('share', shareToken)
  return url.href
}
