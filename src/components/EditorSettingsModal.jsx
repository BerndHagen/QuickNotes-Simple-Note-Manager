import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Settings,
  Ruler,
  Type,
  AlignLeft,
  Eye,
  EyeOff,
  RotateCcw,
  AlertCircle,
  SpellCheck as Spellcheck
} from 'lucide-react'
import { useUIStore } from '../store'
import LegacyDialog from './ui/LegacyDialog'
import {
  DEFAULT_EDITOR_FONT,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_GROUPS,
} from '../lib/editorFonts'
const STORAGE_KEY = 'editorSettings'
const defaultSettings = {
  showRuler: false,
  defaultFontFamily: DEFAULT_EDITOR_FONT,
  defaultFontSize: '16px',
  defaultLineHeight: '1.5',
  autoCorrect: false,
  tabSize: 4,
  showInvisibles: false,
  wordWrap: true,
  highlightCurrentLine: false,
}
const fontOptions = EDITOR_FONT_FAMILIES

const fontSizeOptions = [
  { name: '12px', value: '12px' },
  { name: '14px', value: '14px' },
  { name: '16px', value: '16px' },
  { name: '18px', value: '18px' },
  { name: '20px', value: '20px' },
  { name: '24px', value: '24px' },
]

const lineHeightOptions = [
  { name: 'Compact (1.0)', value: '1' },
  { name: 'Normal (1.5)', value: '1.5' },
  { name: 'Relaxed (1.75)', value: '1.75' },
  { name: 'Loose (2.0)', value: '2' },
]

const tabSizeOptions = [
  { name: '2 spaces', value: 2 },
  { name: '4 spaces', value: 4 },
  { name: '8 spaces', value: 8 },
]

const booleanSettingKeys = [
  'showRuler',
  'autoCorrect',
  'showInvisibles',
  'wordWrap',
  'highlightCurrentLine',
]

export function normalizeEditorSettings(value) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const normalized = { ...defaultSettings }
  const allowedFonts = new Set(fontOptions.map((option) => option.value))
  const allowedFontSizes = new Set(fontSizeOptions.map((option) => option.value))
  const allowedLineHeights = new Set(lineHeightOptions.map((option) => option.value))
  const allowedTabSizes = new Set(tabSizeOptions.map((option) => option.value))

  if (allowedFonts.has(candidate.defaultFontFamily)) normalized.defaultFontFamily = candidate.defaultFontFamily
  if (allowedFontSizes.has(candidate.defaultFontSize)) normalized.defaultFontSize = candidate.defaultFontSize
  if (allowedLineHeights.has(candidate.defaultLineHeight)) normalized.defaultLineHeight = candidate.defaultLineHeight
  if (allowedTabSizes.has(candidate.tabSize)) normalized.tabSize = candidate.tabSize
  for (const key of booleanSettingKeys) {
    if (typeof candidate[key] === 'boolean') normalized[key] = candidate[key]
  }
  return normalized
}

function loadEditorSettings() {
  try {
    return normalizeEditorSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    return { ...defaultSettings }
  }
}

