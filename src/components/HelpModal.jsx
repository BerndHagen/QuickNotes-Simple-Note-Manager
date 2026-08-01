import { useState } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Cloud,
  ExternalLink,
  FileText,
  HelpCircle,
  Keyboard,
  Zap,
} from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { Button, Modal, buttonClasses } from './ui'

export default function HelpModal() {
  const {
    helpModalOpen,
    setHelpModalOpen,
    setPrivacyModalOpen,
    setTermsModalOpen,
  } = useUIStore()
  const { t } = useTranslation()
  const [expandedSection, setExpandedSection] = useState('getting-started')

  const sections = [
    {
      id: 'getting-started',
      title: t('help.gettingStarted'),
      icon: Zap,
      content: [
        { q: t('help.createNoteQ'), a: t('help.createNoteA') },
        { q: t('help.quickNoteQ'), a: t('help.quickNoteA') },
        { q: t('help.organizeFoldersQ'), a: t('help.organizeFoldersA') },
      ],
    },
    {
      id: 'editing',
      title: t('help.editing'),
      icon: FileText,
      content: [
        { q: t('help.formatTextQ'), a: t('help.formatTextA') },
        { q: t('help.addImagesQ'), a: t('help.addImagesA') },
        { q: t('help.templatesQ'), a: t('help.templatesA') },
      ],
    },
    {
      id: 'organization',
      title: t('help.organization'),
      icon: Archive,
      content: [
        { q: t('help.tagsQ'), a: t('help.tagsA') },
        { q: t('help.favoritesQ'), a: t('help.favoritesA') },
        { q: t('help.archiveQ'), a: t('help.archiveA') },
      ],
    },
    {
      id: 'sync',
      title: t('help.cloudSync'),
      icon: Cloud,
      content: [
        { q: t('help.syncSetupQ'), a: t('help.syncSetupA') },
        { q: t('help.offlineQ'), a: t('help.offlineA') },
      ],
    },
    {
      id: 'shortcuts',
      title: t('help.keyboardShortcuts'),
      icon: Keyboard,
      content: [{ q: t('help.shortcutsListQ'), a: t('help.shortcutsListA') }],
    },
  ]

  const openLegalDialog = (dialog) => {
    setHelpModalOpen(false)
    if (dialog === 'privacy') setPrivacyModalOpen(true)
    else setTermsModalOpen(true)
  }

  return (
    <Modal
      open={helpModalOpen}
      onClose={() => setHelpModalOpen(false)}
      title={t('help.title')}
      description="Tips and instructions for QuickNotes"
      icon={HelpCircle}
      size="xl"
      bodyClassName="!overflow-hidden p-0 sm:p-0"
    >
      <div
        role="region"
        aria-label={t('help.title')}
        tabIndex={0}
        className="h-full overflow-y-auto overscroll-contain px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)] sm:px-6"
      >
        <div className="space-y-3">
          {sections.map((section) => {
            const expanded = expandedSection === section.id
            const triggerId = `qn-help-${section.id}-trigger`
            const panelId = `qn-help-${section.id}-panel`
            const SectionIcon = section.icon

            return (
              <section key={section.id} className="overflow-hidden rounded-card border border-subtle">
                <h3>
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setExpandedSection(expanded ? null : section.id)}
                    className="flex w-full items-center justify-between gap-3 bg-surface-sunken px-4 py-3 text-left text-ui-lg font-medium text-content transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--qn-focus-ring)]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <SectionIcon className="h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
                      <span>{section.title}</span>
                    </span>
                    {expanded ? (
                      <ChevronDown className="h-5 w-5 shrink-0 text-content-subtle" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-content-subtle" aria-hidden="true" />
                    )}
                  </button>
                </h3>

                {expanded && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                    className="border-t border-subtle px-4 py-4"
                  >
                    <dl className="space-y-4">
                      {section.content.map((item) => (
                        <div key={item.q}>
                          <dt className="text-ui-md font-medium text-content">{item.q}</dt>
                          <dd className="mt-1 text-ui-md leading-relaxed text-content-muted">
                            {item.a}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <div className="mt-6 border-t border-subtle pt-5">
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/issues"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              Report an Issue
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="qn-sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              Discussions
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="qn-sr-only"> (opens in a new tab)</span>
            </a>
            <Button variant="ghost" size="sm" onClick={() => openLegalDialog('privacy')}>
              {t('help.privacyPolicy')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openLegalDialog('terms')}>
              {t('help.termsOfService')}
            </Button>
          </div>
          <p className="mt-3 text-center text-ui-xs text-content-muted">QuickNotes v2.0.2</p>
        </div>
      </div>
    </Modal>
  )
}
