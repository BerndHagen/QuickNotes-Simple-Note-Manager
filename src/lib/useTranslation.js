import { useCallback } from 'react'
import { useUIStore } from '../store'
import { translations, LANGUAGES, detectLanguage } from './i18n'

export function useTranslation() {
  const { language } = useUIStore()
  
  const t = useCallback((path) => {
    const keys = path.split('.')
    let result = translations[language]
    
    for (const key of keys) {
      if (result && result[key] !== undefined) {
        result = result[key]
      } else {
        result = translations.en
        for (const k of keys) {
          if (result && result[k] !== undefined) {
            result = result[k]
          } else {
            return path
          }
        }
        break
      }
    }
    
    return result
  }, [language])

  return { t, language, languages: LANGUAGES }
}

export { LANGUAGES, detectLanguage }
