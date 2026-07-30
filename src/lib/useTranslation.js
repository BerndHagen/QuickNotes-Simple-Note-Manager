import { useCallback } from 'react'
import { useUIStore } from '../store'
import { translations, LANGUAGES, detectLanguage } from './i18n'

const lookup = (catalogue, keys) => {
  let result = catalogue
  for (const key of keys) {
    if (result == null || result[key] === undefined) return undefined
    result = result[key]
  }
  return typeof result === 'string' ? result : undefined
}

/**
 * `t(path, fallback?)`
 *
 * Resolves against the active language, then English.
 *
 * When a key is missing and no fallback is supplied it returns the key
 * path, which is what makes an untranslated string visible in the UI
 * (e.g. "settings.noteListDisplay"). Callers that have sensible English
 * copy should pass it as the second argument. Appending a `||` fallback
 * instead does nothing, because the returned key path is itself truthy —
 * that mistake was present at 182 call sites.
 */
export function useTranslation() {
  const { language } = useUIStore()

  const t = useCallback(
    (path, fallback) => {
      const keys = path.split('.')
      const localised = lookup(translations[language], keys)
      if (localised !== undefined) return localised

      const english = lookup(translations.en, keys)
      if (english !== undefined) return english

      return fallback !== undefined ? fallback : path
    },
    [language]
  )

  return { t, language, languages: LANGUAGES }
}

export { LANGUAGES, detectLanguage }
