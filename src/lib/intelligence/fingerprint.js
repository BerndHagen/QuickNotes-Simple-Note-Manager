const encoder = new TextEncoder()

const toHex = (buffer) => [...new Uint8Array(buffer)]
  .map((value) => value.toString(16).padStart(2, '0'))
  .join('')

export async function fingerprintText(value) {
  if (!globalThis.crypto?.subtle) {
    // The fallback is a source revision marker, not a cryptographic checksum.
    // It is namespaced so it can never be confused with SHA-256 output.
    let hash = 2166136261
    for (const byte of encoder.encode(String(value ?? ''))) {
      hash ^= byte
      hash = Math.imul(hash, 16777619)
    }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
  }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value ?? '')))
  return `sha256:${toHex(digest)}`
}

export const fingerprintResource = async (resource) => {
  if (typeof resource?.checksum === 'string' && resource.checksum) return resource.checksum
  return fingerprintText([
    resource?.mimeType || '',
    resource?.byteSize || 0,
    resource?.data || '',
  ].join('\u0000'))
}

export const fingerprintInkObjects = (objects = []) => fingerprintText(
  [...objects]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((object) => JSON.stringify({
      id: object.id,
      updatedAt: object.updatedAt,
      bounds: object.bounds,
      data: object.data,
    }))
    .join('\u001e')
)
