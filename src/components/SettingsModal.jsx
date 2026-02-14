import React, { useState } from 'react'
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
  AlertTriangle,
  List,
  LayoutGrid,
  Settings
} from 'lucide-react'
import { useUIStore, useNotesStore, useThemeStore } from '../store'
import { backend, isBackendConfigured, getRedirectUrl } from '../lib/backend'
import { clearLocalData } from '../lib/db'
import { useTranslation, LANGUAGES } from '../lib/useTranslation'
import toast from 'react-hot-toast'

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
  } = useUIStore()
  const { notes, folders, tags, user, setUser, syncWithBackend } = useNotesStore()
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

  const tabs = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'account', label: 'Account', icon: User },
    { id: 'sync', label: 'Sync', icon: Cloud },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  ]

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!isBackendConfigured()) {
      toast.error('Backend is not configured. Please check .env file.')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await backend.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      setUser(data.user)
      toast.success('Successfully logged in!')
      syncWithBackend()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!isBackendConfigured()) {
      toast.error('Backend is not configured. Please check .env file.')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await backend.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getRedirectUrl()
        }
      })

      if (error) throw error

      toast.success('Registration successful! Please confirm your email.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeEmail = async (e) => {
    e.preventDefault()
    if (!isBackendConfigured()) {
      toast.error('Backend is not configured. Please check .env file.')
      return
    }

    if (!newEmail) {
      toast.error('Please enter a new email address')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await backend.auth.updateUser({ email: newEmail })
      if (error) throw error
      toast.success('Confirmation email sent to your new address!')
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
      toast.error('Backend is not configured. Please check .env file.')
      return
    }

    if (!currentPassword) {
      toast.error('Please enter your current password')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      const { error: signInError } = await backend.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      
      if (signInError) {
        toast.error('Current password is incorrect')
        setIsLoading(false)
        return
      }

      const { error } = await backend.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password changed successfully!')
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
    if (!isBackendConfigured()) {
      setUser(null)
      return
    }

    await backend.auth.signOut()
    setUser(null)
    toast.success('Logged out')
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

    toast.success('Data exported!')
  }

  const handleClearData = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete all local data? This action cannot be undone.'
      )
    ) {
      await clearLocalData()
      toast.success('Local data deleted')
      window.location.reload()
    }
  }

  if (!settingsOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-3xl mx-4 h-[80vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Settings
            </h2>
            <p className="text-white/80 text-sm mt-0.5">
              Customize your workspace
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
        <div className="w-48 p-4 border-r border-[#cbd1db] bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white/80 dark:hover:bg-gray-800/50'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#cbd1db] dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h4 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
                    Appearance
                  </h4>
                  <div className="flex gap-3">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setTheme(option.id)}
                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                          theme === option.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/60 text-primary-700 dark:text-primary-100 ring-1 ring-primary-500/10 dark:ring-primary-500/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <option.icon className={`w-6 h-6 ${theme === option.id ? 'text-primary-600 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'}`} />
                        <span className="text-sm text-gray-900 dark:text-white">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
                    {t('settings.language')}
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                          language === lang.code
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/70 text-primary-700 dark:text-primary-100 ring-1 ring-primary-500/10 dark:ring-primary-500/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
                        <span className="hidden text-lg font-bold text-gray-600 dark:text-gray-400">{lang.countryCode}</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-200">{lang.nativeName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
                    View Mode
                  </h4>
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Choose how notes are displayed in the main area
                  </p>
                  <div className="flex gap-3">
                    {[
                      { id: 'list', label: 'List', icon: List, description: 'Notes list with editor side-by-side' },
                      { id: 'grid', label: 'Grid', icon: LayoutGrid, description: 'Grid of note cards, full-width editor' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setViewMode(option.id)}
                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                          viewMode === option.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/60 text-primary-700 dark:text-primary-100 ring-1 ring-primary-500/10 dark:ring-primary-500/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <option.icon className={`w-6 h-6 ${viewMode === option.id ? 'text-primary-600 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
                        <span className="text-xs text-center text-gray-500 dark:text-gray-400">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {user ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center justify-center w-16 h-16 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900">
                        {user.user_metadata?.avatar_url ? (
                          <img 
                            src={user.user_metadata.avatar_url} 
                            alt="Profile" 
                            className="object-cover w-full h-full"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'block'
                            }}
                          />
                        ) : null}
                        <User className={`w-8 h-8 text-primary-600 dark:text-primary-400 ${user.user_metadata?.avatar_url ? 'hidden' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.email}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Member since{' '}
                          {new Date(user.created_at).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Profile Picture URL</h4>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          defaultValue={user.user_metadata?.avatar_url || ''}
                          placeholder="https://example.com/your-image.jpg"
                          className="flex-1 px-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          id="avatar-url-input"
                        />
                        <button
                          onClick={async () => {
                            const input = document.getElementById('avatar-url-input')
                            const url = input.value.trim()
                            
                            if (url && !url.startsWith('http')) {
                              toast.error('Please enter a valid URL starting with http:// or https://')
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
                              
                              toast.success(url ? 'Profile picture updated!' : 'Profile picture removed!')
                            } catch (error) {
                              toast.error('Failed to update profile picture')
                            } finally {
                              setIsLoading(false)
                            }
                          }}
                          disabled={isLoading}
                          className="px-4 py-2 text-sm text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                          {isLoading ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Enter a URL to an image (JPG, PNG, GIF). Leave empty to remove.
                      </p>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Change Email</h4>
                        </div>
                        <button
                          onClick={() => setShowChangeEmail(!showChangeEmail)}
                          className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                        >
                          {showChangeEmail ? 'Cancel' : 'Change'}
                        </button>
                      </div>
                      {showChangeEmail && (
                        <form onSubmit={handleChangeEmail} className="mt-4 space-y-3">
                          <div className="relative">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              className="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              placeholder="New email address"
                            />
                          </div>
                          <div className="flex justify-start">
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="px-4 py-2 text-sm text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                            >
                              {isLoading ? 'Sending...' : 'Send Confirmation'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Change Password</h4>
                        </div>
                        <button
                          onClick={() => setShowChangePassword(!showChangePassword)}
                          className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                        >
                          {showChangePassword ? 'Cancel' : 'Change'}
                        </button>
                      </div>
                      {showChangePassword && (
                        <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                          <div className="relative">
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              placeholder="Current password"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              placeholder="New password"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              placeholder="Confirm new password"
                            />
                          </div>
                          <div className="flex justify-start">
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="px-4 py-2 text-sm text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                            >
                              {isLoading ? 'Updating...' : 'Update Password'}
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
                      Log out
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sign in to sync your notes across devices.
                      {!isBackendConfigured() && (
                        <span className="flex items-center gap-2 mt-2 text-yellow-600 dark:text-yellow-400">
                          <AlertTriangle className="flex-shrink-0 w-4 h-4" />
                          Backend is not configured. Add your
                          Backend credentials to .env file.
                        </span>
                      )}
                    </p>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full py-2 pl-10 pr-4 text-gray-900 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full py-2 pl-10 pr-10 text-gray-900 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
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
                        {isLoading ? 'Loading...' : 'Sign in'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSignUp}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-200 transition-colors border border-gray-300 rounded-lg dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        Register
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {activeTab === 'sync' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-primary-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Cloud Sync
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user
                          ? 'Connected to backend'
                          : 'Not logged in'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={syncWithBackend}
                    disabled={!user}
                    className="px-4 py-2 text-white transition-colors rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sync now
                  </button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('settings.syncSettings') || 'Sync Settings'}
                  </h4>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('settings.autoSync') || 'Auto Sync'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('settings.autoSyncDesc') || 'Automatically sync changes in the background'}
                      </p>
                    </div>
                    <button
                      onClick={() => setAutoSync(!autoSync)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        autoSync ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow transition-transform ${
                          autoSync ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('settings.syncInterval') || 'Sync Interval'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('settings.syncIntervalDesc') || 'How often to sync automatically'}
                      </p>
                    </div>
                    <select
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      disabled={!autoSync}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    >
                      <option value={1}>1 {t('settings.minute') || 'minute'}</option>
                      <option value={5}>5 {t('settings.minutes') || 'minutes'}</option>
                      <option value={10}>10 {t('settings.minutes') || 'minutes'}</option>
                      <option value={15}>15 {t('settings.minutes') || 'minutes'}</option>
                      <option value={30}>30 {t('settings.minutes') || 'minutes'}</option>
                      <option value={60}>1 {t('settings.hour') || 'hour'}</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('settings.syncOnStartup') || 'Sync on Startup'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('settings.syncOnStartupDesc') || 'Sync when app starts'}
                      </p>
                    </div>
                    <button
                      onClick={() => setSyncOnStartup(!syncOnStartup)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        syncOnStartup ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow transition-transform ${
                          syncOnStartup ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('settings.syncNotifications') || 'Sync Notifications'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('settings.syncNotificationsDesc') || 'Show notifications after sync'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSyncNotifications(!showSyncNotifications)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        showSyncNotifications ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow transition-transform ${
                          showSyncNotifications ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Statistics
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 text-center rounded-lg bg-gray-50 dark:bg-gray-900">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {notes.length}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Notes
                      </p>
                    </div>
                    <div className="p-4 text-center rounded-lg bg-gray-50 dark:bg-gray-900">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {folders.length}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Folders
                      </p>
                    </div>
                    <div className="p-4 text-center rounded-lg bg-gray-50 dark:bg-gray-900">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {tags.length}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tags
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Export Data
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Export all your notes, folders, and tags as a JSON file.
                  </p>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-200 transition-colors bg-gray-100 rounded-lg dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    Export data
                  </button>
                </div>

                <div className="pt-6 space-y-3 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400">
                    Danger Zone
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Delete all local data. This action cannot be undone.
                  </p>
                  <button
                    onClick={handleClearData}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 transition-colors bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete all data
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  Use these keyboard shortcuts for faster workflow.
                </p>
                <div className="space-y-2">
                  {[
                    { keys: ['Ctrl', 'N'], action: 'Open Quick Note' },
                    { keys: ['Ctrl', 'S'], action: 'Save note' },
                    { keys: ['Ctrl', 'F'], action: 'Focus search' },
                    { keys: ['Ctrl', 'B'], action: 'Bold text' },
                    { keys: ['Ctrl', 'I'], action: 'Italic text' },
                    { keys: ['Ctrl', 'K'], action: 'Insert link' },
                    { keys: ['Ctrl', 'Z'], action: 'Undo' },
                    { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' },
                    { keys: ['Esc'], action: 'Close modal' },
                  ].map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-200">
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
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