export default function EditorSettingsModal() {
  const { editorSettingsOpen, setEditorSettingsOpen } = useUIStore()
  const [settings, setSettings] = useState(loadEditorSettings)
  const [persistenceError, setPersistenceError] = useState('')
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setPersistenceError('')
    } catch {
      setPersistenceError('Editor preferences could not be saved in this browser. They will apply until this tab is closed.')
    }
    window.dispatchEvent(new CustomEvent('editorSettingsChanged', { detail: settings }))
  }, [settings])

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleResetDefaults = () => {
    setSettings(defaultSettings)
  }

  if (!editorSettingsOpen) return null

  return (
    <LegacyDialog label="Editor settings" onClose={() => setEditorSettingsOpen(false)} align="center">
      <div className="flex max-h-full min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-raised shadow-2xl modal-animate sm:mx-4">
        <div className="flex shrink-0 items-center justify-between p-5 qn-banner-surface text-white">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Editor Settings</h2>
              <p className="text-sm text-white/70">Customize your editing experience</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditorSettingsOpen(false)}
            aria-label="Close editor settings"
            className="qn-square-control rounded-full p-2 transition-colors hover:bg-white/20"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {persistenceError && (
            <div role="alert" className="flex gap-2 rounded-lg border border-danger-border bg-danger-soft p-3 text-sm text-danger-text">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{persistenceError}</p>
            </div>
          )}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-content-muted uppercase tracking-wider">
              <Type className="w-4 h-4" />
              Typography
            </h3>
            <div>
              <label htmlFor="editor-default-font" className="block mb-2 text-sm font-medium text-content-muted">
                Default Font Family
              </label>
              <select
                id="editor-default-font"
                value={settings.defaultFontFamily}
                onChange={(e) => handleSettingChange('defaultFontFamily', e.target.value)}
                className="w-full px-3 py-2 text-content bg-surface-sunken border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {EDITOR_FONT_GROUPS.map((group) => (
                  <optgroup key={group.name} label={group.name}>
                    {group.fonts.map((font) => (
                      <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                        {font.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="editor-default-font-size" className="block mb-2 text-sm font-medium text-content-muted">
                Default Font Size
              </label>
              <select
                id="editor-default-font-size"
                value={settings.defaultFontSize}
                onChange={(e) => handleSettingChange('defaultFontSize', e.target.value)}
                className="w-full px-3 py-2 text-content bg-surface-sunken border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {fontSizeOptions.map(size => (
                  <option key={size.value} value={size.value}>{size.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="editor-default-line-height" className="block mb-2 text-sm font-medium text-content-muted">
                Line Height
              </label>
              <select
                id="editor-default-line-height"
                value={settings.defaultLineHeight}
                onChange={(e) => handleSettingChange('defaultLineHeight', e.target.value)}
                className="w-full px-3 py-2 text-content bg-surface-sunken border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {lineHeightOptions.map(lh => (
                  <option key={lh.value} value={lh.value}>{lh.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-content-muted uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              Display
            </h3>
            <label className="flex items-center justify-between p-3 transition-colors border border-subtle rounded-lg cursor-pointer hover:bg-surface-sunken dark:hover:bg-surface-sunken">
              <div className="flex items-center gap-3">
                <Ruler className="w-5 h-5 text-content-muted" />
                <div>
                  <p className="font-medium text-content">Show Ruler</p>
                  <p className="text-xs text-content-muted">Display ruler at the top of the editor</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.showRuler}
                onChange={(e) => handleSettingChange('showRuler', e.target.checked)}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 transition-colors border border-subtle rounded-lg cursor-pointer hover:bg-surface-sunken dark:hover:bg-surface-sunken">
              <div className="flex items-center gap-3">
                <AlignLeft className="w-5 h-5 text-content-muted" />
                <div>
                  <p className="font-medium text-content">Word Wrap</p>
                  <p className="text-xs text-content-muted">Wrap long lines to fit the editor width</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.wordWrap}
                onChange={(e) => handleSettingChange('wordWrap', e.target.checked)}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 transition-colors border border-subtle rounded-lg cursor-pointer hover:bg-surface-sunken dark:hover:bg-surface-sunken">
              <div className="flex items-center gap-3">
                <EyeOff className="w-5 h-5 text-content-muted" />
                <div>
                  <p className="font-medium text-content">Show Invisible Characters</p>
                  <p className="text-xs text-content-muted">Display spaces, tabs, and line breaks</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.showInvisibles}
                onChange={(e) => handleSettingChange('showInvisibles', e.target.checked)}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-content-muted uppercase tracking-wider">
              <Spellcheck className="w-4 h-4" />
              Editing
            </h3>
            <div>
              <label htmlFor="editor-tab-size" className="block mb-2 text-sm font-medium text-content-muted">
                Tab Size
              </label>
              <select
                id="editor-tab-size"
                value={settings.tabSize}
                onChange={(e) => handleSettingChange('tabSize', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-content bg-surface-sunken border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {tabSizeOptions.map(tab => (
                  <option key={tab.value} value={tab.value}>{tab.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-subtle bg-surface-sunken px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-4 py-2 text-sm text-content-muted transition-colors rounded-lg dark:text-content-subtle hover:bg-surface-sunken dark:hover:bg-surface-sunken"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={() => setEditorSettingsOpen(false)}
            className="px-4 py-2 font-medium text-white transition-colors rounded-lg bg-emerald-600 hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    </LegacyDialog>
  )
}
export function useEditorSettings() {
  const [settings, setSettings] = useState(loadEditorSettings)
  const spellCheck = useUIStore((state) => state.spellCheck)

  useEffect(() => {
    const handleSettingsChange = (event) => {
      setSettings(normalizeEditorSettings(event.detail))
    }
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) setSettings(loadEditorSettings())
    }

    window.addEventListener('editorSettingsChanged', handleSettingsChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('editorSettingsChanged', handleSettingsChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return useMemo(() => ({ ...settings, spellCheck }), [settings, spellCheck])
}
