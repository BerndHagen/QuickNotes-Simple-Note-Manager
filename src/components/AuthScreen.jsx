import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderOpen,
  HardDrive,
  History,
  LayoutGrid,
  Lock,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  WifiOff,
} from 'lucide-react'
import { backend, getRedirectUrl, isBackendConfigured } from '../lib/backend'
import {
  getAuthErrorMessage,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from '../lib/authValidation'
import { createLocalUser, startLocalSession } from '../lib/localSession'
import { NotepadGlyph } from './ui'
import { useNotesStore, useUIStore } from '../store'
import HelpModal from './HelpModal'
import PrivacyModal from './PrivacyModal'
import TermsModal from './TermsModal'

const FEATURE_POINTS = [
  {
    icon: HardDrive,
    title: 'Local-first by design',
    description: 'Write instantly. Your notes remain available even when the network is not.',
  },
  {
    icon: LayoutGrid,
    title: 'Built for real work',
    description: 'Rich documents, tasks, tables, folders, tags, templates, and focused note types.',
  },
  {
    icon: ShieldCheck,
    title: 'Open and self-hostable',
    description: 'No artificial limits, upgrade prompts, or locked productivity features.',
  },
]

function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex shrink-0 items-center justify-center rounded-[12px] border border-white/15 bg-[linear-gradient(140deg,#0e5341,#05352a)] text-white shadow-lg shadow-emerald-950/20 ${
 compact ? 'h-10 w-10' : 'h-11 w-11'
 }`}
      >
        <NotepadGlyph className={compact ? 'h-[22px] w-[22px]' : 'h-6 w-6'} />
      </span>
      <span>
        <span
          className={`block font-bold tracking-[-0.02em] ${
 compact ? 'text-title-md text-content' : 'text-[20px] leading-6 text-white'
 }`}
        >
          QuickNotes
        </span>
        {!compact && (
          <span className="block text-ui-sm font-medium text-white/55">A calmer writing workspace</span>
        )}
      </span>
    </div>
  )
}

function WorkspacePreview() {
  const tasks = [
    'Shape the launch story and release notes',
    'Review the final interaction details',
    'Prepare the open-source release checklist',
  ]

  return (
    <div
      className="qn-auth-preview relative mt-8 w-full overflow-hidden rounded-[22px] border border-white/15 bg-white/95 p-2 shadow-2xl shadow-emerald-950/35"
      aria-hidden="true"
    >
      <div className="flex h-8 items-center gap-1.5 px-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b65]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f4bf4f]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#62c554]" />
        <span className="ml-auto flex items-center gap-1 text-[9px] font-semibold text-slate-400">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Saved locally
        </span>
      </div>

      <div className="flex h-[318px] overflow-hidden rounded-[15px] border border-slate-200 bg-white">
        {/* Mirrors the real rail: same material class, same brand mark. */}
        <div className="qn-nav-surface flex w-[132px] shrink-0 flex-col px-2.5 py-3 text-white">
          <div className="mb-4 flex items-center gap-2 px-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-white/10 bg-[linear-gradient(140deg,#0e5341,#05352a)]">
              <NotepadGlyph className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold">QuickNotes</span>
          </div>
          <div className="mb-3 flex h-7 items-center gap-2 rounded-[7px] bg-emerald-500/90 px-2 text-[9px] font-bold">
            <span className="text-sm leading-none">+</span>
            Quick note
          </div>
          {[
            ['All notes', '12'],
            ['Favorites', '4'],
            ['Archive', ''],
          ].map(([label, count], index) => (
            <div
              key={label}
              className={`mb-0.5 flex h-6 items-center gap-1.5 rounded-[6px] px-1.5 text-[8px] ${
 index === 0 ? 'bg-white/10 text-white' : 'text-white/55'
 }`}
            >
              {index === 0 ? <FolderOpen className="h-3 w-3" /> : <History className="h-3 w-3" />}
              <span className="flex-1">{label}</span>
              {count && <span className="rounded bg-white/10 px-1">{count}</span>}
            </div>
          ))}
          <p className="mb-1 mt-3 px-1.5 text-[7px] font-bold uppercase tracking-[0.14em] text-white/35">
            Folders
          </p>
          {['Projects', 'Personal', 'Reading'].map((label) => (
            <div key={label} className="flex h-5 items-center gap-1.5 px-1.5 text-[8px] text-white/55">
              <FolderOpen className="h-2.5 w-2.5" />
              {label}
            </div>
          ))}
          <div className="mt-auto rounded-[8px] border border-white/10 bg-white/[0.04] p-2">
            <p className="text-[8px] font-semibold">Open-source workspace</p>
            <p className="mt-0.5 text-[7px] leading-3 text-white/40">All features included.</p>
          </div>
        </div>

        <div className="w-[176px] shrink-0 border-r border-slate-200 bg-slate-50 p-2.5">
          <div className="mb-2 flex items-center">
            <p className="flex-1 text-[10px] font-bold text-slate-800">All notes</p>
            <span className="rounded-full bg-slate-200 px-1.5 text-[8px] font-semibold text-slate-500">
              12
            </span>
          </div>
          <div className="mb-3 flex h-7 items-center gap-1.5 rounded-[7px] border border-slate-200 bg-white px-2 text-[8px] text-slate-400">
            <Search className="h-3 w-3" />
            Search notes
          </div>
          {[
            ['Product launch notes', 'Goals, milestones, and release plan…', true],
            ['Design critique', 'Decisions and follow-up actions…', false],
            ['Friday reflections', 'What moved forward this week…', false],
          ].map(([title, preview, active]) => (
            <div
              key={title}
              className={`mb-2 rounded-[9px] border p-2.5 ${
 active
 ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="truncate text-[9px] font-bold text-slate-800">{title}</p>
              <p className="mt-1 line-clamp-2 text-[7px] leading-3 text-slate-400">{preview}</p>
              <div className="mt-2 flex items-center gap-1 text-[7px] text-slate-400">
                Today
                <span>·</span>
                <span className={active ? 'text-emerald-600' : ''}>Projects</span>
              </div>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 bg-white p-2.5">
          <div className="qn-banner-surface rounded-[10px] px-4 py-3 text-white">
            <p className="text-[12px] font-bold">Product launch notes</p>
            <p className="mt-1.5 text-[7px] text-white/55">Today · Projects · #launch</p>
          </div>
          <div className="my-2 flex h-7 items-center gap-2 border-y border-slate-100 text-[8px] font-semibold text-slate-400">
            <span>↶</span>
            <span>↷</span>
            <span className="rounded bg-slate-100 px-2 py-1">Heading</span>
            <b className="text-slate-700">B</b>
            <i className="text-slate-700">I</i>
            <span>☷</span>
          </div>
          <div className="px-3 py-2">
            <p className="text-[13px] font-bold tracking-tight text-slate-800">Launch with clarity</p>
            <div className="mb-4 mt-2 h-px bg-gradient-to-r from-emerald-400 via-slate-200 to-slate-200" />
            <p className="mb-3 max-w-[42ch] text-[8px] leading-[14px] text-slate-500">
              Keep the story focused, the handoff calm, and every important decision easy to find.
            </p>
            <div className="space-y-2">
              {tasks.map((task, index) => (
                <div key={task} className="flex items-start gap-2 text-[8px] leading-3 text-slate-600">
                  <span
                    className={`mt-px flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] ${
 index < 2 ? 'bg-emerald-500 text-white' : 'border border-slate-300'
 }`}
                  >
                    {index < 2 && <Check className="h-2 w-2" />}
                  </span>
                  {task}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthField({ id, label, icon: Icon, error, trailing, className = '', ...inputProps }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-ui-sm font-semibold text-content-muted">
        {label}
      </label>
      <div className="group relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle transition-colors group-focus-within:text-accent-text"
          aria-hidden="true"
        />
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 w-full rounded-[10px] border border-strong bg-surface-raised pl-10 pr-3 text-ui-lg text-content shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-content-subtle focus:border-accent focus:ring-2 focus:ring-[var(--qn-accent-soft)] aria-[invalid=true]:border-danger"
          {...inputProps}
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-ui-sm text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}

function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-ui-lg font-semibold text-accent-on shadow-md shadow-emerald-900/10 transition-[background-color,box-shadow,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <>
          {children}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </>
      )}
    </button>
  )
}

export default function AuthScreen() {
  const cloudEnabled = isBackendConfigured()
  const notes = useNotesStore((state) => state.notes)
  const setUser = useNotesStore((state) => state.setUser)
  const initializeStarterContent = useNotesStore((state) => state.initializeStarterContent)

  const [mode, setMode] = useState(cloudEnabled ? 'login' : 'local')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    agreeToTerms: false,
  })

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setErrors({})
    setNotice('')
  }

  const handleInputChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    if (errors[field] || errors.form) {
      setErrors((current) => ({ ...current, [field]: '', form: '' }))
    }
  }

  const validateForm = () => {
    const nextErrors = {}
    if (!formData.email) nextErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = 'Enter a valid email address'

    if (mode === 'login' || mode === 'register') {
      if (!formData.password) nextErrors.password = 'Password is required'
      else if (mode === 'register') {
        const passwordError = validateNewPassword(formData.password)
        if (passwordError) nextErrors.password = passwordError
      }
    }

    if (mode === 'register') {
      if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required'
      if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required'
      if (!formData.confirmPassword) nextErrors.confirmPassword = 'Confirm your password'
      else if (formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = 'Passwords do not match'
      }
      if (!formData.agreeToTerms) nextErrors.agreeToTerms = 'Please accept the terms to continue'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})
    setNotice('')

    try {
      if (mode === 'register') {
        const { error } = await backend.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName.trim(),
              last_name: formData.lastName.trim(),
            },
            emailRedirectTo: getRedirectUrl(),
          },
        })
        if (error) throw error
        changeMode('confirmation')
      } else if (mode === 'login') {
        const { error } = await backend.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })
        if (error) throw error
        // App's auth-state listener activates the correct account-scoped cache.
      } else if (mode === 'forgot') {
        const { error } = await backend.auth.resetPasswordForEmail(formData.email, {
          redirectTo: getRedirectUrl(),
        })
        if (error) throw error
        setNotice('A password reset link has been sent to your email.')
      }
    } catch (error) {
      setErrors({ form: getAuthErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }

  const openLocalWorkspace = () => {
    if (notes.length === 0) initializeStarterContent()
    startLocalSession()
    setUser(createLocalUser())
  }

  const renderModeTabs = () => {
    if (!cloudEnabled || !['login', 'register'].includes(mode)) return null
    return (
      <div
        role="tablist"
        aria-label="Account access"
        className="mb-7 grid grid-cols-2 rounded-[10px] border border-subtle bg-surface-sunken p-1"
      >
        {[
          ['login', 'Sign in'],
          ['register', 'Create account'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => changeMode(value)}
            className={`h-9 rounded-[7px] text-ui-md font-semibold transition-colors ${
 mode === value
 ? 'bg-surface-raised text-content shadow-xs'
                : 'text-content-muted hover:text-content'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  const renderLocalWorkspace = () => (
    <div className="auth-form-animate">
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-[14px] border border-accent-border bg-accent-soft text-accent-text">
        <HardDrive className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mb-2 text-ui-sm font-bold uppercase tracking-[0.14em] text-accent-text">
        Local-first workspace
      </p>
      <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.035em] text-content">
        {notes.length > 0 ? 'Welcome back to your notes.' : 'Start writing without an account.'}
      </h1>
      <p className="mt-3 text-ui-lg leading-6 text-content-muted">
        Everything is stored privately in this browser. QuickNotes works offline and does not
        require a subscription or a cloud account.
      </p>

      <div className="my-7 space-y-3 rounded-[14px] border border-subtle bg-surface-sunken p-4">
        {[
          ['Private on this device', ShieldCheck],
          ['Available without a connection', WifiOff],
          ['Every editor and organization feature included', Sparkles],
        ].map(([label, Icon]) => (
          <div key={label} className="flex items-center gap-3 text-ui-md font-medium text-content">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent-soft text-accent-text">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {label}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={openLocalWorkspace}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[11px] bg-accent px-4 text-ui-lg font-semibold text-accent-on shadow-md shadow-emerald-900/10 transition-[background-color,box-shadow,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover hover:shadow-lg active:translate-y-0"
      >
        {notes.length > 0 ? 'Continue to my workspace' : 'Create local workspace'}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>

      {cloudEnabled && (
        <button
          type="button"
          onClick={() => changeMode('login')}
          className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-ui-md font-semibold text-content-muted hover:text-content"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to cloud sign in
        </button>
      )}
    </div>
  )

  const renderLogin = () => (
    <div className="auth-form-animate">
      <p className="mb-2 text-ui-sm font-bold uppercase tracking-[0.14em] text-accent-text">
        Good to see you
      </p>
      <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.035em] text-content">
        Welcome back.
      </h1>
      <p className="mb-7 mt-2 text-ui-lg text-content-muted">
        Sign in to sync your workspace across devices.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField
          id="qn-auth-email"
          label="Email address"
          icon={Mail}
          type="email"
          value={formData.email}
          onChange={(event) => handleInputChange('email', event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email}
        />
        <AuthField
          id="qn-auth-password"
          label="Password"
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={(event) => handleInputChange('password', event.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-content-subtle hover:bg-surface-hover hover:text-content"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => changeMode('forgot')}
            className="text-ui-md font-semibold text-accent-text hover:text-accent-hover"
          >
            Forgot password?
          </button>
        </div>
        {errors.form && (
          <p role="alert" className="rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-ui-md text-danger-text">
            {errors.form}
          </p>
        )}
        <SubmitButton loading={isLoading}>Sign in</SubmitButton>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--qn-border)]" />
        <span className="text-ui-xs font-semibold uppercase tracking-[0.1em] text-content-subtle">
          No account needed
        </span>
        <span className="h-px flex-1 bg-[var(--qn-border)]" />
      </div>
      <button
        type="button"
        onClick={() => changeMode('local')}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-strong bg-surface-raised text-ui-md font-semibold text-content shadow-xs hover:bg-surface-hover"
      >
        <HardDrive className="h-4 w-4 text-accent-text" aria-hidden="true" />
        Use a private local workspace
      </button>
    </div>
  )

  const renderRegister = () => (
    <div className="auth-form-animate">
      <p className="mb-2 text-ui-sm font-bold uppercase tracking-[0.14em] text-accent-text">
        Your workspace, everywhere
      </p>
      <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.035em] text-content">
        Create your account.
      </h1>
      <p className="mb-6 mt-2 text-ui-lg text-content-muted">
        Sync notes and collaborate without giving up offline access.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="qn-auth-first-name"
            label="First name"
            icon={User}
            type="text"
            value={formData.firstName}
            onChange={(event) => handleInputChange('firstName', event.target.value)}
            autoComplete="given-name"
            error={errors.firstName}
          />
          <AuthField
            id="qn-auth-last-name"
            label="Last name"
            icon={User}
            type="text"
            value={formData.lastName}
            onChange={(event) => handleInputChange('lastName', event.target.value)}
            autoComplete="family-name"
            error={errors.lastName}
          />
        </div>
        <AuthField
          id="qn-auth-register-email"
          label="Email address"
          icon={Mail}
          type="email"
          value={formData.email}
          onChange={(event) => handleInputChange('email', event.target.value)}
          autoComplete="email"
          error={errors.email}
        />
        <AuthField
          id="qn-auth-register-password"
          label="Password"
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={(event) => handleInputChange('password', event.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete="new-password"
          error={errors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-content-subtle hover:bg-surface-hover hover:text-content"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <p className="-mt-2 text-ui-xs text-content-subtle">
          Use at least {MIN_PASSWORD_LENGTH} characters. A memorable passphrase works well.
        </p>
        <AuthField
          id="qn-auth-confirm-password"
          label="Confirm password"
          icon={Lock}
          type="password"
          value={formData.confirmPassword}
          onChange={(event) => handleInputChange('confirmPassword', event.target.value)}
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
        <label className="flex cursor-pointer items-start gap-3 rounded-control p-1 text-ui-md leading-5 text-content-muted">
          <input
            type="checkbox"
            checked={formData.agreeToTerms}
            onChange={(event) => handleInputChange('agreeToTerms', event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-strong text-accent focus:ring-accent"
          />
          <span>
            I agree to the{' '}
            <button
              type="button"
              onClick={() => useUIStore.getState().setTermsModalOpen(true)}
              className="font-semibold text-accent-text hover:text-accent-hover"
            >
              Terms
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => useUIStore.getState().setPrivacyModalOpen(true)}
              className="font-semibold text-accent-text hover:text-accent-hover"
            >
              Privacy Policy
            </button>
            .
          </span>
        </label>
        {errors.agreeToTerms && (
          <p role="alert" className="text-ui-sm text-danger-text">
            {errors.agreeToTerms}
          </p>
        )}
        {errors.form && (
          <p role="alert" className="rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-ui-md text-danger-text">
            {errors.form}
          </p>
        )}
        <SubmitButton loading={isLoading}>Create account</SubmitButton>
      </form>
    </div>
  )

  const renderForgot = () => (
    <div className="auth-form-animate">
      <button
        type="button"
        onClick={() => changeMode('login')}
        className="mb-7 flex items-center gap-2 text-ui-md font-semibold text-content-muted hover:text-content"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </button>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] border border-accent-border bg-accent-soft text-accent-text">
        <Lock className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="text-[30px] font-bold tracking-[-0.035em] text-content">Reset your password.</h1>
      <p className="mb-7 mt-2 text-ui-lg leading-6 text-content-muted">
        Enter your account email and we’ll send a secure reset link.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField
          id="qn-auth-reset-email"
          label="Email address"
          icon={Mail}
          type="email"
          value={formData.email}
          onChange={(event) => handleInputChange('email', event.target.value)}
          autoComplete="email"
          error={errors.email}
        />
        {notice && (
          <p role="status" className="flex items-start gap-2 rounded-control border border-success-border bg-success-soft px-3 py-2.5 text-ui-md text-success-text">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}
        {errors.form && (
          <p role="alert" className="rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-ui-md text-danger-text">
            {errors.form}
          </p>
        )}
        <SubmitButton loading={isLoading}>Send reset link</SubmitButton>
      </form>
    </div>
  )

  const renderConfirmation = () => (
    <div className="auth-form-animate text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[18px] border border-success-border bg-success-soft text-success-text">
        <Mail className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="mb-2 text-ui-sm font-bold uppercase tracking-[0.14em] text-success-text">
        One last step
      </p>
      <h1 className="text-[30px] font-bold tracking-[-0.035em] text-content">Check your inbox.</h1>
      <p className="mx-auto mt-3 max-w-[34ch] text-ui-lg leading-6 text-content-muted">
        We sent a confirmation link to <strong className="font-semibold text-content">{formData.email}</strong>.
      </p>
      <button
        type="button"
        onClick={() => changeMode('login')}
        className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-ui-lg font-semibold text-accent-on hover:bg-accent-hover"
      >
        Back to sign in
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )

  // The backdrop is the same neutral desk the workspace uses, so the green hero
  // reads as a card sitting on it. Continuing the hero across the whole page
  // instead just produced one large green field with the card lost inside it.
  return (
    <div className="qn-auth-page relative flex min-h-[100dvh] items-center justify-center overflow-hidden text-content">
      <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
        <div className="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-[rgba(52,211,153,0.10)] blur-3xl" />
        <div className="absolute -bottom-40 right-[28%] h-[520px] w-[520px] rounded-full bg-[rgba(16,185,129,0.10)] blur-3xl" />
      </div>

      <main className="relative z-10 grid h-[100dvh] w-full max-w-[1680px] overflow-hidden lg:grid-cols-[minmax(0,1.06fr)_clamp(430px,32vw,660px)] 2xl:h-[min(100dvh-72px,1000px)] 2xl:rounded-[26px] 2xl:shadow-[0_40px_90px_rgba(2,20,14,0.45)]">
        <section className="qn-auth-hero relative hidden overflow-hidden border-r border-white/10 px-10 py-9 text-white lg:flex lg:flex-col xl:px-16 xl:py-11">
          <div className="relative z-10 mx-auto w-full max-w-[860px]">
            <BrandMark />
          </div>

          <div className="relative z-10 mx-auto my-auto w-full max-w-[860px] py-4 xl:py-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-ui-sm font-semibold text-white/80 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary-300" aria-hidden="true" />
              Free, open-source, and yours to run
            </div>
            <h1 className="max-w-[680px] text-[42px] font-bold leading-[1.04] tracking-[-0.045em] xl:text-[52px]">
              Make room for the ideas that matter.
            </h1>
            <p className="mt-5 max-w-[590px] text-[16px] leading-7 text-white/60">
              A focused note workspace with the depth of a document editor and the speed of a
              quick capture tool.
            </p>

            <WorkspacePreview />
          </div>

          <div className="relative z-10 mx-auto hidden w-full max-w-[860px] grid-cols-3 gap-5 border-t border-white/10 pt-6 xl:grid">
            {FEATURE_POINTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white/[0.08] text-primary-300">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <p className="text-ui-md font-semibold text-white/90">{title}</p>
                </div>
                <p className="text-ui-sm leading-[18px] text-white/40">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-surface backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-subtle px-5 py-4 lg:hidden">
            <BrandMark compact />
            <span className="rounded-full border border-accent-border bg-accent-soft px-2.5 py-1 text-ui-xs font-semibold text-accent-text">
              Open source
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8 lg:px-10 xl:px-16">
            <div className="mx-auto my-auto w-full max-w-[440px]">
              <div className="mb-7 hidden items-center justify-between lg:flex">
                <span className="text-ui-sm font-medium text-content-subtle">
                  {cloudEnabled ? 'Secure cloud access' : 'No cloud server configured'}
                </span>
                <span className="rounded-full border border-accent-border bg-accent-soft px-2.5 py-1 text-ui-xs font-semibold text-accent-text">
                  {cloudEnabled ? 'Offline-ready' : 'Local mode'}
                </span>
              </div>

              {renderModeTabs()}
              {mode === 'local' && renderLocalWorkspace()}
              {mode === 'login' && renderLogin()}
              {mode === 'register' && renderRegister()}
              {mode === 'forgot' && renderForgot()}
              {mode === 'confirmation' && renderConfirmation()}
            </div>
          </div>

          <footer className="px-5 pb-5 pt-2 sm:px-8 lg:px-10 xl:px-16">
            <div className="mx-auto flex max-w-[440px] items-center justify-between gap-4 border-t border-subtle pt-4 text-ui-sm text-content-subtle">
              <span>QuickNotes · Open-source edition</span>
              <nav aria-label="Legal and support" className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => useUIStore.getState().setHelpModalOpen(true)}
                  className="hover:text-content"
                >
                  Help
                </button>
                <button
                  type="button"
                  onClick={() => useUIStore.getState().setPrivacyModalOpen(true)}
                  className="hover:text-content"
                >
                  Privacy
                </button>
                <button
                  type="button"
                  onClick={() => useUIStore.getState().setTermsModalOpen(true)}
                  className="hover:text-content"
                >
                  Terms
                </button>
              </nav>
            </div>
          </footer>
        </section>
      </main>

      <HelpModal />
      <PrivacyModal />
      <TermsModal />
    </div>
  )
}
