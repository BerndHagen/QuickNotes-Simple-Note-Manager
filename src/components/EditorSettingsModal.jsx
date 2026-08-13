import { useEffect, useMemo, useState } from 'react'
import {
  Settings,
  Ruler,
  Type,
  AlignLeft,
  ListChecks,
  PanelTop,
  Eye,
  EyeOff,
  RotateCcw,
  AlertCircle,
  SpellCheck as Spellcheck
} from 'lucide-react'
import { useUIStore } from '../store'
import LegacyDialog from './ui/LegacyDialog'
import DialogHeader from './ui/DialogHeader'
import {
  DEFAULT_EDITOR_FONT,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_GROUPS,
} from '../lib/editorFonts'
const STORAGE_KEY = 'editorSettings'
let volatileEditorSettings = null
const defaultSettings = {
  showRuler: false,
  documentWidth: 'standard',
  ribbonDensity: 'comfortable',
  defaultRibbonTab: 'home',
  showRibbonGroupLabels: true,
  defaultFontFamily: DEFAULT_EDITOR_FONT,
  defaultFontSize: '16px',
  defaultLineHeight: '1.5',
  autoCorrect: false,
  tabSize: 4,
  showInvisibles: false,
  wordWrap: true,
  highlightCurrentLine: false,
  defaultCheckboxStyle: 'rounded',
  defaultCheckboxColor: 'accent',
  defaultCheckboxSize: 'standard',
  defaultCheckedStyle: 'strike',
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
  'showRibbonGroupLabels',
  'autoCorrect',
  'showInvisibles',
  'wordWrap',
  'highlightCurrentLine',
]

const enumSettings = {
  documentWidth: new Set(['focused', 'standard', 'wide', 'full']),
  ribbonDensity: new Set(['comfortable', 'compact']),
  defaultRibbonTab: new Set(['home', 'insert', 'format', 'layout', 'tools']),
  defaultCheckboxStyle: new Set(['square', 'rounded', 'circle']),
  defaultCheckboxColor: new Set(['accent', 'blue', 'purple', 'amber', 'rose', 'slate']),
  defaultCheckboxSize: new Set(['compact', 'standard', 'large']),
  defaultCheckedStyle: new Set(['strike', 'fade', 'keep']),
}

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
  for (const [key, values] of Object.entries(enumSettings)) {
    if (values.has(candidate[key])) normalized[key] = candidate[key]
  }
  for (const key of booleanSettingKeys) {
    if (typeof candidate[key] === 'boolean') normalized[key] = candidate[key]
  }
  return normalized
}

export function updateEditorSettings(patch) {
  const next = normalizeEditorSettings({ ...loadEditorSettings(), ...patch })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    volatileEditorSettings = null
  } catch {
    // The open settings dialog reports persistence failures. Inline editor
    // controls still apply the preference for the lifetime of this tab.
    volatileEditorSettings = next
  }
  window.dispatchEvent(new CustomEvent('editorSettingsChanged', { detail: next }))
  return next
}

