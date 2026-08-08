import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Field, Input, LanguageFlag, SegmentedControl, Switch, Toggle } from './ui'
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
import {
  backend,
  deleteUserAccount,
  getMyUsername,
  getRedirectUrl,
  isBackendConfigured,
  updateMyUsername,
} from '../lib/backend'
import { getAuthErrorMessage, validateNewPassword } from '../lib/authValidation'
import { setLocalWorkspaceName } from '../lib/localSession'
import { createWorkspaceBackup } from '../lib/workspaceBackup'
import { normalizeWebUrl } from '../lib/webUrls'
import { normalizeUsername, validateUsername } from '../lib/usernames'
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
    setShortcutsModalOpen,
  } = useUIStore()
  const {
    notes,
    folders,
    tags,
    user,
    cacheOwnerId,
    setUser,
    activateCloudUser,
    deactivateWorkspace,
    deleteWorkspace,
    setSelectedNote,
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
  const [workspaceName, setWorkspaceName] = useState(() => user?.isLocal ? user?.username || '' : '')
  const [username, setUsername] = useState(() => user?.username || '')
  const [savingWorkspaceName, setSavingWorkspaceName] = useState(false)
  const [savingUsername, setSavingUsername] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [confirmClearData, setConfirmClearData] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const avatarUrlRef = useRef(null)

  const cloudEnabled = isBackendConfigured()

  useEffect(() => {
    if (!settingsOpen || !cloudEnabled || !user || user.isLocal) return
    let active = true

    getMyUsername()
      .then((value) => {
        if (active) {
          setUsername(value)
          if (value && user?.username !== value) setUser({ ...user, username: value })
        }
      })
      .catch((error) => {
        if (active) toast.error(error?.message || 'Username could not be loaded')
      })

    return () => {
      active = false
    }
  }, [cloudEnabled, setUser, settingsOpen, user])

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

      const activated = await activateCloudUser(data.user)
      if (!activated) throw new Error('Your cloud workspace could not be opened on this device.')
      toast.success(t('settings.toastLoginSuccess'))
      await syncWithBackend()
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveWorkspaceName = async () => {
    const name = workspaceName.trim()
    if (!name) {
      toast.error('Enter a workspace name')
      return
    }
    if (name.length > 60) {
      toast.error(t('settings.nameTooLong', 'Use 60 characters or fewer'))
      return
    }
    setSavingWorkspaceName(true)
    try {
      setLocalWorkspaceName(name)
      setUser({ ...user, username: name })
      toast.success('Workspace name updated')
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setSavingWorkspaceName(false)
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
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      const signedOut = await logout()
      if (signedOut) {
        setSettingsOpen(false)
        toast.success(t('settings.toastLoggedOut'))
      }
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleSaveUsername = async () => {
    const requestedUsername = normalizeUsername(username)
    const usernameError = validateUsername(requestedUsername)
    if (usernameError) {
      toast.error(usernameError)
      return
    }

    setSavingUsername(true)
    try {
      const savedUsername = await updateMyUsername(requestedUsername)
      setUsername(savedUsername)
      setUser({ ...user, username: savedUsername })
      toast.success('Username updated')
    } catch (error) {
      toast.error(error?.message || 'Username could not be updated')
    } finally {
      setSavingUsername(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error(t('settings.toastTypeDeleteToConfirm'))
      return
    }

    setIsDeletingAccount(true)
    let accountDeleted = false
    try {
      const ownerId = cacheOwnerId || user?.id
      await deleteUserAccount()
      accountDeleted = true
      const localDataDeleted = ownerId
        ? await deleteWorkspace(ownerId, { deactivate: true })
        : await deactivateWorkspace({ persistWorkspace: false })
      if (!localDataDeleted) throw new Error('The browser copy of this workspace could not be deleted.')
      localStorage.removeItem('quicknotes-remember')
      toast.success(t('settings.toastAccountDeleted'))
      setSettingsOpen(false)
    } catch {
      if (accountDeleted) {
        await deactivateWorkspace({ persistWorkspace: false })
        toast.error('Your account was deleted, but its browser data could not be cleared. Clear this site\'s data before using a shared device.')
      } else {
        toast.error(t('settings.toastAccountDeleteFailed'))
      }
    } finally {
      setIsDeletingAccount(false)
      setDeleteConfirmText('')
      setShowDeleteAccount(false)
    }
  }

  const handleExportData = () => {
    try {
      const backup = createWorkspaceBackup({ notes, folders, tags })
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `quicknotes-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(t('settings.toastDataExported'))
    } catch {
      toast.error('The workspace backup could not be created.')
    }
  }

  const handleClearData = async () => {
    const ownerId = cacheOwnerId || (user?.isLocal ? 'local' : user?.id)
    try {
      const deleted = await deleteWorkspace(ownerId)
      if (!deleted) throw new Error('No active workspace was found.')
      setConfirmClearData(false)
      toast.success(t('settings.toastLocalDataDeleted'))
    } catch {
      toast.error('The workspace data could not be deleted from this browser.')
    }
  }

  if (!settingsOpen) return null

  return (
    <LegacyDialog label="Settings" onClose={() => setSettingsOpen(false)} align="center">
      <div className="flex h-[calc(100dvh-1.5rem)] max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-subtle bg-surface-raised shadow-2xl modal-animate sm:mx-4 sm:h-[80dvh] sm:rounded-2xl">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 qn-banner-surface">
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
            aria-label={`${t('common.close', 'Close')} ${t('settings.title', 'settings')}`}
            onClick={() => setSettingsOpen(false)}
            className="qn-square-control rounded-full p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
        <div className="shrink-0 border-b border-subtle bg-surface-sunken p-2 sm:w-48 sm:border-b-0 sm:border-r sm:p-4">
          <nav aria-label="Settings sections" className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain sm:block sm:space-y-1 sm:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`qn-touch-target flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs transition-colors sm:w-full sm:min-w-0 sm:justify-start sm:gap-3 sm:px-3 sm:text-[13px] ${
 activeTab === tab.id
 ? 'bg-accent text-accent-on shadow-md ring-1 ring-[var(--qn-accent-hover)] font-semibold'
                    : 'text-content-muted hover:bg-white/80 dark:hover:bg-surface-raised'
                }`}
              >
                <tab.icon className={`h-4 w-4 shrink-0 ${activeTab === tab.id ? 'text-accent-on' : 'text-content-subtle'}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div data-settings-content className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-subtle bg-surface-sunken px-4 py-3 dark:bg-surface-raised sm:px-6">
            <h3 className="text-[10px] font-bold text-content-muted uppercase tracking-[0.12em]">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
          </div>
          <div data-settings-pane tabIndex="0" aria-label="Settings options" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)] sm:p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.appearance')}
                  </h4>
                  <div role="group" aria-label={t('settings.appearance')} className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { id: 'light', label: t('settings.light'), icon: Sun },
                      { id: 'dark', label: t('settings.dark'), icon: Moon },
                      { id: 'system', label: t('settings.system'), icon: Monitor },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={theme === option.id}
                        onClick={() => setTheme(option.id)}
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors sm:p-4 ${
 theme === option.id
 ? 'border-accent bg-accent-soft text-accent-text ring-1 ring-[rgba(16,185,129,0.10)] dark:ring-[rgba(16,185,129,0.20)]'
                            : 'border-subtle hover:border-subtle dark:hover:border-subtle'
                        }`}
                      >
                        <option.icon aria-hidden="true" className={`w-6 h-6 ${theme === option.id ? 'text-accent-text dark:text-accent-text' : 'text-content-muted'}`} />
                        <span className="text-sm text-content">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.language')}
                  </h4>
                  <div role="group" aria-label={t('settings.language')} className="grid grid-cols-3 gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        aria-pressed={language === lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
 language === lang.code
 ? 'border-accent bg-accent-soft text-accent-text ring-1 ring-[rgba(16,185,129,0.10)] dark:ring-[rgba(16,185,129,0.20)]'
                            : 'border-subtle hover:border-subtle dark:hover:border-subtle'
                        }`}
                        dir={lang.dir}
                      >
                        <LanguageFlag code={lang.code} className="h-6 w-8" />
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
                  <div role="group" aria-label={t('settings.viewMode')} className="grid gap-3 min-[360px]:grid-cols-2">
                    {[
                      { id: 'list', label: t('settings.viewList'), icon: List, description: t('settings.viewListDesc') },
                      { id: 'grid', label: t('settings.viewGrid'), icon: LayoutGrid, description: t('settings.viewGridDesc') },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={viewMode === option.id}
                        onClick={() => {
                          if (option.id === 'grid') setSelectedNote(null)
                          setViewMode(option.id)
                        }}
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
 viewMode === option.id
 ? 'border-accent bg-accent-soft text-accent-text ring-1 ring-[rgba(16,185,129,0.10)] dark:ring-[rgba(16,185,129,0.20)]'
                            : 'border-subtle hover:border-subtle dark:hover:border-subtle'
                        }`}
                      >
                        <option.icon aria-hidden="true" className={`w-6 h-6 ${viewMode === option.id ? 'text-accent-text dark:text-accent-text' : 'text-content-muted'}`} />
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
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-raised p-3 shadow-xs">
                      <div className="flex min-w-0 items-center gap-3">
                        <Shield className="h-4 w-4 shrink-0 text-content-muted" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-content">
                            {t('settings.confirmBeforeDelete')}
                          </p>
                          <p className="text-xs text-content-muted">
                            {t('settings.confirmBeforeDeleteDesc')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={confirmBeforeDelete}
                        label={t('settings.confirmBeforeDelete')}
                        onChange={setConfirmBeforeDelete}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-raised p-3 shadow-xs">
                      <div className="flex min-w-0 items-center gap-3">
                        <SpellCheck className="h-4 w-4 shrink-0 text-content-muted" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-content">
                            {t('settings.spellCheck')}
                          </p>
                          <p className="text-xs text-content-muted">
                            {t('settings.spellCheckDesc')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={spellCheck}
                        label={t('settings.spellCheck')}
                        onChange={setSpellCheck}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-raised p-3 shadow-xs">
                      <div className="flex min-w-0 items-center gap-3">
                        <BarChart3 className="h-4 w-4 shrink-0 text-content-muted" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-content">
                            {t('settings.showNoteStatistics')}
                          </p>
                          <p className="text-xs text-content-muted">
                            {t('settings.showNoteStatisticsDesc')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={showNoteStatistics}
                        label={t('settings.showNoteStatistics')}
                        onChange={setShowNoteStatistics}
                      />
                    </div>
                  </div>
                </div>

                {/* Note list display — read by NoteCard and RichTextEditor. */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-content">
                    {t('settings.noteListDisplay', 'Note list display')}
                  </h4>
                  <div className="space-y-4 rounded-card border border-subtle bg-surface-raised p-4 shadow-xs">
                    <Field
                      label={t('settings.notePreviewLines')}
                      hint={t('settings.notePreviewLinesDesc')}
                    >
                      {(a11y) => (
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-subtle bg-surface-raised text-content focus:ring-2 focus:ring-accent focus:border-accent"
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
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-subtle bg-surface-raised text-content focus:ring-2 focus:ring-accent focus:border-accent"
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
                        <p className="font-semibold text-content">
                          {user?.username || 'My workspace'}
                        </p>
                        <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-200">
                          Saved privately on this device
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-subtle p-4">
                      <h4 className="mb-1 text-sm font-semibold text-content">
                        Workspace name
                      </h4>
                      <p className="mb-3 text-xs text-content-muted">
                        Shown in the sidebar for this local browser workspace.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={workspaceName}
                          maxLength={60}
                          onChange={(e) => setWorkspaceName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveWorkspaceName() }}
                          placeholder="My workspace"
                          aria-label="Workspace name"
                          className="flex-1"
                        />
                        <Button variant="primary" onClick={handleSaveWorkspaceName} loading={savingWorkspaceName}>
                          {t('common.save')}
                        </Button>
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
                      disabled={isSigningOut}
                      aria-busy={isSigningOut || undefined}
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-content">
                          @{username || user.username || 'Account'}
                        </p>
                        <p className="truncate text-sm text-content-muted">{user.email}</p>
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
                          ref={avatarUrlRef}
                          aria-label={t('settings.profilePictureUrl')}
                          aria-describedby="qn-avatar-url-hint"
                          type="url"
                          defaultValue={user.user_metadata?.avatar_url || ''}
                          placeholder="https://example.com/your-image.jpg"
                          className="flex-1 px-4 py-2 text-sm text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                          id="avatar-url-input"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const rawUrl = avatarUrlRef.current?.value.trim() || ''
                            const normalized = rawUrl
                              ? normalizeWebUrl(rawUrl)
                              : { value: '', error: '' }

                            if (normalized.error) {
                              toast.error(normalized.error)
                              return
                            }

                            const url = normalized.value
                            
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
                            } catch {
                              toast.error(t('settings.toastProfilePictureFailed'))
                            } finally {
                              setIsLoading(false)
                            }
                          }}
                          disabled={isLoading}
                          className="px-4 py-2 text-sm text-accent-on transition-colors rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50"
                        >
                          {isLoading ? t('settings.saving') : t('common.save')}
                        </button>
                      </div>
                      <p id="qn-avatar-url-hint" className="mt-2 text-xs text-content-muted">
                        {t('settings.profilePictureHint')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-subtle bg-surface-raised p-4 shadow-xs">
                      <h4 className="mb-1 text-sm font-medium text-content">
                        Username
                      </h4>
                      <p className="mb-3 text-xs text-content-muted">
                        Your only public identity in QuickNotes. This exact username appears in the sidebar, invitations, and shared notes.
                      </p>
                      <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-content-muted" aria-hidden="true">
                            @
                          </span>
                          <Input
                            type="text"
                            value={username}
                            minLength={3}
                            maxLength={32}
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            onChange={(event) => setUsername(event.target.value)}
                            onKeyDown={(event) => { if (event.key === 'Enter') handleSaveUsername() }}
                            placeholder="username"
                            aria-label="Username"
                            className="pl-8"
                          />
                        </div>
                        <Button variant="primary" onClick={handleSaveUsername} loading={savingUsername}>
                          {t('common.save')}
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 border border-subtle rounded-lg ">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-content-muted" />
                          <h4 className="text-sm font-medium text-content">{t('settings.changeEmail')}</h4>
                        </div>
                        <button
                          type="button"
                          aria-expanded={showChangeEmail}
                          aria-controls="qn-change-email-form"
                          onClick={() => setShowChangeEmail(!showChangeEmail)}
                          className="px-3 py-1.5 text-sm text-accent-text dark:text-accent-text hover:bg-accent-soft dark:hover:bg-accent-soft rounded-lg transition-colors"
                        >
                          {showChangeEmail ? t('common.cancel') : t('settings.change')}
                        </button>
                      </div>
                      {showChangeEmail && (
                        <form id="qn-change-email-form" onSubmit={handleChangeEmail} className="mt-4 space-y-3">
                          <Field label={t('settings.newEmailAddress')} htmlFor="qn-new-email">
                            <Input
                              id="qn-new-email"
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder={t('settings.newEmailAddress')}
                              autoComplete="email"
                              required
                            />
                          </Field>
                          <div className="flex justify-start">
                            <Button type="submit" variant="primary" loading={isLoading}>
                              {t('settings.sendConfirmation')}
                            </Button>
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
                          type="button"
                          aria-expanded={showChangePassword}
                          aria-controls="qn-change-password-form"
                          onClick={() => setShowChangePassword(!showChangePassword)}
                          className="px-3 py-1.5 text-sm text-accent-text dark:text-accent-text hover:bg-accent-soft dark:hover:bg-accent-soft rounded-lg transition-colors"
                        >
                          {showChangePassword ? t('common.cancel') : t('settings.change')}
                        </button>
                      </div>
                      {showChangePassword && (
                        <form id="qn-change-password-form" onSubmit={handleChangePassword} className="mt-4 space-y-3">
                          <Field label={t('settings.currentPassword')} htmlFor="qn-current-password">
                            <Input
                              id="qn-current-password"
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder={t('settings.currentPassword')}
                              autoComplete="current-password"
                              required
                            />
                          </Field>
                          <Field label={t('settings.newPassword')} htmlFor="qn-new-password">
                            <Input
                              id="qn-new-password"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder={t('settings.newPassword')}
                              autoComplete="new-password"
                              required
                            />
                          </Field>
                          <Field label={t('settings.confirmNewPassword')} htmlFor="qn-confirm-password">
                            <Input
                              id="qn-confirm-password"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder={t('settings.confirmNewPassword')}
                              autoComplete="new-password"
                              required
                            />
                          </Field>
                          <div className="flex justify-start">
                            <Button type="submit" variant="primary" loading={isLoading}>
                              {t('settings.updatePassword')}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isSigningOut}
                      aria-busy={isSigningOut || undefined}
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
                          type="button"
                          aria-expanded={showDeleteAccount}
                          aria-controls="qn-delete-account-confirmation"
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
                        <div id="qn-delete-account-confirmation" className="p-4 space-y-4 border-2 border-red-300 rounded-lg dark:border-red-800 bg-red-50 dark:bg-red-900/20">
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
                            <label htmlFor="qn-delete-account-text" className="block mb-2 text-xs font-medium text-red-700 dark:text-red-300">
                              {t('settings.deleteAccountTypeConfirm')}
                            </label>
                            <input
                              id="qn-delete-account-text"
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
                            type="button"
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
                      <label htmlFor="qn-settings-email" className="block mb-1 text-sm font-medium text-content-muted">
                        {t('settings.email')}
                      </label>
                      <div className="relative">
                        <Mail className="absolute w-4 h-4 text-content-subtle -translate-y-1/2 left-3 top-1/2" />
                        <input
                          id="qn-settings-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full py-2 pl-10 pr-4 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                          placeholder="your@email.com"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="qn-settings-password" className="block mb-1 text-sm font-medium text-content-muted">
                        {t('settings.password')}
                      </label>
                      <div className="relative">
                        <Lock className="absolute w-4 h-4 text-content-subtle -translate-y-1/2 left-3 top-1/2" />
                        <input
                          id="qn-settings-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full py-2 pl-10 pr-10 text-content bg-white border border-subtle rounded-lg dark:bg-surface-sunken dark:text-white"
                          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
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

                    <div>
                      <Button type="submit" variant="primary" loading={isLoading} fullWidth>
                        {t('settings.signIn')}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {activeTab === 'sync' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface-raised p-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-accent-text" />
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
                  <Button variant="primary" onClick={syncWithBackend} disabled={!user}>
                    {t('settings.syncNow')}
                  </Button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.syncSettings', 'Sync Settings')}
                  </h4>
                  <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface-raised p-3 shadow-xs">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.autoSync', 'Auto Sync')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.autoSyncDesc', 'Automatically sync changes in the background')}
                      </p>
                    </div>
                    <Switch
                      checked={autoSync}
                      label={t('settings.autoSync', 'Automatic sync')}
                      onChange={setAutoSync}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface-raised p-3 shadow-xs">
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
                  <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface-raised p-3 shadow-xs">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.syncOnStartup', 'Sync on Startup')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.syncOnStartupDesc', 'Sync when app starts')}
                      </p>
                    </div>
                    <Switch
                      checked={syncOnStartup}
                      label={t('settings.syncOnStartup', 'Sync on startup')}
                      onChange={setSyncOnStartup}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface-raised p-3 shadow-xs">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.syncNotifications', 'Sync Notifications')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.syncNotificationsDesc', 'Show notifications after sync')}
                      </p>
                    </div>
                    <Switch
                      checked={showSyncNotifications}
                      label={t('settings.showSyncNotifications', 'Show sync notifications')}
                      onChange={setShowSyncNotifications}
                    />
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
                <div className="rounded-card border border-subtle bg-surface-raised p-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <Keyboard className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-content">
                        {t('sidebar.keyboardShortcuts', 'Keyboard shortcuts')}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-content-muted">
                        View the shortcuts that actually apply to this device, and customise workspace actions in one place.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => {
                      setSettingsOpen(false)
                      setShortcutsModalOpen(true)
                    }}
                  >
                    Manage keyboard shortcuts
                  </Button>
                </div>
              </div>
            )}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-soft">
                    <FileText className="w-8 h-8 text-accent-text dark:text-accent-text" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-content">QuickNotes</h3>
                    <p className="text-sm text-content-muted">{t('settings.version')} 2.1.0</p>
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
