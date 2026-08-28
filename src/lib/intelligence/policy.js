import { PROCESSING_LOCATIONS } from './model'

export const INTELLIGENCE_MODES = Object.freeze(['off', 'localOnly', 'externalAllowed'])

export const createDefaultIntelligenceSettings = (ownerId) => ({
  ownerId,
  mode: 'localOnly',
  confirmExternalEveryTime: true,
  automaticImageOcr: false,
  automaticPdfTextExtraction: false,
  updatedAt: new Date().toISOString(),
})

export const normalizeIntelligenceSettings = (value, ownerId = value?.ownerId) => {
  const defaults = createDefaultIntelligenceSettings(ownerId)
  return {
    ...defaults,
    mode: INTELLIGENCE_MODES.includes(value?.mode) ? value.mode : defaults.mode,
    // Task 4's transfer contract is deliberately non-bypassable: allowing
    // external providers never grants them standing access to note content.
    confirmExternalEveryTime: true,
    automaticImageOcr: Boolean(value?.automaticImageOcr),
    automaticPdfTextExtraction: Boolean(value?.automaticPdfTextExtraction),
    updatedAt: typeof value?.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
      ? value.updatedAt
      : defaults.updatedAt,
  }
}

export const evaluateProcessingPolicy = (
  settings,
  processingLocation,
  { externalConfirmed = false, online = typeof navigator === 'undefined' ? true : navigator.onLine } = {}
) => {
  if (!PROCESSING_LOCATIONS.includes(processingLocation)) {
    return { allowed: false, reason: 'This provider has an unknown processing location.' }
  }
  const normalized = normalizeIntelligenceSettings(settings)
  if (normalized.mode === 'off') {
    return { allowed: false, reason: 'Intelligent features are disabled in privacy settings.' }
  }
  if (processingLocation === 'local') return { allowed: true, reason: null }
  if (normalized.mode !== 'externalAllowed') {
    return { allowed: false, reason: 'External processing is disabled in privacy settings.' }
  }
  if (processingLocation === 'external' && !online) return { allowed: false, reason: 'This provider requires a network connection.' }
  if (normalized.confirmExternalEveryTime && !externalConfirmed) {
    return { allowed: false, requiresConfirmation: true, reason: 'Confirm this browser-managed or external processing operation to continue.' }
  }
  return { allowed: true, reason: null }
}
