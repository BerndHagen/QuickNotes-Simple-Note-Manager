import { useEffect, useRef, useState } from 'react'
import { Avatar, BrandLogo, Button, DialogHeader, Field, Input, LanguageFlag, SegmentedControl, Select, Switch, Toggle } from './ui'
import {
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
  ScanText,
  Clock,
  HardDrive
} from 'lucide-react'
import { useUIStore, useNotesStore, useThemeStore } from '../store'
import { getWorkspaceNoteVersionBackupData } from '../lib/db'
import {
  backend,
  deleteUserAccount,
  getMyUsername,
  getRemoteWorkspaceNoteVersions,
  getRedirectUrl,
  isBackendConfigured,
  updateMyUsername,
} from '../lib/backend'
import { getAuthErrorMessage, validateNewPassword } from '../lib/authValidation'
import { setLocalWorkspaceName } from '../lib/localSession'
import {
  createWorkspaceArchive,
  mergeWorkspaceNoteVersionsForBackup,
  WORKSPACE_ARCHIVE_EXTENSION,
} from '../lib/workspaceBackup'
import { getSpatialBackupData } from '../lib/spatial/repository'
import { getAnnotationBackupData } from '../lib/spatial/annotations'
import { getWorkspaceResourceArchiveData } from '../lib/resources/repository'
import { auditLocalDataIntegrity } from '../lib/resources/integrity'
import {
  getIntelligenceSettings,
  getRecognizedContentBackupData,
  saveIntelligenceSettings,
} from '../lib/intelligence/repository'
import { normalizeWebUrl } from '../lib/webUrls'
import { normalizeUsername, validateUsername } from '../lib/usernames'
import {
  formatStorageBytes,
  getBrowserStorageHealth,
  requestBrowserStoragePersistence,
} from '../lib/storageHealth'
import { APP_VERSION } from '../lib/appVersion'
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
    savedViews,
    noteTemplates,
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
  const [intelligenceSettings, setIntelligenceSettings] = useState(null)
  const [intelligenceSettingsError, setIntelligenceSettingsError] = useState(null)
  const [savingIntelligenceSettings, setSavingIntelligenceSettings] = useState(false)
  const [storageHealth, setStorageHealth] = useState(null)
  const [storageHealthError, setStorageHealthError] = useState('')
  const [requestingPersistence, setRequestingPersistence] = useState(false)
  const [integrityReport, setIntegrityReport] = useState(null)
  const [integrityError, setIntegrityError] = useState('')
  const [checkingIntegrity, setCheckingIntegrity] = useState(false)
  const avatarUrlRef = useRef(null)

  const cloudEnabled = isBackendConfigured()
  const intelligenceOwnerId = cacheOwnerId || (user?.isLocal ? 'local' : user?.id)

  useEffect(() => {
    if (!settingsOpen || !intelligenceOwnerId) return undefined
    let active = true
    setIntelligenceSettingsError(null)
    getIntelligenceSettings(intelligenceOwnerId)
      .then((value) => {
        if (active) setIntelligenceSettings(value)
      })
      .catch((error) => {
        if (active) {
          setIntelligenceSettings(null)
          setIntelligenceSettingsError(error?.message || 'Recognition privacy settings could not be loaded.')
        }
      })
    return () => { active = false }
  }, [intelligenceOwnerId, settingsOpen])

  useEffect(() => {
    if (!settingsOpen || activeTab !== 'data' || !intelligenceOwnerId) return undefined
    let active = true
    setStorageHealthError('')
    setIntegrityError('')
    setCheckingIntegrity(true)
    getBrowserStorageHealth()
      .then((health) => {
        if (active) setStorageHealth(health)
      })
      .catch((error) => {
        if (active) setStorageHealthError(error?.message || 'Storage information is unavailable.')
      })
    auditLocalDataIntegrity(intelligenceOwnerId)
      .then((report) => {
        if (active) setIntegrityReport(report)
      })
      .catch((error) => {
        if (active) setIntegrityError(error?.message || 'Local data integrity could not be checked.')
      })
      .finally(() => {
        if (active) setCheckingIntegrity(false)
      })
    return () => {
      active = false
    }
  }, [activeTab, intelligenceOwnerId, settingsOpen])

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
    { id: 'recognition', label: 'Recognition', icon: ScanText },
    { id: 'data', label: t('settings.data'), icon: Database },
    { id: 'shortcuts', label: t('settings.shortcuts'), icon: Keyboard },
    { id: 'about', label: t('settings.aboutTab'), icon: Info },
  ]

  const handleIntelligenceSettingsChange = async (patch) => {
    if (!intelligenceOwnerId || !intelligenceSettings || savingIntelligenceSettings) return
    setSavingIntelligenceSettings(true)
    setIntelligenceSettingsError(null)
    try {
      const saved = await saveIntelligenceSettings({
        ...intelligenceSettings,
        ...patch,
        // External content transfer always requires confirmation at the point of use.
        confirmExternalEveryTime: true,
      }, intelligenceOwnerId)
      setIntelligenceSettings(saved)
      toast.success('Recognition privacy setting saved')
    } catch (error) {
      const message = error?.message || 'Recognition privacy settings could not be saved.'
      setIntelligenceSettingsError(message)
      toast.error(message)
    } finally {
      setSavingIntelligenceSettings(false)
    }
  }

  const handleRequestStoragePersistence = async () => {
    setRequestingPersistence(true)
    setStorageHealthError('')
    try {
      const granted = await requestBrowserStoragePersistence()
      setStorageHealth(await getBrowserStorageHealth())
      if (!granted) {
        setStorageHealthError('The browser did not grant protected storage. Keep regular workspace backups.')
      }
    } catch (error) {
      setStorageHealthError(error?.message || 'Protected storage could not be requested.')
    } finally {
      setRequestingPersistence(false)
    }
  }

  const handleIntegrityCheck = async () => {
    if (!intelligenceOwnerId || checkingIntegrity) return
    setCheckingIntegrity(true)
    setIntegrityError('')
    try {
      setIntegrityReport(await auditLocalDataIntegrity(intelligenceOwnerId))
    } catch (error) {
      setIntegrityError(error?.message || 'Local data integrity could not be checked.')
    } finally {
      setCheckingIntegrity(false)
    }
  }

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

  const handleExportData = async () => {
    try {
      const noteIds = notes.map((note) => note.id)
      const remoteHistory = cloudEnabled && user?.id && !user?.isLocal
        ? getRemoteWorkspaceNoteVersions(noteIds).catch(() => {
            throw new Error('The complete cloud version history could not be loaded. Reconnect and try the backup again; no partial archive was downloaded.')
          })
        : Promise.resolve([])
      const [spatial, annotations, resources, recognizedContent, localNoteVersions, remoteNoteVersions] = await Promise.all([
        getSpatialBackupData(noteIds),
        getAnnotationBackupData(noteIds),
        getWorkspaceResourceArchiveData(noteIds),
        getRecognizedContentBackupData(noteIds),
        getWorkspaceNoteVersionBackupData(noteIds),
        remoteHistory,
      ])
      const noteVersions = mergeWorkspaceNoteVersionsForBackup(localNoteVersions, remoteNoteVersions)
      const blob = await createWorkspaceArchive({
        notes,
        noteVersions,
        folders,
        tags,
        savedViews,
        noteTemplates,
        ...spatial,
        ...annotations,
        ...resources,
        recognizedContent,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `quicknotes-backup-${new Date().toISOString().split('T')[0]}.${WORKSPACE_ARCHIVE_EXTENSION}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(t('settings.toastDataExported'))
    } catch (error) {
      toast.error(error?.message || 'The workspace backup could not be created.')
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
      <div className="qn-settings-shell flex h-[calc(100dvh-1.5rem)] max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-dialog border border-subtle bg-surface-raised shadow-dialog modal-animate sm:mx-4 sm:h-[80dvh]">
        <DialogHeader
          title={t('settings.title')}
          description={t('settings.customizeWorkspace')}
          icon={Settings}
          onClose={() => setSettingsOpen(false)}
          closeLabel={`${t('common.close', 'Close')} ${t('settings.title', 'settings')}`}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
        <div className="shrink-0 border-b border-subtle bg-[var(--qn-surface-window-footer)] p-2 sm:w-48 sm:border-b-0 sm:border-r sm:p-4">
          <nav aria-label="Settings sections" className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain sm:block sm:space-y-1 sm:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`qn-touch-target flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-3 py-2 text-xs transition-colors sm:w-full sm:min-w-0 sm:justify-start sm:gap-3 sm:px-3 sm:text-[13px] ${
 activeTab === tab.id
 ? 'bg-accent-soft text-accent-text font-semibold'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content active:bg-surface-active'
                }`}
              >
                <tab.icon className={`h-4 w-4 shrink-0 ${activeTab === tab.id ? 'text-accent-text' : 'text-content-subtle'}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div data-settings-content className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-subtle bg-[var(--qn-surface-window-footer)] px-4 py-3 sm:px-6">
            <h3 className="text-[10px] font-bold text-content-muted uppercase tracking-[0.12em]">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
          </div>
          <div data-settings-pane tabIndex="0" aria-label="Settings options" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)] sm:p-6">
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
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-control border p-3 transition-colors sm:p-4 ${
 theme === option.id
 ? 'border-accent bg-accent-soft text-accent-text'
                            : 'border-subtle bg-surface-raised hover:border-strong hover:bg-surface-hover active:bg-surface-active'
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
                        className={`flex flex-col items-center gap-1 p-3 rounded-control border transition-colors ${
 language === lang.code
 ? 'border-accent bg-accent-soft text-accent-text'
                            : 'border-subtle bg-surface-raised hover:border-strong hover:bg-surface-hover active:bg-surface-active'
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
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-control border p-4 transition-colors ${
 viewMode === option.id
 ? 'border-accent bg-accent-soft text-accent-text'
                            : 'border-subtle bg-surface-raised hover:border-strong hover:bg-surface-hover active:bg-surface-active'
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
                  <div className="divide-y divide-[var(--qn-border-subtle)] border-y border-subtle">
                    <div className="flex items-center justify-between gap-3 py-3">
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
                    <div className="flex items-center justify-between gap-3 py-3">
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
                    <div className="flex items-center justify-between gap-3 py-3">
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
                  <div className="space-y-4 border-y border-subtle py-4">
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
                  <Select
                    aria-label={t('settings.defaultSortOrder')}
                    value={currentSort}
                    onChange={(e) => setCurrentSort(e.target.value)}
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
                  </Select>
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
                    <Select
                      aria-label={t('settings.trashRetention')}
                      value={trashRetentionDays}
                      onChange={(e) => setTrashRetentionDays(Number(e.target.value))}
                      className="flex-1"
                    >
                      <option value={7}>7 {t('settings.days')}</option>
                      <option value={14}>14 {t('settings.days')}</option>
                      <option value={30}>30 {t('settings.days')}</option>
                      <option value={60}>60 {t('settings.days')}</option>
                      <option value={90}>90 {t('settings.days')}</option>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {user?.isLocal ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 border-y border-subtle py-4">
                      <HardDrive className="h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-content">
                          {user?.username || 'My workspace'}
                        </p>
                        <p className="mt-0.5 text-sm text-accent-text">
                          Saved privately on this device
                        </p>
                      </div>
                    </div>

                    <div className="border-b border-subtle pb-5">
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

                    <div className="border-b border-subtle pb-5">
                      <h4 className="text-sm font-semibold text-content">
                        Local-first mode
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-content-muted">
                        This workspace does not use an account or a paid plan. Notes remain in this
                        browser and all editing and organization features are available offline.
                      </p>
                      {!cloudEnabled && (
                        <p className="mt-3 border-l-2 border-accent px-3 py-1.5 text-xs leading-5 text-content-muted">
                          Multi-device sync and collaboration become available when a self-hosted
                          Supabase backend is configured.
                        </p>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      icon={LogOut}
                      onClick={handleLogout}
                      disabled={isSigningOut}
                      aria-busy={isSigningOut || undefined}
                    >
                      Close workspace
                    </Button>
                  </div>
                ) : user ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 border-y border-subtle py-4">
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
                    <div className="border-b border-subtle pb-5">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-content-muted" />
                        <h4 className="text-sm font-medium text-content">{t('settings.profilePictureUrl')}</h4>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          ref={avatarUrlRef}
                          aria-label={t('settings.profilePictureUrl')}
                          aria-describedby="qn-avatar-url-hint"
                          type="url"
                          defaultValue={user.user_metadata?.avatar_url || ''}
                          placeholder="https://example.com/your-image.jpg"
                          className="flex-1"
                          id="avatar-url-input"
                        />
                        <Button
                          variant="primary"
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
                        >
                          {isLoading ? t('settings.saving') : t('common.save')}
                        </Button>
                      </div>
                      <p id="qn-avatar-url-hint" className="mt-2 text-xs text-content-muted">
                        {t('settings.profilePictureHint')}
                      </p>
                    </div>
                    <div className="border-b border-subtle pb-5">
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
                    <div className="border-b border-subtle pb-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-content-muted" />
                          <h4 className="text-sm font-medium text-content">{t('settings.changeEmail')}</h4>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={showChangeEmail}
                          aria-controls="qn-change-email-form"
                          onClick={() => setShowChangeEmail(!showChangeEmail)}
                        >
                          {showChangeEmail ? t('common.cancel') : t('settings.change')}
                        </Button>
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
                    <div className="border-b border-subtle pb-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-content-muted" />
                          <h4 className="text-sm font-medium text-content">{t('settings.changePassword')}</h4>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={showChangePassword}
                          aria-controls="qn-change-password-form"
                          onClick={() => setShowChangePassword(!showChangePassword)}
                        >
                          {showChangePassword ? t('common.cancel') : t('settings.change')}
                        </Button>
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
                    <Button
                      variant="ghost"
                      icon={LogOut}
                      onClick={handleLogout}
                      disabled={isSigningOut}
                      aria-busy={isSigningOut || undefined}
                    >
                      {t('settings.logOut')}
                    </Button>

                    {/* Delete Account */}
                    <div className="pt-4 mt-4 space-y-3 border-t border-subtle">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-danger-text" aria-hidden="true" />
                          <h4 className="text-sm font-medium text-danger-text">
                            {t('settings.deleteAccount')}
                          </h4>
                        </div>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          aria-expanded={showDeleteAccount}
                          aria-controls="qn-delete-account-confirmation"
                          onClick={() => {
                            setShowDeleteAccount(!showDeleteAccount)
                            setDeleteConfirmText('')
                          }}
                        >
                          {showDeleteAccount ? t('common.cancel') : t('settings.deleteAccountButton')}
                        </Button>
                      </div>
                      <p className="text-xs text-content-muted">
                        {t('settings.deleteAccountDesc')}
                      </p>
                      {showDeleteAccount && (
                        <div id="qn-delete-account-confirmation" className="space-y-4 border-l-2 border-danger bg-danger-soft p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-text" aria-hidden="true" />
                            <div>
                              <p className="text-sm font-medium text-danger-text">
                                {t('settings.deleteAccountConfirmTitle')}
                              </p>
                              <p className="mt-1 text-xs text-content-muted">
                                {t('settings.deleteAccountConfirmMessage')}
                              </p>
                            </div>
                          </div>
                          <div>
                            <label htmlFor="qn-delete-account-text" className="mb-2 block text-xs font-medium text-content">
                              {t('settings.deleteAccountTypeConfirm')}
                            </label>
                            <Input
                              id="qn-delete-account-text"
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder="DELETE"
                              autoComplete="off"
                              spellCheck={false}
                            />
                          </div>
                          <Button
                            variant="danger"
                            icon={Trash2}
                            fullWidth
                            onClick={handleDeleteAccount}
                            disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
                          >
                            {isDeletingAccount ? t('settings.deleteAccountDeleting') : t('settings.deleteAccountButton')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <p className="text-sm text-content-muted">
                      {t('settings.signInDesc')}
                      {!isBackendConfigured() && (
                        <span className="mt-2 flex items-center gap-2 text-warning-text">
                          <AlertTriangle className="flex-shrink-0 w-4 h-4" />
                          {t('settings.backendNotConfigured')}
                        </span>
                      )}
                    </p>

                    <Field label={t('settings.email')} htmlFor="qn-settings-email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
                        <Input
                          id="qn-settings-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          placeholder="your@email.com"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </Field>

                    <Field label={t('settings.password')} htmlFor="qn-settings-password">
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
                        <Input
                          id="qn-settings-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
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
                    </Field>

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
                  <Button
                    variant="primary"
                    onClick={() => syncWithBackend({ notify: true })}
                    disabled={!user}
                  >
                    {t('settings.syncNow')}
                  </Button>
                </div>
                <div className="divide-y divide-[var(--qn-border-subtle)] border-y border-subtle">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.syncSettings', 'Sync Settings')}
                  </h4>
                  <div className="flex items-center justify-between gap-4 py-3">
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
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-content">
                        {t('settings.syncInterval', 'Sync Interval')}
                      </p>
                      <p className="text-xs text-content-muted">
                        {t('settings.syncIntervalDesc', 'How often to sync automatically')}
                      </p>
                    </div>
                    <Select
                      aria-label={t('settings.syncInterval', 'Sync interval')}
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      disabled={!autoSync}
                      className="w-auto min-w-32"
                    >
                      <option value={1}>1 {t('settings.minute', 'minute')}</option>
                      <option value={5}>5 {t('settings.minutes', 'minutes')}</option>
                      <option value={10}>10 {t('settings.minutes', 'minutes')}</option>
                      <option value={15}>15 {t('settings.minutes', 'minutes')}</option>
                      <option value={30}>30 {t('settings.minutes', 'minutes')}</option>
                      <option value={60}>1 {t('settings.hour', 'hour')}</option>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
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
                  <div className="flex items-center justify-between gap-4 py-3">
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
                  <dl className="grid grid-cols-3 divide-x divide-[var(--qn-border-subtle)] border-y border-subtle py-3">
                    <div className="px-3 text-center first:pl-0">
                      <dd className="text-lg font-semibold tabular-nums text-content">
                        {notes.length}
                      </dd>
                      <dt className="text-xs text-content-muted">
                        {t('settings.notesCount')}
                      </dt>
                    </div>
                    <div className="px-3 text-center">
                      <dd className="text-lg font-semibold tabular-nums text-content">
                        {folders.length}
                      </dd>
                      <dt className="text-xs text-content-muted">
                        {t('settings.foldersCount')}
                      </dt>
                    </div>
                    <div className="px-3 text-center last:pr-0">
                      <dd className="text-lg font-semibold tabular-nums text-content">
                        {tags.length}
                      </dd>
                      <dt className="text-xs text-content-muted">
                        {t('settings.tagsCount')}
                      </dt>
                    </div>
                  </dl>
                </div>
              </div>
            )}
            {activeTab === 'recognition' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-content">Recognition and intelligent features</h4>
                  <p className="mt-1 text-sm leading-relaxed text-content-muted">
                    Choose which processing locations QuickNotes may use for handwriting, OCR, PDF text, transcription, and future intelligent tools.
                  </p>
                </div>

                {intelligenceSettingsError && (
                  <div role="alert" className="border-l-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger-text">
                    {intelligenceSettingsError}
                  </div>
                )}

                {!intelligenceSettings && !intelligenceSettingsError ? (
                  <p role="status" className="text-sm text-content-muted">Loading recognition privacy settings…</p>
                ) : intelligenceSettings && (
                  <div className="space-y-5">
                    <div>
                      <SegmentedControl
                        label="Allowed recognition processing"
                        value={intelligenceSettings.mode}
                        onChange={(mode) => handleIntelligenceSettingsChange({ mode })}
                        options={[
                          { value: 'off', label: 'Off' },
                          { value: 'localOnly', label: 'Local only' },
                          { value: 'externalAllowed', label: 'External' },
                        ]}
                      />
                      <p className="mt-2 text-xs leading-relaxed text-content-subtle" aria-live="polite">
                        {intelligenceSettings.mode === 'off' && 'Recognition providers are disabled. Existing recognized text and your source material remain available.'}
                        {intelligenceSettings.mode === 'localOnly' && 'Only processing that stays inside this browser is allowed.'}
                        {intelligenceSettings.mode === 'externalAllowed' && 'External providers may be offered, but each transfer still requires a separate confirmation.'}
                      </p>
                    </div>

                    <div className="border-y border-subtle">
                      <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-subtle py-3 text-sm">
                        <span className="font-medium text-content">Local</span>
                        <span className="text-content-muted">Runs in this browser. Source content is not sent to a recognition service.</span>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-subtle py-3 text-sm">
                        <span className="font-medium text-content">Browser-managed</span>
                        <span className="text-content-muted">The browser or operating system chooses where processing happens. QuickNotes asks before starting.</span>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-sm">
                        <span className="font-medium text-content">External</span>
                        <span className="text-content-muted">Content leaves the device for a configured provider. QuickNotes always shows the source and asks before every transfer.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 border-l-2 border-accent px-3 py-1.5">
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                      <p className="text-sm leading-relaxed text-content-muted">
                        Image OCR and PDF extraction currently use local providers. Changing this setting never uploads existing notes, attachments, ink, or recordings.
                      </p>
                    </div>

                    {savingIntelligenceSettings && (
                      <p role="status" aria-live="polite" className="text-xs text-content-subtle">Saving privacy setting…</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-content">
                    <HardDrive className="h-4 w-4 text-content-muted" aria-hidden="true" />
                    Browser storage
                  </h4>
                  {!storageHealth && !storageHealthError && (
                    <p role="status" className="text-sm text-content-muted">Checking this browser…</p>
                  )}
                  {storageHealth && !storageHealth.supported && (
                    <p className="text-sm text-content-muted">This browser does not expose storage estimates or persistence controls.</p>
                  )}
                  {storageHealth?.supported && (
                    <div className="space-y-2 text-sm text-content-muted">
                      <p>
                        This origin uses {formatStorageBytes(storageHealth.usage)} of an estimated {formatStorageBytes(storageHealth.quota)}.
                      </p>
                      {storageHealth.ratio !== null && storageHealth.ratio >= 0.8 && (
                        <p role="alert" className="flex gap-2 border border-warning-border bg-warning-soft p-2 text-warning-text">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          Browser storage is over 80% full. Export a workspace backup before adding large PDFs, images, or recordings.
                        </p>
                      )}
                      <p>
                        {storageHealth.persisted === true
                          ? 'Protected storage is granted. The browser is less likely to evict local data automatically, but backups are still required.'
                          : 'Protected storage is not granted. The browser may evict local data under storage pressure.'}
                      </p>
                      {storageHealth.persisted !== true && storageHealth.canRequestPersistence && (
                        <Button
                          variant="secondary"
                          icon={Shield}
                          disabled={requestingPersistence}
                          aria-busy={requestingPersistence || undefined}
                          onClick={() => void handleRequestStoragePersistence()}
                        >
                          {requestingPersistence ? 'Requesting…' : 'Protect offline data'}
                        </Button>
                      )}
                    </div>
                  )}
                  {storageHealthError && <p role="alert" className="text-sm text-warning-text">{storageHealthError}</p>}
                </div>

                <div className="border-t border-subtle" />
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-content">
                      <Shield className="h-4 w-4 text-content-muted" aria-hidden="true" />
                      Local data integrity
                    </h4>
                    <Button
                      variant="secondary"
                      disabled={checkingIntegrity}
                      aria-busy={checkingIntegrity || undefined}
                      onClick={() => void handleIntegrityCheck()}
                    >
                      {checkingIntegrity ? 'Checking…' : 'Check again'}
                    </Button>
                  </div>
                  {!integrityReport && checkingIntegrity && <p role="status" className="text-sm text-content-muted">Inspecting attachment and spatial references…</p>}
                  {integrityReport?.issueCount === 0 && (
                    <p role="status" className="text-sm text-content-muted">No broken canonical resource or spatial references were detected in this workspace.</p>
                  )}
                  {integrityReport?.issueCount > 0 && (
                    <div role="alert" className="border border-warning-border bg-warning-soft p-3 text-sm text-warning-text">
                      <p className="font-medium text-content">{integrityReport.issueCount} local data issue{integrityReport.issueCount === 1 ? '' : 's'} detected</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                        {integrityReport.issues.missingResourceMetadata.count > 0 && <li>{integrityReport.issues.missingResourceMetadata.count} attachment reference(s) have missing metadata.</li>}
                        {integrityReport.issues.missingResourcePayloads.count > 0 && <li>{integrityReport.issues.missingResourcePayloads.count} attachment(s) have missing original payloads.</li>}
                        {integrityReport.issues.payloadsWithoutMetadata.count > 0 && <li>{integrityReport.issues.payloadsWithoutMetadata.count} payload(s) have no metadata.</li>}
                        {integrityReport.issues.unreferencedResources.count > 0 && <li>{integrityReport.issues.unreferencedResources.count} resource(s) currently have no live reference.</li>}
                        {integrityReport.issues.referencesToMissingNotes.count > 0 && <li>{integrityReport.issues.referencesToMissingNotes.count} record(s) reference missing notes.</li>}
                        {integrityReport.issues.detachedSpatialRows.count > 0 && <li>{integrityReport.issues.detachedSpatialRows.count} spatial row(s) have a missing parent.</li>}
                        {integrityReport.issues.detachedRecordingChunks.count > 0 && <li>{integrityReport.issues.detachedRecordingChunks.count} recording chunk(s) have no recovery session.</li>}
                      </ul>
                      <p className="mt-2 text-xs">QuickNotes does not automatically delete these records. Export a backup before removing broken references or clearing browser data.</p>
                    </div>
                  )}
                  {integrityError && <p role="alert" className="text-sm text-warning-text">{integrityError}</p>}
                </div>

                <div className="border-t border-subtle" />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.exportData')}
                  </h4>
                  <p className="text-sm text-content-muted">
                    {t('settings.exportDataDesc')}
                  </p>
                  <Button
                    variant="secondary"
                    icon={Download}
                    onClick={handleExportData}
                  >
                    {t('settings.exportDataButton')}
                  </Button>
                </div>

                <div className="pt-6 space-y-3 border-t border-subtle">
                  <h4 className="text-sm font-medium text-content">
                    {t('settings.importData')}
                  </h4>
                  <p className="text-sm text-content-muted">
                    {t('settings.importDataDesc')}
                  </p>
                  <Button
                    variant="secondary"
                    icon={Upload}
                    onClick={() => { setSettingsOpen(false); setImportModalOpen(true) }}
                  >
                    {t('settings.importDataButton')}
                  </Button>
                </div>

                <div className="pt-6 space-y-3 border-t border-subtle">
                  <h4 className="text-sm font-medium text-danger-text">
                    {t('settings.dangerZone')}
                  </h4>
                  <p className="text-sm text-content-muted">
                    {t('settings.deleteAllDataDesc')}
                  </p>
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => setConfirmClearData(true)}
                  >
                    {t('settings.deleteAllData')}
                  </Button>
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
                <div className="border-b border-subtle pb-5">
                  <div className="flex items-center gap-3">
                    <BrandLogo className="h-10 w-10" />
                    <div>
                      <h3 className="text-lg font-semibold text-content">QuickNotes</h3>
                      <p className="text-sm text-content-muted">{t('settings.version')} {APP_VERSION}</p>
                    </div>
                  </div>
                  <p className="mt-2 max-w-lg text-sm text-content-muted">
                    {t('settings.aboutDescription')}
                  </p>
                </div>

                <div className="divide-y divide-[var(--qn-border-subtle)] border-y border-subtle">
                  <a
                    href="https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-1 py-3 transition-colors hover:bg-surface-hover active:bg-surface-active"
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
                    className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-surface-hover active:bg-surface-active"
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
                    className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-surface-hover active:bg-surface-active"
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
