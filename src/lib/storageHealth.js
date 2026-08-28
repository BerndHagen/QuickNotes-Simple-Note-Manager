export const formatStorageBytes = (value) => {
  if (!Number.isFinite(value) || value < 0) return 'Unavailable'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  const digits = amount >= 100 || unit === 0 ? 0 : amount >= 10 ? 1 : 2
  return `${amount.toFixed(digits)} ${units[unit]}`
}

export async function getBrowserStorageHealth() {
  const storage = globalThis.navigator?.storage
  if (!storage) {
    return { supported: false, persisted: null, usage: null, quota: null, ratio: null }
  }
  const [estimate, persisted] = await Promise.all([
    typeof storage.estimate === 'function' ? storage.estimate() : Promise.resolve({}),
    typeof storage.persisted === 'function' ? storage.persisted() : Promise.resolve(null),
  ])
  const usage = Number.isFinite(estimate?.usage) ? estimate.usage : null
  const quota = Number.isFinite(estimate?.quota) ? estimate.quota : null
  return {
    supported: true,
    canRequestPersistence: typeof storage.persist === 'function',
    persisted: typeof persisted === 'boolean' ? persisted : null,
    usage,
    quota,
    ratio: usage !== null && quota > 0 ? usage / quota : null,
  }
}

export async function requestBrowserStoragePersistence() {
  const storage = globalThis.navigator?.storage
  if (typeof storage?.persist !== 'function') return false
  return storage.persist()
}
