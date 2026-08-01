export const MAX_EMBEDDED_IMAGE_BYTES = 512 * 1024
export const SAFE_LOCAL_STORAGE_BUDGET_BYTES = 4 * 1024 * 1024
export const SUPPORTED_EMBEDDED_IMAGE_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const MARKUP_RESERVE_BYTES = 4096

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function estimateStoredStringBytes(value) {
  return String(value ?? '').length * 2
}

export function measureStorageBytes(storage) {
  let total = 0
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key === null) continue
    total += estimateStoredStringBytes(key)
    total += estimateStoredStringBytes(storage.getItem(key))
  }
  return total
}

export function estimateDataUrlStorageBytes(file) {
  const header = `data:${file.type};base64,`
  const encodedCharacters = header.length + 4 * Math.ceil(file.size / 3)
  return encodedCharacters * 2
}

export function validateEmbeddedImage(file, storage = window.localStorage) {
  if (!file || !SUPPORTED_EMBEDDED_IMAGE_TYPES.includes(file.type)) {
    return {
      ok: false,
      code: 'unsupported-type',
      error: 'Choose a JPG, PNG, GIF, or WebP image.',
    }
  }

  if (file.size <= 0) {
    return { ok: false, code: 'empty-file', error: 'The selected image is empty.' }
  }

  if (file.size > MAX_EMBEDDED_IMAGE_BYTES) {
    return {
      ok: false,
      code: 'file-too-large',
      error: `Embedded images must be ${formatFileSize(MAX_EMBEDDED_IMAGE_BYTES)} or smaller.`,
    }
  }

  try {
    const currentBytes = measureStorageBytes(storage)
    const projectedBytes =
      currentBytes + estimateDataUrlStorageBytes(file) + MARKUP_RESERVE_BYTES

    if (projectedBytes > SAFE_LOCAL_STORAGE_BUDGET_BYTES) {
      return {
        ok: false,
        code: 'workspace-too-large',
        currentBytes,
        projectedBytes,
        error:
          `This image would increase browser storage to about ${formatFileSize(projectedBytes)}, ` +
          `above QuickNotes' safe ${formatFileSize(SAFE_LOCAL_STORAGE_BUDGET_BYTES)} limit. ` +
          'Export or remove large notes, or use an image URL instead.',
      }
    }

    return { ok: true, currentBytes, projectedBytes }
  } catch {
    return {
      ok: false,
      code: 'storage-unavailable',
      error: 'QuickNotes could not verify available browser storage. Use an image URL instead.',
    }
  }
}
