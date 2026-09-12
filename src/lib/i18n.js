
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00F1ol', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00E7ais', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00EAs', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '\u4E2D\u6587', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093F\u0928\u094D\u0926\u0940', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', dir: 'rtl' },
  { code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', dir: 'ltr' },
]
import en from './i18n/locales/en.js'
import de from './i18n/locales/de.js'
import es from './i18n/locales/es.js'
import fr from './i18n/locales/fr.js'
import pt from './i18n/locales/pt.js'
import zh from './i18n/locales/zh.js'
import hi from './i18n/locales/hi.js'
import ar from './i18n/locales/ar.js'
import ru from './i18n/locales/ru.js'

export const translations = {
  en,
  de,
  es,
  fr,
  pt,
  zh,
  hi,
  ar,
  ru,
}

export function t(lang, path) {
  const keys = path.split('.')
  let result = translations[lang]
  
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
}
export function detectLanguage() {
  const browserLang = navigator.language.split('-')[0]
  return LANGUAGES.find(l => l.code === browserLang)?.code || 'en'
}
