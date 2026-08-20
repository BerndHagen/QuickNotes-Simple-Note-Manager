import { FileText } from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { Modal } from './ui'

export default function TermsModal() {
  const { termsModalOpen, setTermsModalOpen } = useUIStore()
  const { t } = useTranslation()

  const sections = [
    ['acceptance', t('terms.acceptance'), t('terms.acceptanceText')],
    ['license', t('terms.license'), t('terms.licenseText')],
    ['user-content', t('terms.userContent'), t('terms.userContentText')],
    ['disclaimer', t('terms.disclaimer'), t('terms.disclaimerText')],
    ['limitation', t('terms.limitation'), t('terms.limitationText')],
    ['changes', t('terms.changes'), t('terms.changesText')],
    ['contact', t('terms.contact'), t('terms.contactText')],
  ]

  return (
    <Modal
      open={termsModalOpen}
      onClose={() => setTermsModalOpen(false)}
      title={t('terms.title')}
      description="Usage terms and conditions"
      icon={FileText}
      size="xl"
      bodyPadding="none"
    >
      <article
        role="region"
        aria-label={t('terms.title')}
        tabIndex={0}
        className="px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)] sm:px-6"
      >
        <p className="mb-6 text-ui-sm text-content-muted">
          {t('terms.lastUpdated')}: August 1, 2026
        </p>

        <div className="space-y-6">
          {sections.map(([id, heading, content]) => (
            <section key={id} aria-labelledby={`qn-terms-${id}`}>
              <h3
                id={`qn-terms-${id}`}
                className="text-title-xs font-semibold text-content"
              >
                {heading}
              </h3>
              <p className="mt-2 text-ui-md leading-relaxed text-content-muted">{content}</p>
            </section>
          ))}
        </div>
      </article>
    </Modal>
  )
}
