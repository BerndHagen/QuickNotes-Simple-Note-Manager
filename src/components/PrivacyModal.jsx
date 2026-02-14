import React from 'react'
import { X, Shield } from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'

export default function PrivacyModal() {
  const { privacyModalOpen, setPrivacyModalOpen } = useUIStore()
  const { t } = useTranslation()

  if (!privacyModalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('privacy.title')}</h2>
              <p className="text-sm text-white/70">How we handle your data</p>
            </div>
          </div>
          <button
            onClick={() => setPrivacyModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('privacy.lastUpdated')}: December 2024
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              {t('privacy.dataCollection')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.dataCollectionText')}
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              {t('privacy.localStorage')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.localStorageText')}
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              {t('privacy.cloudSync')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.cloudSyncText')}
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              {t('privacy.cookies')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.cookiesText')}
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              {t('privacy.thirdParty')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.thirdPartyText')}
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              {t('privacy.yourRights')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.yourRightsText')}
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              {t('privacy.contact')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.contactText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
