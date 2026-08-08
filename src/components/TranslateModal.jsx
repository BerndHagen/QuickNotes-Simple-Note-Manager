import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Globe2, Languages, ShieldCheck } from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import {
  MAX_TRANSLATION_BYTES,
  getUtf8ByteLength,
  translateText,
} from '../lib/translation'
import { Button, Field, Modal, Select, Spinner, Textarea } from './ui'

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

const resolveTargetLanguage = (language) => {
  if (language === 'zh') return 'zh-CN'
  return language !== 'en' && LANGUAGES.some((item) => item.code === language) ? language : 'de'
}

export default function TranslateModal() {
  const {
    translateModalOpen,
    setTranslateModalOpen,
    translateText: textToTranslate,
    setTranslateText,
  } = useUIStore()
  const { t, language } = useTranslation()

  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState(() => resolveTargetLanguage(language))
  const [sourceText, setSourceText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [clipboardError, setClipboardError] = useState('')
  const [copiedTarget, setCopiedTarget] = useState(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const abortRef = useRef(null)
  const requestIdRef = useRef(0)
  const copyTimerRef = useRef(null)

  const cancelTranslation = useCallback(() => {
    requestIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setIsTranslating(false)
  }, [])

  const clearResult = useCallback(() => {
    cancelTranslation()
    setTranslatedText('')
    setErrorMessage('')
    setClipboardError('')
    setCopiedTarget(null)
  }, [cancelTranslation])

  useEffect(() => {
    if (!translateModalOpen) {
      cancelTranslation()
      return
    }

    const cleanText = textToTranslate?.includes('<') ? stripHtml(textToTranslate) : textToTranslate
    setSourceText(cleanText || '')
    setTargetLang(resolveTargetLanguage(language))
    setTranslatedText('')
    setErrorMessage('')
    setClipboardError('')
    setCopiedTarget(null)
  }, [cancelTranslation, language, textToTranslate, translateModalOpen])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleClose = () => {
    cancelTranslation()
    setTranslateModalOpen(false)
    setTranslateText('')
  }

  const handleSourceChange = (event) => {
    setSourceText(event.target.value)
    clearResult()
  }

  const handleLanguageChange = (setter) => (event) => {
    setter(event.target.value)
    clearResult()
  }

  const handleTranslate = async () => {
    clearResult()
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const controller = new AbortController()
    abortRef.current = controller
    setIsTranslating(true)

    try {
      const result = await translateText(sourceText, {
        source: sourceLang,
        target: targetLang,
        signal: controller.signal,
      })
      if (requestId === requestIdRef.current) setTranslatedText(result)
    } catch (error) {
      if (error?.name !== 'AbortError' && requestId === requestIdRef.current) {
        setErrorMessage(error?.message || 'Translation failed. Try again later.')
      }
    } finally {
      if (requestId === requestIdRef.current) {
        abortRef.current = null
        setIsTranslating(false)
      }
    }
  }

  const copyToClipboard = async (value, target) => {
    setClipboardError('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(value)
      setCopiedTarget(target)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedTarget(null), 2000)
    } catch {
      setClipboardError('Clipboard access is unavailable. Select the text and copy it manually.')
    }
  }

  const byteCount = getUtf8ByteLength(sourceText)
  const isOverLimit = byteCount > MAX_TRANSLATION_BYTES
  const sameLanguage = sourceLang === targetLang
  const cannotTranslate = !sourceText.trim() || isOverLimit || sameLanguage

  return (
    <Modal
      open={translateModalOpen}
      onClose={handleClose}
      title={t('translate.title', 'Translate text')}
      description="Translate a note or selected passage into another language."
      icon={Languages}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            {t('common.close', 'Close')}
          </Button>
          <Button
            variant="primary"
            icon={Languages}
            loading={isTranslating}
            disabled={cannotTranslate}
            onClick={handleTranslate}
          >
            {isTranslating
              ? t('translate.translating', 'Translating…')
              : t('translate.translate', 'Translate')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-card border border-info-border bg-info-soft p-3.5 text-info-text">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-ui-md font-semibold">Translation privacy</p>
            <p className="mt-0.5 text-ui-sm leading-relaxed">
              Text is sent to MyMemory only when you choose Translate. Do not submit confidential
              content to the public translation service.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('translate.from', 'From')} htmlFor="qn-translation-source-language">
            <Select
              id="qn-translation-source-language"
              value={sourceLang}
              onChange={handleLanguageChange(setSourceLang)}
            >
              {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('translate.to', 'To')} htmlFor="qn-translation-target-language">
            <Select
              id="qn-translation-target-language"
              value={targetLang}
              onChange={handleLanguageChange(setTargetLang)}
            >
              {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {sameLanguage && (
          <p role="status" className="text-ui-sm text-warning-text">
            Choose a different target language to translate this text.
          </p>
        )}

        <Field
          label={t('translate.originalText', 'Source text')}
          htmlFor="qn-translation-source"
          error={isOverLimit ? 'Select a shorter passage before translating.' : undefined}
          hint={`${byteCount.toLocaleString()} of ${MAX_TRANSLATION_BYTES.toLocaleString()} bytes`}
        >
          {({ id, ...fieldProps }) => (
            <div className="space-y-2">
              <Textarea
                id={id}
                {...fieldProps}
                value={sourceText}
                onChange={handleSourceChange}
                rows={7}
                placeholder={t(
                  'translate.noTextSelected',
                  'Enter or paste text to translate…'
                )}
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={copiedTarget === 'source' ? Check : Copy}
                  disabled={!sourceText.trim()}
                  onClick={() => copyToClipboard(sourceText, 'source')}
                >
                  {copiedTarget === 'source'
                    ? t('translate.copied', 'Copied')
                    : t('translate.copyToClipboard', 'Copy source')}
                </Button>
              </div>
            </div>
          )}
        </Field>

        {isTranslating && (
          <div role="status" className="flex items-center gap-3 rounded-card border border-subtle bg-surface-sunken p-4 text-ui-md text-content-muted">
            <Spinner size="sm" label={t('translate.translating', 'Translating text')} />
            <span>{t('translate.translating', 'Translating…')}</span>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="rounded-card border border-danger-border bg-danger-soft p-3.5 text-ui-md text-danger-text">
            <p className="font-semibold">Translation failed</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        )}

        {translatedText && (
          <Field
            label={t('translate.translatedText', 'Translation')}
            htmlFor="qn-translation-result"
            hint={`${translatedText.length.toLocaleString()} characters · MyMemory`}
          >
            {({ id, ...fieldProps }) => (
              <div className="space-y-2">
                <Textarea
                  id={id}
                  {...fieldProps}
                  value={translatedText}
                  readOnly
                  rows={7}
                  className="bg-success-soft"
                />
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copiedTarget === 'translation' ? Check : Copy}
                    onClick={() => copyToClipboard(translatedText, 'translation')}
                  >
                    {copiedTarget === 'translation'
                      ? t('translate.copied', 'Copied')
                      : t('translate.copyToClipboard', 'Copy translation')}
                  </Button>
                </div>
              </div>
            )}
          </Field>
        )}

        {clipboardError && (
          <p role="alert" className="text-ui-sm text-danger-text">
            {clipboardError}
          </p>
        )}

        <div className="flex items-start gap-1.5 text-ui-xs leading-relaxed text-content-subtle">
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            Translation quality varies by language and context. MyMemory documents a shared
            5,000-character daily allowance for anonymous traffic, so availability can vary.
            Review the result before using it.
          </p>
        </div>
      </div>
    </Modal>
  )
}
