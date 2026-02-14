import React, { useState, useEffect } from 'react'
import {
  X,
  Settings,
  Ruler,
  Type,
  AlignLeft,
  Eye,
  EyeOff,
  RotateCcw,
  SpellCheck as Spellcheck
} from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
const defaultSettings = {
  showRuler: false,
  defaultFontFamily: 'Inter, system-ui, sans-serif',
  defaultFontSize: '16px',
  defaultLineHeight: '1.5',
  spellCheck: true,
  autoCorrect: false,
  showLineNumbers: false,
  tabSize: 4,
  showInvisibles: false,
  wordWrap: true,
  highlightCurrentLine: false,
}
const fontOptions = [
  { name: 'Default (Inter)', value: 'Inter, system-ui, sans-serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Times New Roman', value: 'Times New Roman, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Courier New', value: 'Courier New, monospace' },
  { name: 'Calibri', value: 'Calibri, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
]

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

export default function EditorSettingsModal() {
  const { editorSettingsOpen, setEditorSettingsOpen } = useUIStore()
  const { t } = useTranslation()
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('editorSettings')
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
    } catch {
      return defaultSettings
    }
  })
  useEffect(() => {
    localStorage.setItem('editorSettings', JSON.stringify(settings))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Editor Settings</h2>
              <p className="text-sm text-white/70">Customize your editing experience</p>
            </div>
          </div>
          <button
            onClick={() => setEditorSettingsOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <Type className="w-4 h-4" />
              Typography
            </h3>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Default Font Family
              </label>
              <select
                value={settings.defaultFontFamily}
                onChange={(e) => handleSettingChange('defaultFontFamily', e.target.value)}
                className="w-full px-3 py-2 text-gray-900 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {fontOptions.map(font => (
                  <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Default Font Size
              </label>
              <select
                value={settings.defaultFontSize}
                onChange={(e) => handleSettingChange('defaultFontSize', e.target.value)}
                className="w-full px-3 py-2 text-gray-900 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {fontSizeOptions.map(size => (
                  <option key={size.value} value={size.value}>{size.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Line Height
              </label>
              <select
                value={settings.defaultLineHeight}
                onChange={(e) => handleSettingChange('defaultLineHeight', e.target.value)}
                className="w-full px-3 py-2 text-gray-900 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {lineHeightOptions.map(lh => (
                  <option key={lh.value} value={lh.value}>{lh.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              Display
            </h3>
            <label className="flex items-center justify-between p-3 transition-colors border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <Ruler className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Show Ruler</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Display ruler at the top of the editor</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.showRuler}
                onChange={(e) => handleSettingChange('showRuler', e.target.checked)}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 transition-colors border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <AlignLeft className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Word Wrap</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Wrap long lines to fit the editor width</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.wordWrap}
                onChange={(e) => handleSettingChange('wordWrap', e.target.checked)}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 transition-colors border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <EyeOff className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Show Invisible Characters</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Display spaces, tabs, and line breaks</p>
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
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <Spellcheck className="w-4 h-4" />
              Editing
            </h3>
            <label className="flex items-center justify-between p-3 transition-colors border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <Spellcheck className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Spell Check</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Highlight spelling errors</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.spellCheck}
                onChange={(e) => handleSettingChange('spellCheck', e.target.checked)}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Tab Size
              </label>
              <select
                value={settings.tabSize}
                onChange={(e) => handleSettingChange('tabSize', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-gray-900 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {tabSizeOptions.map(tab => (
                  <option key={tab.value} value={tab.value}>{tab.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 transition-colors rounded-lg dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
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
    </div>
  )
}
export function useEditorSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('editorSettings')
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
    } catch {
      return defaultSettings
    }
  })

  useEffect(() => {
    const handleSettingsChange = (event) => {
      setSettings(event.detail)
    }
    
    window.addEventListener('editorSettingsChanged', handleSettingsChange)
    return () => window.removeEventListener('editorSettingsChanged', handleSettingsChange)
  }, [])

  return settings
}
