const SEGMENT_BYTE_LIMIT = 480
export const MAX_TRANSLATION_BYTES = 5000

const encoder = new TextEncoder()

export const getUtf8ByteLength = (value) => encoder.encode(String(value || '')).length

function findSegmentBoundary(value, byteLimit) {
  let bytes = 0
  let index = 0
  let preferredBoundary = 0

  for (const character of value) {
    const characterBytes = getUtf8ByteLength(character)
    if (bytes + characterBytes > byteLimit) break

    bytes += characterBytes
    index += character.length
    if (/\s|[.!?;:,\u3002\uff01\uff1f]/u.test(character)) preferredBoundary = index
  }

  return preferredBoundary || index
}

export function splitTextForTranslation(value, byteLimit = SEGMENT_BYTE_LIMIT) {
  const segments = []
  let remaining = String(value || '')

  while (remaining && getUtf8ByteLength(remaining) > byteLimit) {
    const boundary = findSegmentBoundary(remaining, byteLimit)
    if (!boundary) throw new Error('Unable to segment text for translation')
    segments.push(remaining.slice(0, boundary))
    remaining = remaining.slice(boundary)
  }

  if (remaining) segments.push(remaining)
  return segments
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|#39));/gi, (match, decimal, hex, name) => {
    if (decimal) return String.fromCodePoint(Number(decimal))
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16))
    return named[name.toLowerCase()] || match
  })
}

export class TranslationError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    this.name = 'TranslationError'
  }
}

async function translateSegment(segment, source, target, { signal, fetchImpl }) {
  const leadingWhitespace = segment.match(/^\s*/u)?.[0] || ''
  const trailingWhitespace = segment.match(/\s*$/u)?.[0] || ''
  const text = segment.slice(leadingWhitespace.length, segment.length - trailingWhitespace.length)
  if (!text) return segment

  const url = new URL('https://api.mymemory.translated.net/get')
  url.searchParams.set('q', text)
  url.searchParams.set('langpair', `${source}|${target}`)
  url.searchParams.set('mt', '1')

  let response
  try {
    response = await fetchImpl(url, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new TranslationError('The translation service could not be reached. Check your connection and try again.', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new TranslationError(
      response.status === 429
        ? 'MyMemory\'s request or daily limit has been reached. Wait and try again later.'
        : 'The translation service is temporarily unavailable. Try again later.'
    )
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    throw new TranslationError('The translation service returned an unreadable response.', {
      cause: error,
    })
  }

  const translated = payload?.responseData?.translatedText
  const responseStatus = Number(payload?.responseStatus)
  const responseDetails = typeof payload?.responseDetails === 'string'
    ? payload.responseDetails.trim()
    : ''
  if (
    [403, 429].includes(responseStatus)
    || /(?:quota|limit|available free translations)/iu.test(responseDetails)
  ) {
    throw new TranslationError(
      'MyMemory\'s anonymous daily allowance has been reached. Try again later.'
    )
  }
  if (responseStatus !== 200 || typeof translated !== 'string' || !translated.trim()) {
    throw new TranslationError(
      responseDetails
        ? responseDetails
        : 'The text could not be translated with this language pair.'
    )
  }

  return `${leadingWhitespace}${decodeEntities(translated)}${trailingWhitespace}`
}

export async function translateText(
  value,
  { source, target, signal, fetchImpl = globalThis.fetch } = {}
) {
  const text = String(value || '')
  if (!text.trim()) throw new TranslationError('Enter text to translate.')
  if (!source || !target) throw new TranslationError('Choose both a source and target language.')
  if (source === target) throw new TranslationError('Choose two different languages.')
  if (getUtf8ByteLength(text) > MAX_TRANSLATION_BYTES) {
    throw new TranslationError('Select a shorter passage of up to 5,000 bytes and try again.')
  }
  if (typeof fetchImpl !== 'function') {
    throw new TranslationError('Translation is not supported in this browser.')
  }

  const translatedSegments = []
  for (const segment of splitTextForTranslation(text)) {
    translatedSegments.push(
      await translateSegment(segment, source, target, { signal, fetchImpl })
    )
  }

  return translatedSegments.join('')
}
