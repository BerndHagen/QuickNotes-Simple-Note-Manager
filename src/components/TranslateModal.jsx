import React, { useState, useEffect } from 'react'
import {
  X,
  Languages,
  Copy,
  Check,
  Globe
} from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'la', name: 'Latin' },
  { code: 'el', name: 'Greek' },
  { code: 'cs', name: 'Czech' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'ro', name: 'Romanian' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'he', name: 'Hebrew' },
  { code: 'fa', name: 'Persian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'hr', name: 'Croatian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'et', name: 'Estonian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'gl', name: 'Galician' },
  { code: 'eu', name: 'Basque' },
  { code: 'is', name: 'Icelandic' },
  { code: 'ga', name: 'Irish' },
  { code: 'cy', name: 'Welsh' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'sw', name: 'Swahili' },
  { code: 'zu', name: 'Zulu' },
]

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

export default function TranslateModal() {
  const { translateModalOpen, setTranslateModalOpen, translateText: textToTranslate, setTranslateText } = useUIStore()
  const { t } = useTranslation()
  
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('en')
  const [sourceText, setSourceText] = useState('')
  const [copied, setCopied] = useState(false)
  const [translatedText, setTranslatedText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState(false)

  useEffect(() => {
    if (translateModalOpen) {
      const cleanText = textToTranslate?.includes('<') ? stripHtml(textToTranslate) : textToTranslate
      setSourceText(cleanText || '')
      setCopied(false)
      setTranslatedText('')
      setTranslationError(false)
      setIsTranslating(false)
    }
  }, [translateModalOpen, textToTranslate])

  useEffect(() => {
    setTranslatedText('')
    setTranslationError(false)
  }, [sourceLang, targetLang])

  const mapLanguageCode = (code, api = 'mymemory') => {
    if (api === 'mymemory') {
      const mapping = {
        'zh-CN': 'zh-CN',
        'zh-TW': 'zh-TW',
      }
      return mapping[code] || code
    }
    const mapping = {
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'pt': 'pt',
    }
    return mapping[code] || code
  }
  const translateWithMyMemory = async (text, from, to) => {
    const langPair = `${mapLanguageCode(from, 'mymemory')}|${mapLanguageCode(to, 'mymemory')}`
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}&de=quicknotes@example.com`
    
    const response = await fetch(url)
    if (!response.ok) throw new Error('MyMemory API failed')
    
    const data = await response.json()
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText
      
      if (translated.toLowerCase() === text.toLowerCase()) {
        throw new Error('Translation same as input')
      }
      
      const suspiciousPatterns = [
        /fils de discussion/i,
        /\[Translation.*/i,
        /NO QUERY SPECIFIED/i,
        /PLEASE SELECT/i,
      ]
      
      if (suspiciousPatterns.some(pattern => pattern.test(translated))) {
        throw new Error('Suspicious translation detected')
      }
      
      const matchQuality = data.responseData?.match
      if (matchQuality && parseFloat(matchQuality) < 0.5) {
        throw new Error('Low quality translation match')
      }
      
      return translated
    }
    throw new Error('MyMemory translation failed')
  }

  const translateWithLingva = async (text, from, to) => {
    const instances = [
      'https://lingva.ml',
      'https://translate.plausibility.cloud',
      'https://lingva.lunar.icu',
    ]
    
    for (const instance of instances) {
      try {
        const url = `${instance}/api/v1/${mapLanguageCode(from, 'lingva')}/${mapLanguageCode(to, 'lingva')}/${encodeURIComponent(text)}`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data.translation) {
            return data.translation
          }
        }
      } catch (e) {
        continue
      }
    }
    throw new Error('Lingva translation failed')
  }

  const translateWithLibreTranslate = async (text, from, to) => {
    const instances = [
      'https://libretranslate.com/translate',
      'https://translate.argosopentech.com/translate',
      'https://trans.zillyhuhn.com/translate',
    ]
    
    for (const instanceUrl of instances) {
      try {
        const response = await fetch(instanceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            source: mapLanguageCode(from),
            target: mapLanguageCode(to),
            format: 'text'
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.translatedText) {
            return data.translatedText
          }
        }
      } catch (e) {
        continue
      }
    }
    throw new Error('LibreTranslate failed')
  }

  const translateWithSimplyTranslate = async (text, from, to) => {
    const instances = [
      'https://simplytranslate.org',
      'https://st.tokhmi.xyz',
      'https://translate.bus-hit.me',
    ]
    
    for (const instance of instances) {
      try {
        const url = `${instance}/api/translate/?engine=google&from=${from}&to=${to}&text=${encodeURIComponent(text)}`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data.translated_text) {
            return data.translated_text
          }
        }
      } catch (e) {
        continue
      }
    }
    throw new Error('SimplyTranslate failed')
  }

  const handleTranslate = async () => {
    if (!sourceText.trim()) return
    if (sourceLang === targetLang) {
      setTranslatedText(sourceText)
      return
    }

    setIsTranslating(true)
    setTranslationError(false)
    setTranslatedText('')

    const textToTranslate = sourceText.trim()
    
    try {
      try {
        const result = await translateWithSimplyTranslate(textToTranslate, sourceLang, targetLang)
        setTranslatedText(result)
        return
      } catch (e) {
      }

      try {
        const result = await translateWithLingva(textToTranslate, sourceLang, targetLang)
        setTranslatedText(result)
        return
      } catch (e) {
      }

      try {
        const result = await translateWithMyMemory(textToTranslate, sourceLang, targetLang)
        setTranslatedText(result)
        return
      } catch (e) {
      }

      try {
        const result = await translateWithLibreTranslate(textToTranslate, sourceLang, targetLang)
        setTranslatedText(result)
        return
      } catch (e) {
      }

      throw new Error('All translation services are currently unavailable. Please try again later.')
      
    } catch (error) {
      setTranslationError(true)
      setTranslatedText(error.message || 'Translation failed. Please try again.')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleCopyText = async () => {
    if (!sourceText.trim()) return
    
    try {
      await navigator.clipboard.writeText(sourceText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
    }
  }

  const handleClose = () => {
    setTranslateModalOpen(false)
    setTranslateText('')
  }

  if (!translateModalOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Languages className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('translate.title')}</h2>
              <p className="text-sm text-white/70">Translate your notes to any language</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-3 p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <Globe className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Free Translation Service
              </p>
              <p className="mt-1 text-sm text-blue-600 dark:text-blue-300">
                {t('translate.freeServiceInfo') || 'Free and reliable translations powered by MyMemory API with multiple fallbacks.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Globe className="inline w-4 h-4 mr-1" /> {t('translate.from') || 'From'}
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 bg-gray-100 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Globe className="inline w-4 h-4 mr-1" /> {t('translate.to') || 'To'}
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 bg-gray-100 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('translate.originalText') || 'Original Text'}
              </label>
              <button
                onClick={handleCopyText}
                disabled={!sourceText.trim()}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t('translate.copied') || 'Copied!'}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {t('translate.copyToClipboard') || 'Copy'}
                  </>
                )}
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={t('translate.noTextSelected') || 'Enter or paste text to translate...'}
              className="w-full h-40 px-4 py-3 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg resize-none bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {sourceText.length} {t('notes.characters') || 'characters'}
            </p>
          </div>
          {(translatedText || isTranslating || translationError) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('translate.translatedText') || 'Translated Text'}
                </label>
                {translatedText && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(translatedText).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      })
                    }}
                    className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 hover:underline"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t('translate.copied') || 'Copied!'}
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {t('translate.copyToClipboard') || 'Copy'}
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={translatedText}
                  readOnly
                  placeholder={isTranslating ? (t('translate.translating') || 'Translating...') : (translationError ? (t('translate.translationError') || 'Translation failed, opening Google Translate...') : '')}
                  className="w-full h-40 px-4 py-3 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg resize-none bg-green-50 dark:bg-green-900/20 dark:border-green-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {isTranslating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                      {t('translate.translating') || 'Translating...'}
                    </div>
                  </div>
                )}
              </div>
              {translatedText && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {translatedText.length} {t('notes.characters') || 'characters'}
                </p>
              )}
            </div>
          )}
          <button
            onClick={handleTranslate}
            disabled={!sourceText.trim() || isTranslating || sourceLang === targetLang}
            className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-blue-500/25"
          >
            <Languages className="w-5 h-5" />
            {isTranslating 
              ? (t('translate.translating') || 'Translating...') 
              : sourceLang === targetLang 
                ? 'Select different languages'
                : (t('translate.translate') || 'Translate')
            }
          </button>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('translate.poweredBy') || 'Powered by MyMemory, Lingva & LibreTranslate'}
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 transition-colors rounded-lg dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-600"
          >
            {t('common.close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
