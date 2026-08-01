import { Shield } from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { Modal } from './ui'

export default function PrivacyModal() {
  const { privacyModalOpen, setPrivacyModalOpen } = useUIStore()
  const { t } = useTranslation()

  const sections = [
    ['data-collection', t('privacy.dataCollection'), t('privacy.dataCollectionText')],
    ['local-storage', t('privacy.localStorage'), t('privacy.localStorageText')],
    ['cloud-sync', t('privacy.cloudSync'), t('privacy.cloudSyncText')],
    ['browser-storage', t('privacy.cookies'), t('privacy.cookiesText')],
    ['third-party', t('privacy.thirdParty'), t('privacy.thirdPartyText')],
    ['your-rights', t('privacy.yourRights'), t('privacy.yourRightsText')],
    ['contact', t('privacy.contact'), t('privacy.contactText')],
  ]

  return (
    <Modal
      open={privacyModalOpen}
      onClose={() => setPrivacyModalOpen(false)}
      title={t('privacy.title')}
      description="How we handle your data"
      icon={Shield}
      size="xl"
      bodyClassName="!overflow-hidden p-0 sm:p-0"
    >
      <article
        role="region"
        aria-label={t('privacy.title')}
        tabIndex={0}
        className="h-full overflow-y-auto overscroll-contain px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)] sm:px-6"
      >
        <p className="mb-6 text-ui-sm text-content-muted">
          {t('privacy.lastUpdated')}: August 1, 2026
        </p>

        <div className="space-y-6">
          {sections.map(([id, heading, content]) => (
            <section key={id} aria-labelledby={`qn-privacy-${id}`}>
              <h3
                id={`qn-privacy-${id}`}
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
