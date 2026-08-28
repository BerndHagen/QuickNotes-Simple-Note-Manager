const toHex = (buffer) => [...new Uint8Array(buffer)]
  .map((value) => value.toString(16).padStart(2, '0'))
  .join('')

export async function checksumBlob(blob) {
  if (!(blob instanceof Blob)) throw new Error('A binary resource is required.')
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return `sha256:${toHex(digest)}`
  }
  let hash = 2166136261
  for (const byte of new Uint8Array(await blob.arrayBuffer())) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}
