import React, { useState } from 'react'
import {
  X,
  HelpCircle,
  Keyboard,
  FileText,
  Cloud,
  Archive,
  Zap,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'

export default function HelpModal() {
  const { helpModalOpen, setHelpModalOpen } = useUIStore()
  const { t } = useTranslation()
  const [expandedSection, setExpandedSection] = useState('getting-started')

  if (!helpModalOpen) return null

  const sections = [
    {
      id: 'getting-started',
      title: t('help.gettingStarted'),
      icon: Zap,
      content: [
        { q: t('help.createNoteQ'), a: t('help.createNoteA') },
        { q: t('help.quickNoteQ'), a: t('help.quickNoteA') },
        { q: t('help.organizeFoldersQ'), a: t('help.organizeFoldersA') },
      ]
    },
    {
      id: 'editing',
      title: t('help.editing'),
      icon: FileText,
      content: [
        { q: t('help.formatTextQ'), a: t('help.formatTextA') },
        { q: t('help.addImagesQ'), a: t('help.addImagesA') },
        { q: t('help.templatesQ'), a: t('help.templatesA') },
      ]
    },
    {
      id: 'organization',
      title: t('help.organization'),
      icon: Archive,
      content: [
        { q: t('help.tagsQ'), a: t('help.tagsA') },
        { q: t('help.favoritesQ'), a: t('help.favoritesA') },
        { q: t('help.archiveQ'), a: t('help.archiveA') },
      ]
    },
    {
      id: 'sync',
      title: t('help.cloudSync'),
      icon: Cloud,
      content: [
        { q: t('help.syncSetupQ'), a: t('help.syncSetupA') },
        { q: t('help.offlineQ'), a: t('help.offlineA') },
      ]
    },
    {
      id: 'shortcuts',
      title: t('help.keyboardShortcuts'),
      icon: Keyboard,
      content: [
        { q: t('help.shortcutsListQ'), a: t('help.shortcutsListA') },
      ]
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('help.title')}</h2>
              <p className="text-sm text-white/70">Tips and instructions for QuickNotes</p>
            </div>
          </div>
          <button
            onClick={() => setHelpModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="w-5 h-5 text-primary-500" />
                    <span className="font-medium text-gray-900 dark:text-white">{section.title}</span>
                  </div>
                  {expandedSection === section.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {expandedSection === section.id && (
                  <div className="p-4 space-y-4">
                    {section.content.map((item, index) => (
                      <div key={index}>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">{item.q}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-700">
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <a
                href="mailto:support@quicknotes.app"
                className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
              >
                Contact Support <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => { setHelpModalOpen(false); useUIStore.getState().setPrivacyModalOpen(true) }}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t('help.privacyPolicy')}
              </button>
              <button
                onClick={() => { setHelpModalOpen(false); useUIStore.getState().setTermsModalOpen(true) }}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t('help.termsOfService')}
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
              QuickNotes v1.0.0 {"\u2022"} Made with {"\u2764\uFE0F"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
