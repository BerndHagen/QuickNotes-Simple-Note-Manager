import { useState } from 'react'
import { Avatar, Field, SegmentedControl, Toggle } from './ui'
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Cloud,
  Keyboard,
  Database,
  Download,
  Upload,
  AlertTriangle,
  List,
  LayoutGrid,
  Settings,
  Shield,
  SpellCheck,
  BarChart3,
  Info,
  ExternalLink,
  Github,
  FileText,
  Clock,
  HardDrive
} from 'lucide-react'
import { useUIStore, useNotesStore, useThemeStore } from '../store'
import { backend, isBackendConfigured, getRedirectUrl, deleteUserAccount } from '../lib/backend'
import { getAuthErrorMessage, validateNewPassword } from '../lib/authValidation'
import { clearLocalData } from '../lib/db'
import { useTranslation, LANGUAGES } from '../lib/useTranslation'
import toast from 'react-hot-toast'
import LegacyDialog from './ui/LegacyDialog'
import { ConfirmDialog } from './FolderDialogs'

export default function SettingsModal() {
  const { 
    settingsOpen, 
    setSettingsOpen, 
    language, 
    setLanguage,
    viewMode,
    setViewMode,
    autoSync,
    setAutoSync,
    syncInterval,
    setSyncInterval,
    syncOnStartup,
    setSyncOnStartup,
    showSyncNotifications,
    setShowSyncNotifications,
    confirmBeforeDelete,
    setConfirmBeforeDelete,
    spellCheck,
    setSpellCheck,
    showNoteStatistics,
    setShowNoteStatistics,
    currentSort,
    setCurrentSort,
    setImportModalOpen,
    setPrivacyModalOpen,
    setTermsModalOpen,
    trashRetentionDays,
    setTrashRetentionDays,
    notePreviewLines,
    setNotePreviewLines,
    dateFormat,
    setDateFormat,
    compactMode,
    setCompactMode,
    autoSaveDelay,
    setAutoSaveDelay,
  } = useUIStore()
  const {
    notes,
    folders,
    tags,
    user,
    setUser,
    activateCloudUser,
    syncWithBackend,
    logout,
  } = useNotesStore()
  const { theme, setTheme } = useThemeStore()
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState('general')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [confirmClearData, setConfirmClearData] = useState(false)

  const cloudEnabled = isBackendConfigured()
  const tabs = [
    { id: 'general', label: t('settings.general'), icon: Monitor },
    { id: 'account', label: t('settings.account'), icon: User },
    ...(cloudEnabled && !user?.isLocal
      ? [{ id: 'sync', label: t('settings.sync'), icon: Cloud }]
      : []),
    { id: 'data', label: t('settings.data'), icon: Database },
    { id: 'shortcuts', label: t('settings.shortcuts'), icon: Keyboard },
    { id: 'about', label: t('settings.aboutTab'), icon: Info },
  ]

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!isBackendConfigured()) {
      toast.error(t('settings.backendNotConfigured'))
      return
    }

    if (!email.trim() || !password) {
      toast.error('Enter your email and password')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await backend.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) throw error

      await activateCloudUser(data.user)
      toast.success(t('settings.toastLoginSuccess'))
      await syncWithBackend()
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!isBackendConfigured()) {
      toast.error(t('settings.backendNotConfigured'))
      return
    }

    const passwordError = validateNewPassword(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    setIsLoading(true)
    try {
      const { error } = await backend.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: getRedirectUrl()
        }
      })

      if (error) throw error

      toast.success(t('settings.toastRegistrationSuccess'))
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeEmail = async (e) => {
    e.preventDefault()
    if (!isBackendConfigured()) {
      toast.error(t('settings.backendNotConfigured'))
      return
    }

    const normalizedEmail = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error(t('settings.toastEnterNewEmail'))
      return
    }

    setIsLoading(true)
    try {
      const { error } = await backend.auth.updateUser(
        { email: normalizedEmail },
        { emailRedirectTo: getRedirectUrl() }
      )
      if (error) throw error
      toast.success(t('settings.toastConfirmationSent'))
      setNewEmail('')
      setShowChangeEmail(false)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!isBackendConfigured()) {
      toast.error(t('settings.backendNotConfigured'))
      return
    }

    if (!currentPassword) {
      toast.error(t('settings.toastEnterCurrentPassword'))
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('settings.toastPasswordsDoNotMatch'))
      return
    }

    const passwordError = validateNewPassword(newPassword)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    setIsLoading(true)
    try {
      const { error: signInError } = await backend.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      
      if (signInError) {
        toast.error(t('settings.toastCurrentPasswordIncorrect'))
        setIsLoading(false)
        return
      }

      const { error } = await backend.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      })
      if (error) throw error
      toast.success(t('settings.toastPasswordChanged'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowChangePassword(false)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setSettingsOpen(false)
    toast.success(t('settings.toastLoggedOut'))
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error(t('settings.toastTypeDeleteToConfirm'))
      return
    }

    setIsDeletingAccount(true)
    try {
      await deleteUserAccount()
      await clearLocalData()
      localStorage.removeItem('quicknotes-remember')
      localStorage.removeItem('quicknotes-storage')
      localStorage.removeItem('quicknotes-ui-settings')
      localStorage.removeItem('quicknotes-theme')
      setUser(null)
      toast.success(t('settings.toastAccountDeleted'))
      setSettingsOpen(false)
      window.location.reload()
    } catch (error) {
      toast.error(t('settings.toastAccountDeleteFailed'))
    } finally {
      setIsDeletingAccount(false)
      setDeleteConfirmText('')
      setShowDeleteAccount(false)
    }
  }

  const handleExportData = () => {
    const data = {
      notes,
      folders,
      tags,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quicknotes-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(t('settings.toastDataExported'))
  }

  const handleClearData = async () => {
    await clearLocalData()
    localStorage.removeItem('quicknotes-storage')
    useNotesStore.setState({
      notes: [],
      folders: [],
      tags: [],
      selectedNoteId: null,
      selectedFolderId: null,
      selectedTagFilter: null,
      searchQuery: '',
      lastSyncTime: null,
    })
    toast.success(t('settings.toastLocalDataDeleted'))
    window.location.reload()
  }

  if (!settingsOpen) return null

  return (
    <LegacyDialog label="Settings" onClose={() => setSettingsOpen(false)} align="center">
      <div className="bg-surface-raised rounded-2xl shadow-2xl border border-subtle w-full max-w-3xl mx-4 h-[80vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between px-6 py-5 qn-banner-surface">
          <div className="text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />
              {t('settings.title')}
            </h2>
            <p className="text-white/80 text-sm mt-0.5">
              {t('settings.customizeWorkspace')}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('common.close', 'Close settings')}
            onClick={() => setSettingsOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
        <div className="w-48 p-4 border-r border-subtle bg-surface-sunken ">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${
 activeTab === tab.id
 ? 'bg-surface-raised text-emerald-700 dark:text-emerald-300 shadow-sm font-medium'
                    : 'text-content-muted hover:bg-white/80 dark:hover:bg-surface-raised'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-emerald-500 dark:text-emerald-400' : 'text-content-subtle'}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between px-6 py-3 border-b border-subtle bg-surface-sunken dark:bg-surface-raised">
            <h3 className="text-[10px] font-bold text-content-muted uppercase tracking-[0.12em]">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.appearance')}
                  </h4>
                  <div className="flex gap-3">
                    {[
                      { id: 'light', label: t('settings.light'), icon: Sun },
                      { id: 'dark', label: t('settings.dark'), icon: Moon },
                      { id: 'system', label: t('settings.system'), icon: Monitor },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setTheme(option.id)}
                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
 theme === option.id
 ? 'border-primary-500 bg-primary-50 dark:bg-accent-soft text-primary-700 dark:text-primary-100 ring-1 ring-[rgba(16,185,129,0.10)] dark:ring-[rgba(16,185,129,0.20)]'
                            : 'border-subtle hover:border-subtle dark:hover:border-subtle'
                        }`}
                      >
                        <option.icon className={`w-6 h-6 ${theme === option.id ? 'text-primary-600 dark:text-primary-300' : 'text-content-muted'}`} />
                        <span className="text-sm text-content">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.language')}
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
 language === lang.code
 ? 'border-primary-500 bg-primary-50 dark:bg-accent-soft text-primary-700 dark:text-primary-100 ring-1 ring-[rgba(16,185,129,0.10)] dark:ring-[rgba(16,185,129,0.20)]'
                            : 'border-subtle hover:border-subtle dark:hover:border-subtle'
                        }`}
                        dir={lang.dir}
                      >
                        <img 
                          src={`https://flagcdn.com/w40/${lang.countryCode.toLowerCase()}.png`}
                          srcSet={`https://flagcdn.com/w80/${lang.countryCode.toLowerCase()}.png 2x`}
                          alt={lang.name}
                          className="w-8 h-6 object-cover rounded shadow-sm"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'block'
                          }}
                        />
                        <span className="hidden text-lg font-bold text-content-muted">{lang.countryCode}</span>
                        <span className="text-xs font-medium text-content dark:text-content-subtle">{lang.nativeName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.viewMode')}
                  </h4>
                  <p className="mb-3 text-xs text-content-muted">
                    {t('settings.viewModeDesc')}
                  </p>
                  <div className="flex gap-3">
                    {[
                      { id: 'list', label: t('settings.viewList'), icon: List, description: t('settings.viewListDesc') },
                      { id: 'grid', label: t('settings.viewGrid'), icon: LayoutGrid, description: t('settings.viewGridDesc') },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setViewMode(option.id)}
                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
 viewMode === option.id
 ? 'border-primary-500 bg-primary-50 dark:bg-accent-soft text-primary-700 dark:text-primary-100 ring-1 ring-[rgba(16,185,129,0.10)] dark:ring-[rgba(16,185,129,0.20)]'
                            : 'border-subtle hover:border-subtle dark:hover:border-subtle'
                        }`}
                      >
                        <option.icon className={`w-6 h-6 ${viewMode === option.id ? 'text-primary-600 dark:text-primary-300' : 'text-content-muted'}`} />
                        <span className="text-sm font-medium text-content">{option.label}</span>
                        <span className="text-xs text-center text-content-muted">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.editorPreferences')}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-content-muted" />
                        <div>
                          <p className="text-sm font-medium text-content">
                            {t('settings.confirmBeforeDelete')}
                          </p>
                          <p className="text-xs text-content-muted">
                            {t('settings.confirmBeforeDeleteDesc')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={confirmBeforeDelete}
                        aria-label={t('settings.confirmBeforeDelete')}
                        onClick={() => setConfirmBeforeDelete(!confirmBeforeDelete)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
 confirmBeforeDelete ? 'bg-primary-600' : 'bg-surface-active dark:bg-surface-active'
 }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-surface-sunken rounded-full shadow transition-transform ${
 confirmBeforeDelete ? 'translate-x-5' : 'translate-x-0'
 }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                      <div className="flex items-center gap-3">
                        <SpellCheck className="w-4 h-4 text-content-muted" />
                        <div>
                          <p className="text-sm font-medium text-content">
                            {t('settings.spellCheck')}
                          </p>
                          <p className="text-xs text-content-muted">
                            {t('settings.spellCheckDesc')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={spellCheck}
                        aria-label={t('settings.spellCheck')}
                        onClick={() => setSpellCheck(!spellCheck)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
 spellCheck ? 'bg-primary-600' : 'bg-surface-active dark:bg-surface-active'
 }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-surface-sunken rounded-full shadow transition-transform ${
 spellCheck ? 'translate-x-5' : 'translate-x-0'
 }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-4 h-4 text-content-muted" />
                        <div>
                          <p className="text-sm font-medium text-content">
                            {t('settings.showNoteStatistics')}
                          </p>
                          <p className="text-xs text-content-muted">
                            {t('settings.showNoteStatisticsDesc')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showNoteStatistics}
                        aria-label={t('settings.showNoteStatistics')}
                        onClick={() => setShowNoteStatistics(!showNoteStatistics)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
 showNoteStatistics ? 'bg-primary-600' : 'bg-surface-active dark:bg-surface-active'
 }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-surface-sunken rounded-full shadow transition-transform ${
 showNoteStatistics ? 'translate-x-5' : 'translate-x-0'
 }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Note list display — read by NoteCard and RichTextEditor. */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.noteListDisplay', 'Note list display')}
                  </h4>
                  <div className="space-y-4 rounded-card border border-subtle bg-surface-sunken p-4">
                    <Field
                      label={t('settings.notePreviewLines')}
                      hint={t('settings.notePreviewLinesDesc')}
                    >
                      {({ id, ...a11y }) => (
                        <SegmentedControl
                          {...a11y}
                          label={t('settings.notePreviewLines')}
                          value={String(notePreviewLines)}
                          onChange={(value) => setNotePreviewLines(Number(value))}
                          options={[
                            { value: '0', label: t('settings.previewNone', 'None') },
                            { value: '1', label: '1' },
                            { value: '2', label: '2' },
                            { value: '3', label: '3' },
                          ]}
                        />
                      )}
                    </Field>

                    <Field label={t('settings.dateFormat')} hint={t('settings.dateFormatDesc')}>
                      {() => (
                        <SegmentedControl
                          label={t('settings.dateFormat')}
                          value={dateFormat}
                          onChange={setDateFormat}
                          options={[
                            { value: 'relative', label: t('settings.dateFormatRelative') },
                            { value: 'absolute', label: t('settings.dateFormatAbsolute') },
                          ]}
                        />
                      )}
                    </Field>

                    <Toggle
                      checked={compactMode}
                      onChange={setCompactMode}
                      label={t('settings.compactMode')}
                      description={t('settings.compactModeDesc')}
                    />

                    <Field label={t('settings.autoSaveDelay')} hint={t('settings.autoSaveDelayDesc')}>
                      {() => (
                        <SegmentedControl
                          label={t('settings.autoSaveDelay')}
                          value={String(autoSaveDelay)}
                          onChange={(value) => setAutoSaveDelay(Number(value))}
                          options={[
                            { value: '150', label: '0.15s' },
                            { value: '300', label: '0.3s' },
                            { value: '800', label: '0.8s' },
                            { value: '1500', label: '1.5s' },
                          ]}
                        />
                      )}
                    </Field>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.defaultSortOrder')}
                  </h4>
                  <p className="mb-3 text-xs text-content-muted">
                    {t('settings.defaultSortOrderDesc')}
                  </p>
                  <select
                    aria-label={t('settings.defaultSortOrder')}
                    value={currentSort}
                    onChange={(e) => setCurrentSort(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-subtle bg-surface-raised text-content focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="manual">{t('sort.manual')}</option>
                    <option value="updated-desc">{t('sort.lastModified')}</option>
                    <option value="updated-asc">{t('sort.oldestModified')}</option>
                    <option value="created-desc">{t('sort.recentlyCreated')}</option>
                    <option value="created-asc">{t('sort.oldestFirst')}</option>
                    <option value="title-asc">{t('sort.titleAZ')}</option>
                    <option value="title-desc">{t('sort.titleZA')}</option>
                    <option value="size-desc">{t('sort.sizeDesc')}</option>
                    <option value="size-asc">{t('sort.sizeAsc')}</option>
                  </select>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.trashRetention')}
                  </h4>
                  <p className="mb-3 text-xs text-content-muted">
                    {t('settings.trashRetentionDesc')}
                  </p>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-content-muted" />
                    <select
                      aria-label={t('settings.trashRetention')}
                      value={trashRetentionDays}
                      onChange={(e) => setTrashRetentionDays(Number(e.target.value))}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-subtle bg-surface-raised text-content focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value={7}>7 {t('settings.days')}</option>
                      <option value={14}>14 {t('settings.days')}</option>
                      <option value={30}>30 {t('settings.days')}</option>
                      <option value={60}>60 {t('settings.days')}</option>
                      <option value={90}>90 {t('settings.days')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {user?.isLocal ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-surface-raised dark:text-emerald-300">
                        <HardDrive className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-semibold text-content">My workspace</p>
                        <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-200">
                          Saved privately on this device
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-subtle p-4 ">
                      <h4 className="text-sm font-semibold text-content">
                        Local-first mode
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-content-muted">
                        This workspace does not use an account or a paid plan. Notes remain in this
                        browser and all editing and organization features are available offline.
                      </p>
                      {!cloudEnabled && (
                        <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2.5 text-xs leading-5 text-content-muted dark:bg-surface-sunken dark:text-content-subtle">
                          Multi-device sync and collaboration become available when a self-hosted
                          Supabase backend is configured.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-content transition-colors hover:bg-surface-sunken dark:text-content-subtle dark:hover:bg-surface-sunken"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Close workspace
                    </button>
                  </div>
                ) : user ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-sunken">
                      <Avatar user={user} size="xl" />
                      <div className="flex-1">
                        <p className="font-medium text-content">
                          {user.email}
                        </p>
                        <p className="text-sm text-content-muted">
                          {t('settings.memberSince')}{' '}
                          {new Date(user.created_at).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 border border-subtle rounded-lg ">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-content-muted" />
                        <h4 className="text-sm font-medium text-content">{t('settings.profilePictureUrl')}</h4>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          defaultValue={user.user_metadata?.avatar_url || ''}
                          placeholder="https://example.com/your-image.jpg"
                          className="flex-1 px-4 py-2 text-sm text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                          id="avatar-url-input"
                        />
                        <button
                          onClick={async () => {
                            const input = document.getElementById('avatar-url-input')
                            const url = input.value.trim()
                            
                            if (url && !url.startsWith('http')) {
                              toast.error(t('settings.toastInvalidUrl'))
                              return
                            }
                            
                            setIsLoading(true)
                            try {
                              const { error } = await backend.auth.updateUser({
                                data: { avatar_url: url || null }
                              })
                              
                              if (error) throw error
                              
                              const { data } = await backend.auth.getUser()
                              if (data?.user) {
                                setUser(data.user)
                              }
                              
                              toast.success(url ? t('settings.toastProfilePictureUpdated') : t('settings.toastProfilePictureRemoved'))
                            } catch (error) {
                              toast.error(t('settings.toastProfilePictureFailed'))
                            } finally {
                              setIsLoading(false)
                            }
                          }}
                          disabled={isLoading}
                          className="px-4 py-2 text-sm text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                          {isLoading ? t('settings.saving') : t('common.save')}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-content-muted">
                        {t('settings.profilePictureHint')}
                      </p>
                    </div>
                    <div className="p-4 border border-subtle rounded-lg ">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-content-muted" />
                          <h4 className="text-sm font-medium text-content">{t('settings.changeEmail')}</h4>
                        </div>
                        <button
                          onClick={() => setShowChangeEmail(!showChangeEmail)}
                          className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-accent-soft rounded-lg transition-colors"
                        >
                          {showChangeEmail ? t('common.cancel') : t('settings.change')}
                        </button>
                      </div>
                      {showChangeEmail && (
                        <form onSubmit={handleChangeEmail} className="mt-4 space-y-3">
                          <div className="relative">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              className="w-full px-4 py-2 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                              placeholder={t('settings.newEmailAddress')}
                            />
                          </div>
                          <div className="flex justify-start">
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="px-4 py-2 text-sm text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                            >
                              {isLoading ? t('settings.sending') : t('settings.sendConfirmation')}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    <div className="p-4 border border-subtle rounded-lg ">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-content-muted" />
                          <h4 className="text-sm font-medium text-content">{t('settings.changePassword')}</h4>
                        </div>
                        <button
                          onClick={() => setShowChangePassword(!showChangePassword)}
                          className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-accent-soft rounded-lg transition-colors"
                        >
                          {showChangePassword ? t('common.cancel') : t('settings.change')}
                        </button>
                      </div>
                      {showChangePassword && (
                        <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                          <div className="relative">
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full px-4 py-2 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                              placeholder={t('settings.currentPassword')}
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full px-4 py-2 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                              placeholder={t('settings.newPassword')}
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-4 py-2 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                              placeholder={t('settings.confirmNewPassword')}
                            />
                          </div>
                          <div className="flex justify-start">
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="px-4 py-2 text-sm text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                            >
                              {isLoading ? t('settings.updating') : t('settings.updatePassword')}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 transition-colors rounded-lg dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('settings.logOut')}
                    </button>

                    {/* Delete Account */}
                    <div className="pt-4 mt-4 space-y-3 border-t border-subtle">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <h4 className="text-sm font-medium text-red-600 dark:text-red-400">
                            {t('settings.deleteAccount')}
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            setShowDeleteAccount(!showDeleteAccount)
                            setDeleteConfirmText('')
                          }}
                          className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          {showDeleteAccount ? t('common.cancel') : t('settings.deleteAccountButton')}
                        </button>
                      </div>
                      <p className="text-xs text-content-muted">
                        {t('settings.deleteAccountDesc')}
                      </p>
                      {showDeleteAccount && (
                        <div className="p-4 space-y-4 border-2 border-red-300 rounded-lg dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                                {t('settings.deleteAccountConfirmTitle')}
                              </p>
                              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                {t('settings.deleteAccountConfirmMessage')}
                              </p>
                            </div>
                          </div>
                          <div>
                            <label className="block mb-2 text-xs font-medium text-red-700 dark:text-red-300">
                              {t('settings.deleteAccountTypeConfirm')}
                            </label>
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              className="w-full px-3 py-2 text-sm border-2 border-red-300 rounded-lg dark:border-red-700 bg-surface-raised text-content focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                              placeholder="DELETE"
                              autoComplete="off"
                              spellCheck={false}
                            />
                          </div>
                          <button
                            onClick={handleDeleteAccount}
                            disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            {isDeletingAccount ? t('settings.deleteAccountDeleting') : t('settings.deleteAccountButton')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <p className="text-sm text-content-muted">
                      {t('settings.signInDesc')}
                      {!isBackendConfigured() && (
                        <span className="flex items-center gap-2 mt-2 text-yellow-600 dark:text-yellow-400">
                          <AlertTriangle className="flex-shrink-0 w-4 h-4" />
                          {t('settings.backendNotConfigured')}
                        </span>
                      )}
                    </p>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-content-muted">
                        {t('settings.email')}
                      </label>
                      <div className="relative">
                        <Mail className="absolute w-4 h-4 text-content-subtle -translate-y-1/2 left-3 top-1/2" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full py-2 pl-10 pr-4 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-content-muted">
                        {t('settings.password')}
                      </label>
                      <div className="relative">
                        <Lock className="absolute w-4 h-4 text-content-subtle -translate-y-1/2 left-3 top-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full py-2 pl-10 pr-10 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute text-content-subtle -translate-y-1/2 right-3 top-1/2 hover:text-content-muted"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {isLoading ? t('settings.loading') : t('settings.signIn')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSignUp}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 text-content transition-colors border border-subtle rounded-lg hover:bg-surface-hover disabled:opacity-50"
                      >
                        {t('settings.register')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {activeTab === 'sync' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-sunken">
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-primary-500" />
                    <div>
                      <p className="font-medium text-content">
                        {t('settings.cloudSync')}
                      </p>
                      <p className="text-sm text-content-muted">
                        {user
                          ? t('settings.connectedToBackend')
                          : t('settings.notLoggedIn')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={syncWithBackend}
                    disabled={!user}
                    className="px-4 py-2 text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('settings.syncNow')}
                  </button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.syncSettings', 'Sync Settings')}
                  </h4>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.autoSync', 'Auto Sync')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.autoSyncDesc', 'Automatically sync changes in the background')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoSync}
                      aria-label={t('settings.autoSync', 'Automatic sync')}
                      onClick={() => setAutoSync(!autoSync)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
 autoSync ? 'bg-primary-600' : 'bg-surface-active dark:bg-surface-active'
 }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-surface-sunken rounded-full shadow transition-transform ${
 autoSync ? 'translate-x-5' : 'translate-x-0'
 }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.syncInterval', 'Sync Interval')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.syncIntervalDesc', 'How often to sync automatically')}
                      </p>
                    </div>
                    <select
                      aria-label={t('settings.syncInterval', 'Sync interval')}
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      disabled={!autoSync}
                      className="px-3 py-1.5 text-sm border border-subtle rounded-lg bg-white dark:bg-surface-sunken text-content disabled:opacity-50"
                    >
                      <option value={1}>1 {t('settings.minute', 'minute')}</option>
                      <option value={5}>5 {t('settings.minutes', 'minutes')}</option>
                      <option value={10}>10 {t('settings.minutes', 'minutes')}</option>
                      <option value={15}>15 {t('settings.minutes', 'minutes')}</option>
                      <option value={30}>30 {t('settings.minutes', 'minutes')}</option>
                      <option value={60}>1 {t('settings.hour', 'hour')}</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.syncOnStartup', 'Sync on Startup')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.syncOnStartupDesc', 'Sync when app starts')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={syncOnStartup}
                      aria-label={t('settings.syncOnStartup', 'Sync on startup')}
                      onClick={() => setSyncOnStartup(!syncOnStartup)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
 syncOnStartup ? 'bg-primary-600' : 'bg-surface-active dark:bg-surface-active'
 }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-surface-sunken rounded-full shadow transition-transform ${
 syncOnStartup ? 'translate-x-5' : 'translate-x-0'
 }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.syncNotifications', 'Sync Notifications')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.syncNotificationsDesc', 'Show notifications after sync')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showSyncNotifications}
                      aria-label={t('settings.showSyncNotifications', 'Show sync notifications')}
                      onClick={() => setShowSyncNotifications(!showSyncNotifications)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
 showSyncNotifications ? 'bg-primary-600' : 'bg-surface-active dark:bg-surface-active'
 }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-surface-sunken rounded-full shadow transition-transform ${
 showSyncNotifications ? 'translate-x-5' : 'translate-x-0'
 }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.statistics')}
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 text-center rounded-lg bg-surface-sunken border border-subtle">
                      <p className="text-2xl font-bold text-content">
                        {notes.length}
                      </p>
                      <p className="text-sm text-content-muted">
                        {t('settings.notesCount')}
                      </p>
                    </div>
                    <div className="p-4 text-center rounded-lg bg-surface-sunken border border-subtle">
                      <p className="text-2xl font-bold text-content">
                        {folders.length}
                      </p>
                      <p className="text-sm text-content-muted">
                        {t('settings.foldersCount')}
                      </p>
                    </div>
                    <div className="p-4 text-center rounded-lg bg-surface-sunken border border-subtle">
                      <p className="text-2xl font-bold text-content">
                        {tags.length}
                      </p>
                      <p className="text-sm text-content-muted">
                        {t('settings.tagsCount')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.exportData')}
                  </h4>
                  <p className="text-sm text-content-muted">
                    {t('settings.exportDataDesc')}
                  </p>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-4 py-2 text-content transition-colors bg-surface-sunken rounded-lg dark:bg-surface-sunken hover:bg-surface-sunken dark:hover:bg-surface-active border border-subtle "
                  >
                    <Download className="w-4 h-4 text-content-muted" />
                    {t('settings.exportDataButton')}
                  </button>
                </div>

                <div className="pt-6 space-y-3 border-t border-subtle">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.importData')}
                  </h4>
                  <p className="text-sm text-content-muted">
                    {t('settings.importDataDesc')}
                  </p>
                  <button
                    onClick={() => { setSettingsOpen(false); setImportModalOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2 text-content transition-colors bg-surface-sunken rounded-lg dark:bg-surface-sunken hover:bg-surface-sunken dark:hover:bg-surface-active border border-subtle "
                  >
                    <Upload className="w-4 h-4 text-content-muted" />
                    {t('settings.importDataButton')}
                  </button>
                </div>

                <div className="pt-6 space-y-3 border-t border-subtle">
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400">
                    {t('settings.dangerZone')}
                  </h4>
                  <p className="text-sm text-content-muted">
                    {t('settings.deleteAllDataDesc')}
                  </p>
                  <button
                    onClick={() => setConfirmClearData(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 transition-colors bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 border border-red-300 dark:border-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('settings.deleteAllData')}
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <p className="mb-4 text-sm text-content-muted">
                  {t('settings.shortcutsDescription')}
                </p>
                <div className="space-y-2">
                  {[
                    { keys: ['Ctrl', 'N'], action: t('settings.shortcutOpenQuickNote') },
                    { keys: ['Ctrl', 'S'], action: t('settings.shortcutSaveNote') },
                    { keys: ['Ctrl', 'F'], action: t('settings.shortcutFocusSearch') },
                    { keys: ['Ctrl', 'B'], action: t('settings.shortcutBoldText') },
                    { keys: ['Ctrl', 'I'], action: t('settings.shortcutItalicText') },
                    { keys: ['Ctrl', 'K'], action: t('settings.shortcutInsertLink') },
                    { keys: ['Ctrl', 'Z'], action: t('settings.shortcutUndo') },
                    { keys: ['Ctrl', 'Shift', 'Z'], action: t('settings.shortcutRedo') },
                    { keys: ['Esc'], action: t('settings.shortcutCloseModal') },
                  ].map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-subtle dark:border-subtle"
                    >
                      <span className="text-sm text-content">
                        {shortcut.action}
                      </span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, j) => (
                          <kbd key={j} className="kbd">
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 dark:bg-accent-soft">
                    <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-content">QuickNotes</h3>
                    <p className="text-sm text-content-muted">{t('settings.version')} 2.0.2</p>
                  </div>
                  <p className="text-center text-sm text-content-muted max-w-sm">
                    {t('settings.aboutDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <a
                    href="https://github.com/Berenyiansen/QuickNotes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-sunken hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <Github className="w-5 h-5 text-content-muted" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-content">GitHub</p>
                      <p className="text-xs text-content-muted">{t('settings.aboutGithubDesc')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-content-subtle" />
                  </a>

                  <button
                    onClick={() => { setSettingsOpen(false); useUIStore.getState().setPrivacyModalOpen(true) }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-sunken hover:bg-surface-hover transition-colors cursor-pointer w-full text-left"
                  >
                    <Shield className="w-5 h-5 text-content-muted" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-content">{t('settings.aboutPrivacy')}</p>
                      <p className="text-xs text-content-muted">{t('settings.aboutPrivacyDesc')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-content-subtle" />
                  </button>

                  <button
                    onClick={() => { setSettingsOpen(false); useUIStore.getState().setTermsModalOpen(true) }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-sunken hover:bg-surface-hover transition-colors cursor-pointer w-full text-left"
                  >
                    <FileText className="w-5 h-5 text-content-muted" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-content">{t('settings.aboutTerms')}</p>
                      <p className="text-xs text-content-muted">{t('settings.aboutTermsDesc')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-content-subtle" />
                  </button>
                </div>

                <div className="pt-4 border-t border-subtle">
                  <div className="flex items-center gap-2 text-sm text-content-muted">
                    <Github className="w-4 h-4" />
                    <span>{t('settings.aboutOpenSource')}</span>
                  </div>
                  <p className="mt-2 text-xs text-content-subtle">
                    {t('settings.aboutLicense')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        <ConfirmDialog
          open={confirmClearData}
          onClose={() => setConfirmClearData(false)}
          onConfirm={handleClearData}
          title={t('settings.deleteAllData')}
          description={t('settings.toastDeleteAllConfirm')}
          confirmLabel={t('settings.deleteAllData')}
        />
      </div>
    </LegacyDialog>
  )
}
