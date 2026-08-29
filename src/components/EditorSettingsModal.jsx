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
import Button from './ui/Button'
import { Select, Switch } from './ui/Field'
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

function PreferenceToggle({ icon: Icon, label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-content">{label}</p>
          <p className="text-xs text-content-muted">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

const booleanSettingKeys = [
  'showRuler',
  'autoCorrect',
  'showInvisibles',
  'wordWrap',
  'highlightCurrentLine',
]

const enumSettings = {
  documentWidth: new Set(['focused', 'standard', 'wide', 'full']),
  ribbonDensity: new Set(['comfortable', 'compact']),
  defaultRibbonTab: new Set(['home', 'insert', 'layout', 'review', 'view']),
  defaultCheckboxStyle: new Set(['square', 'rounded', 'circle']),
  defaultCheckboxColor: new Set(['accent', 'blue', 'purple', 'amber', 'rose', 'slate']),
  defaultCheckboxSize: new Set(['compact', 'standard', 'large']),
  defaultCheckedStyle: new Set(['strike', 'fade', 'keep']),
}

export function normalizeEditorSettings(value) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const migratedCandidate = {
    ...candidate,
    defaultRibbonTab: candidate.defaultRibbonTab === 'format'
      ? 'home'
      : candidate.defaultRibbonTab === 'tools'
        ? 'view'
        : candidate.defaultRibbonTab,
  }
  const normalized = { ...defaultSettings }
  const allowedFonts = new Set(fontOptions.map((option) => option.value))
  const allowedFontSizes = new Set(fontSizeOptions.map((option) => option.value))
  const allowedLineHeights = new Set(lineHeightOptions.map((option) => option.value))
  const allowedTabSizes = new Set(tabSizeOptions.map((option) => option.value))

  if (allowedFonts.has(migratedCandidate.defaultFontFamily)) normalized.defaultFontFamily = migratedCandidate.defaultFontFamily
  if (allowedFontSizes.has(migratedCandidate.defaultFontSize)) normalized.defaultFontSize = migratedCandidate.defaultFontSize
  if (allowedLineHeights.has(migratedCandidate.defaultLineHeight)) normalized.defaultLineHeight = migratedCandidate.defaultLineHeight
  if (allowedTabSizes.has(migratedCandidate.tabSize)) normalized.tabSize = migratedCandidate.tabSize
  for (const [key, values] of Object.entries(enumSettings)) {
    if (values.has(migratedCandidate[key])) normalized[key] = migratedCandidate[key]
  }
  for (const key of booleanSettingKeys) {
    if (typeof migratedCandidate[key] === 'boolean') normalized[key] = migratedCandidate[key]
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
                <Select
                  id="editor-document-width"
                  value={settings.documentWidth}
                  onChange={(e) => handleSettingChange('documentWidth', e.target.value)}
                >
                  <option value="focused">Focused · 680 px</option>
                  <option value="standard">Standard · 794 px</option>
                  <option value="wide">Wide · 960 px</option>
                  <option value="full">Full width</option>
                </Select>
              </div>
              <div>
                <label htmlFor="editor-default-ribbon-tab" className="mb-2 block text-sm font-medium text-content-muted">
                  Tab shown when editor opens
                </label>
                <Select
                  id="editor-default-ribbon-tab"
                  value={settings.defaultRibbonTab}
                  onChange={(e) => handleSettingChange('defaultRibbonTab', e.target.value)}
                >
                  <option value="home">Home</option>
                  <option value="insert">Insert</option>
                  <option value="layout">Layout</option>
                  <option value="review">Review</option>
                  <option value="view">View</option>
                </Select>
              </div>
              <div>
                <label htmlFor="editor-ribbon-density" className="mb-2 block text-sm font-medium text-content-muted">
                  Ribbon spacing
                </label>
                <Select
                  id="editor-ribbon-density"
                  value={settings.ribbonDensity}
                  onChange={(e) => handleSettingChange('ribbonDensity', e.target.value)}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </Select>
              </div>
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
              <Select
                id="editor-default-font"
                value={settings.defaultFontFamily}
                onChange={(e) => handleSettingChange('defaultFontFamily', e.target.value)}
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
              </Select>
            </div>
            <div>
              <label htmlFor="editor-default-font-size" className="block mb-2 text-sm font-medium text-content-muted">
                Default Font Size
              </label>
              <Select
                id="editor-default-font-size"
                value={settings.defaultFontSize}
                onChange={(e) => handleSettingChange('defaultFontSize', e.target.value)}
              >
                {fontSizeOptions.map(size => (
                  <option key={size.value} value={size.value}>{size.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="editor-default-line-height" className="block mb-2 text-sm font-medium text-content-muted">
                Line Height
              </label>
              <Select
                id="editor-default-line-height"
                value={settings.defaultLineHeight}
                onChange={(e) => handleSettingChange('defaultLineHeight', e.target.value)}
              >
                {lineHeightOptions.map(lh => (
                  <option key={lh.value} value={lh.value}>{lh.name}</option>
                ))}
              </Select>
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
                <Select id="editor-checkbox-shape" value={settings.defaultCheckboxStyle} onChange={(e) => handleSettingChange('defaultCheckboxStyle', e.target.value)}>
                  <option value="square">Square</option>
                  <option value="rounded">Rounded</option>
                  <option value="circle">Circle</option>
              </Select>
              </div>
              <div>
                <label htmlFor="editor-checkbox-colour" className="mb-2 block text-sm font-medium text-content-muted">Tick colour</label>
                <Select id="editor-checkbox-colour" value={settings.defaultCheckboxColor} onChange={(e) => handleSettingChange('defaultCheckboxColor', e.target.value)}>
                  <option value="accent">QuickNotes green</option>
                  <option value="blue">Blue</option>
                  <option value="purple">Purple</option>
                  <option value="amber">Amber</option>
                  <option value="rose">Rose</option>
                  <option value="slate">Slate</option>
                </Select>
              </div>
              <div>
                <label htmlFor="editor-checkbox-size" className="mb-2 block text-sm font-medium text-content-muted">Size</label>
                <Select id="editor-checkbox-size" value={settings.defaultCheckboxSize} onChange={(e) => handleSettingChange('defaultCheckboxSize', e.target.value)}>
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </Select>
              </div>
              <div>
                <label htmlFor="editor-checked-treatment" className="mb-2 block text-sm font-medium text-content-muted">Completed text</label>
                <Select id="editor-checked-treatment" value={settings.defaultCheckedStyle} onChange={(e) => handleSettingChange('defaultCheckedStyle', e.target.value)}>
                  <option value="strike">Strike through</option>
                  <option value="fade">Fade</option>
                  <option value="keep">Keep unchanged</option>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-content-muted uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              Display
            </h3>
            <div className="divide-y divide-[var(--qn-border-subtle)] border-y border-subtle">
              <PreferenceToggle
                icon={Ruler}
                label="Show ruler"
                description="Display the horizontal ruler above the document."
                checked={settings.showRuler}
                onChange={(checked) => handleSettingChange('showRuler', checked)}
              />
              <PreferenceToggle
                icon={AlignLeft}
                label="Word wrap"
                description="Wrap long lines to fit the editor width."
                checked={settings.wordWrap}
                onChange={(checked) => handleSettingChange('wordWrap', checked)}
              />
              <PreferenceToggle
                icon={EyeOff}
                label="Show invisible characters"
                description="Display spaces, tabs, and line breaks."
                checked={settings.showInvisibles}
                onChange={(checked) => handleSettingChange('showInvisibles', checked)}
              />
            </div>
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
              <Select
                id="editor-tab-size"
                value={settings.tabSize}
                onChange={(e) => handleSettingChange('tabSize', parseInt(e.target.value))}
              >
                {tabSizeOptions.map(tab => (
                  <option key={tab.value} value={tab.value}>{tab.name}</option>
                ))}
              </Select>
            </div>
            <div className="border-y border-subtle">
              <PreferenceToggle
                label="Browser auto-correction"
                description="Allow supported browsers to correct typing mistakes."
                checked={settings.autoCorrect}
                onChange={(checked) => handleSettingChange('autoCorrect', checked)}
              />
            </div>
          </div>
        </div>
        <div data-dialog-footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-strong px-5 py-4 sm:px-6">
          <Button
            onClick={handleResetDefaults}
            variant="ghost"
            size="sm"
            icon={RotateCcw}
          >
            Reset to Defaults
          </Button>
          <Button
            onClick={() => setEditorSettingsOpen(false)}
            variant="primary"
            size="sm"
          >
            Done
          </Button>
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