function loadEditorSettings() {
  if (volatileEditorSettings) return normalizeEditorSettings(volatileEditorSettings)
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
      volatileEditorSettings = null
      setPersistenceError('')
    } catch {
      volatileEditorSettings = settings
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
      <div className="flex max-h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-dialog border border-subtle bg-surface-raised shadow-dialog modal-animate sm:mx-4">
        <DialogHeader
          title="Editor Settings"
          description="Customize your editing experience"
          icon={Settings}
          onClose={() => setEditorSettingsOpen(false)}
          closeLabel="Close editor settings"
        />
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {persistenceError && (
            <div role="alert" className="flex gap-2 rounded-lg border border-danger-border bg-danger-soft p-3 text-sm text-danger-text">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{persistenceError}</p>
            </div>
          )}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-content-muted">
              <PanelTop className="h-4 w-4" />
              Workbench
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="editor-document-width" className="mb-2 block text-sm font-medium text-content-muted">
                  Note width
                </label>
                <select
                  id="editor-document-width"
                  value={settings.documentWidth}
                  onChange={(e) => handleSettingChange('documentWidth', e.target.value)}
                  className="w-full rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-content focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="focused">Focused · 720 px</option>
                  <option value="standard">Standard · 880 px</option>
                  <option value="wide">Wide · 1120 px</option>
                  <option value="full">Full width</option>
                </select>
              </div>
              <div>
                <label htmlFor="editor-default-ribbon-tab" className="mb-2 block text-sm font-medium text-content-muted">
                  Tab shown when editor opens
                </label>
                <select
                  id="editor-default-ribbon-tab"
                  value={settings.defaultRibbonTab}
                  onChange={(e) => handleSettingChange('defaultRibbonTab', e.target.value)}
                  className="w-full rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-content focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="home">Home</option>
                  <option value="insert">Insert</option>
                  <option value="format">Format</option>
                  <option value="layout">Layout</option>
                  <option value="tools">Tools</option>
                </select>
              </div>
              <div>
                <label htmlFor="editor-ribbon-density" className="mb-2 block text-sm font-medium text-content-muted">
                  Ribbon spacing
                </label>
                <select
                  id="editor-ribbon-density"
                  value={settings.ribbonDensity}
                  onChange={(e) => handleSettingChange('ribbonDensity', e.target.value)}
                  className="w-full rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-content focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-control border border-subtle p-3 transition-colors hover:bg-surface-sunken">
                <div className="flex items-center gap-3">
                  <PanelTop className="h-5 w-5 text-content-muted" />
                  <div>
                    <p className="font-medium text-content">Group labels</p>
                    <p className="text-xs text-content-muted">Keep command groups named</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showRibbonGroupLabels}
                  onChange={(e) => handleSettingChange('showRibbonGroupLabels', e.target.checked)}
                  className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500"
                />
              </label>
            </div>
          </div>
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
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-content-muted">
              <ListChecks className="h-4 w-4" />
              New checklists
            </h3>
            <p className="text-sm text-content-muted">These defaults apply to newly created checklist items. Existing items keep their own appearance.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="editor-checkbox-shape" className="mb-2 block text-sm font-medium text-content-muted">Shape</label>
                <select id="editor-checkbox-shape" value={settings.defaultCheckboxStyle} onChange={(e) => handleSettingChange('defaultCheckboxStyle', e.target.value)} className="w-full rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-content focus:ring-2 focus:ring-emerald-500">
                  <option value="square">Square</option>
                  <option value="rounded">Rounded</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
              <div>
                <label htmlFor="editor-checkbox-colour" className="mb-2 block text-sm font-medium text-content-muted">Checked colour</label>
                <select id="editor-checkbox-colour" value={settings.defaultCheckboxColor} onChange={(e) => handleSettingChange('defaultCheckboxColor', e.target.value)} className="w-full rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-content focus:ring-2 focus:ring-emerald-500">
                  <option value="accent">QuickNotes green</option>
                  <option value="blue">Blue</option>
                  <option value="purple">Purple</option>
                  <option value="amber">Amber</option>
                  <option value="rose">Rose</option>
                  <option value="slate">Slate</option>
                </select>
              </div>
              <div>
                <label htmlFor="editor-checkbox-size" className="mb-2 block text-sm font-medium text-content-muted">Size</label>
                <select id="editor-checkbox-size" value={settings.defaultCheckboxSize} onChange={(e) => handleSettingChange('defaultCheckboxSize', e.target.value)} className="w-full rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-content focus:ring-2 focus:ring-emerald-500">
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div>
                <label htmlFor="editor-checked-treatment" className="mb-2 block text-sm font-medium text-content-muted">Completed text</label>
                <select id="editor-checked-treatment" value={settings.defaultCheckedStyle} onChange={(e) => handleSettingChange('defaultCheckedStyle', e.target.value)} className="w-full rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-content focus:ring-2 focus:ring-emerald-500">
                  <option value="strike">Strike through</option>
                  <option value="fade">Fade</option>
                  <option value="keep">Keep unchanged</option>
                </select>
              </div>
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
            <label className="flex cursor-pointer items-center justify-between rounded-control border border-subtle p-3 transition-colors hover:bg-surface-sunken">
              <div>
                <p className="font-medium text-content">Browser auto-correction</p>
                <p className="text-xs text-content-muted">Allow supported browsers to correct typing mistakes</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCorrect}
                onChange={(e) => handleSettingChange('autoCorrect', e.target.checked)}
                className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>
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
      if (event.key === STORAGE_KEY) {
        volatileEditorSettings = null
        setSettings(loadEditorSettings())
      }
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
