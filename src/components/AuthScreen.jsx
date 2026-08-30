import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HardDrive,
  LayoutGrid,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  WifiOff,
} from 'lucide-react'
import { backend, getRedirectUrl, isBackendConfigured, usernameIsAvailable } from '../lib/backend'
import {
  getAuthErrorMessage,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from '../lib/authValidation'
import { createLocalUser, endLocalSession, startLocalSession } from '../lib/localSession'
import { normalizeUsername, validateUsername } from '../lib/usernames'
import { BrandLogo, buttonClasses } from './ui'
import { useNotesStore, useUIStore } from '../store'

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
      <BrandLogo className={compact ? 'h-10 w-10' : 'h-11 w-11'} />
      <span>
        <span
          className={`block font-bold tracking-[-0.02em] ${
 compact ? 'text-title-md text-content' : 'text-[20px] leading-6 text-white'
 }`}
        >
          QuickNotes
        </span>
        {!compact && (
          <span className="block text-ui-sm font-medium text-white/70">A calmer writing workspace</span>
        )}
      </span>
    </div>
  )
}

function WorkspacePreview() {
  return (
    <div className="qn-auth-surface-preview mt-8" aria-hidden="true">
      <div className="qn-auth-surface-preview__bar">
        <span><i /> One workspace, three working surfaces</span>
        <span>Document · Paper · Canvas</span>
      </div>

      <div className="qn-auth-surface-preview__stage">
        <section className="qn-auth-surface qn-auth-surface--document">
          <div className="qn-auth-surface__eyebrow">Project brief</div>
          <div className="qn-auth-document-title">Launch notes</div>
          <div className="qn-auth-document-rule qn-auth-document-rule--wide" />
          <div className="qn-auth-document-rule" />
          <div className="qn-auth-document-heading">Next actions</div>
          <div className="qn-auth-document-check"><i /> Confirm the release scope</div>
          <div className="qn-auth-document-check"><i /> Share the review copy</div>
          <div className="qn-auth-document-rule qn-auth-document-rule--short" />
        </section>

        <section className="qn-auth-surface qn-auth-surface--paper">
          <span className="qn-auth-preview-tape" />
          <svg viewBox="0 0 230 178" role="presentation">
            <path d="M24 52 C52 31, 78 67, 105 45 S154 34, 194 55" />
            <path d="M31 88 C62 75, 85 102, 116 80 S166 72, 199 96" />
            <path d="M42 126 C67 110, 90 136, 124 116" />
            <path className="qn-auth-paper-accent" d="M139 118 C160 105, 181 113, 198 133" />
          </svg>
          <div className="qn-auth-paper-caption">Ideas stay fluid</div>
        </section>

        <section className="qn-auth-surface qn-auth-surface--canvas">
          <svg viewBox="0 0 250 178" role="presentation">
            <path d="M56 50 L128 83 L194 45" />
            <path d="M128 83 L178 132" />
          </svg>
          <div className="qn-auth-canvas-node qn-auth-canvas-node--one">Research</div>
          <div className="qn-auth-canvas-node qn-auth-canvas-node--two">Direction</div>
          <div className="qn-auth-canvas-node qn-auth-canvas-node--three">Draft</div>
          <div className="qn-auth-canvas-sticky"><i />Keep the useful parts.</div>
        </section>
      </div>

      <div className="qn-auth-surface-preview__legend">
        <span><b>Document</b><small>Structured writing</small></span>
        <span><b>Paper</b><small>Ink and pages</small></span>
        <span><b>Canvas</b><small>Spatial thinking</small></span>
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
      aria-busy={loading}
      className={buttonClasses({ variant: 'primary' }) + ' w-full'}
    >
      {loading ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{children}&hellip;</span>
        </>
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
  const activateLocalUser = useNotesStore((state) => state.activateLocalUser)
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
    username: '',
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
      const usernameError = validateUsername(formData.username)
      if (usernameError) nextErrors.username = usernameError
      if (!formData.confirmPassword) nextErrors.confirmPassword = 'Confirm your password'
      else if (formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = 'Passwords do not match'
      }
      if (!formData.agreeToTerms) nextErrors.agreeToTerms = 'Please accept the terms to continue'
    }

    setErrors(nextErrors)
    const firstInvalidField = {
      login: [
        ['email', 'qn-auth-email'],
        ['password', 'qn-auth-password'],
      ],
      register: [
        ['username', 'qn-auth-username'],
        ['email', 'qn-auth-register-email'],
        ['password', 'qn-auth-register-password'],
        ['confirmPassword', 'qn-auth-confirm-password'],
        ['agreeToTerms', 'qn-auth-agree-to-terms'],
      ],
      forgot: [['email', 'qn-auth-reset-email']],
    }[mode]?.find(([field]) => nextErrors[field])

    if (firstInvalidField) {
      requestAnimationFrame(() => document.getElementById(firstInvalidField[1])?.focus())
    }

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
        const requestedUsername = normalizeUsername(formData.username)
        let usernameAvailable
        try {
          usernameAvailable = await usernameIsAvailable(requestedUsername)
        } catch {
          setErrors({ form: 'Username availability could not be checked. Please try again.' })
          return
        }
        if (!usernameAvailable) {
          setErrors({ username: 'That username is already in use' })
          requestAnimationFrame(() => document.getElementById('qn-auth-username')?.focus())
          return
        }
        const { error } = await backend.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              username: requestedUsername,
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

  const openLocalWorkspace = async () => {
    setErrors({})
    setIsLoading(true)
    startLocalSession()

    try {
      const activated = await activateLocalUser(createLocalUser())
      if (!activated) throw new Error('The local workspace could not be opened.')
      if (useNotesStore.getState().notes.length === 0) initializeStarterContent()
    } catch (error) {
      endLocalSession()
      setErrors({
        form: error?.message || 'The local workspace could not be opened. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderModeTabs = () => {
    if (!cloudEnabled || !['login', 'register'].includes(mode)) return null
    return (
      <div
        role="group"
        aria-label="Account access"
        className="mb-7 grid grid-cols-2 rounded-[10px] border border-strong bg-surface-sunken p-1"
      >
        {[
          ['login', 'Sign in'],
          ['register', 'Create account'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => changeMode(value)}
            className={`h-9 rounded-[7px] text-ui-md font-semibold transition-colors ${
              mode === value
                ? 'bg-accent text-accent-on shadow-xs'
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
      <HardDrive className="mb-5 h-6 w-6 text-accent-text" aria-hidden="true" />
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

      {errors.form && (
        <div role="alert" className="mt-4 rounded-card border border-danger-border bg-danger-soft px-3 py-2 text-ui-md text-danger-text">
          {errors.form}
        </div>
      )}

      <div className="my-7 divide-y divide-[var(--qn-border-subtle)] border-y border-subtle">
        {[
          ['Private on this device', ShieldCheck],
          ['Available without a connection', WifiOff],
          ['Every editor and organization feature included', LayoutGrid],
        ].map(([label, Icon]) => (
          <div key={label} className="flex items-center gap-3 py-3 text-ui-md font-medium text-content">
            <Icon className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
            {label}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={openLocalWorkspace}
        disabled={isLoading}
        aria-busy={isLoading || undefined}
        className={buttonClasses({ variant: 'primary' }) + ' w-full'}
      >
        {isLoading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            Opening workspace&hellip;
          </>
        ) : (
          <>
            {notes.length > 0 ? 'Continue to my workspace' : 'Create local workspace'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
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
        <AuthField
          id="qn-auth-username"
          label="Username"
          icon={User}
          type="text"
          value={formData.username}
          onChange={(event) => handleInputChange('username', event.target.value)}
          placeholder="VampyrusNoctis"
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          error={errors.username}
        />
        <p className="-mt-2 text-ui-xs text-content-subtle">
          This is your only public identity in QuickNotes and appears on shared notes.
        </p>
        <AuthField
          id="qn-auth-register-email"
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
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
        <div className="flex items-start gap-3 rounded-control p-1 text-ui-md leading-5 text-content-muted">
          <input
            id="qn-auth-agree-to-terms"
            type="checkbox"
            checked={formData.agreeToTerms}
            onChange={(event) => handleInputChange('agreeToTerms', event.target.checked)}
            aria-invalid={!!errors.agreeToTerms}
            aria-describedby={errors.agreeToTerms ? 'qn-auth-agree-to-terms-error' : undefined}
            className="mt-0.5 h-4 w-4 rounded border-strong text-accent focus:ring-accent"
          />
          <span>
            <label htmlFor="qn-auth-agree-to-terms" className="cursor-pointer">
              I agree to the
            </label>{' '}
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
        </div>
        {errors.agreeToTerms && (
          <p id="qn-auth-agree-to-terms-error" role="alert" className="text-ui-sm text-danger-text">
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
      <Lock className="mb-5 h-6 w-6 text-accent-text" aria-hidden="true" />
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
          placeholder="you@example.com"
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
      <Mail className="mx-auto mb-5 h-7 w-7 text-success-text" aria-hidden="true" />
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

  // Authentication and workspace layouts share the same neutral canvas.
  return (
    <div className="qn-auth-page qn-canvas relative flex min-h-[100dvh] items-center justify-center overflow-hidden text-content">

      <main className="qn-auth-frame relative z-10 grid h-[100dvh] w-full max-w-[1680px] overflow-hidden lg:grid-cols-[minmax(0,1.06fr)_clamp(430px,32vw,660px)] 2xl:h-[min(100dvh-72px,1000px)] 2xl:rounded-[26px]">
        <section className="qn-auth-hero relative hidden overflow-hidden border-r border-white/10 px-10 py-9 text-white lg:flex lg:flex-col xl:px-16 xl:py-11">
          <div className="qn-auth-stationery hidden xl:block" aria-hidden="true">
            <span className="qn-auth-stationery-sheet qn-auth-stationery-sheet-back" />
            <span className="qn-auth-stationery-sheet qn-auth-stationery-sheet-front" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-[860px]">
            <BrandMark />
          </div>

          <div className="relative z-10 mx-auto my-auto w-full max-w-[860px] py-4 xl:py-8">
            <div className="mb-5 inline-flex items-center rounded-full border border-white/20 bg-white/[0.08] px-3.5 py-1.5 text-ui-sm font-semibold tracking-[0.01em] text-white/85">
              Free, open-source, and yours to run
            </div>
            <h1 className="max-w-[680px] text-[42px] font-bold leading-[1.04] tracking-[-0.045em] xl:text-[52px]">
              Make room for the ideas that matter.
            </h1>
            <p className="mt-5 max-w-[590px] text-[16px] leading-7 text-white/72">
              A focused note workspace with the depth of a document editor and the speed of a
              quick capture tool.
            </p>

            <WorkspacePreview />
          </div>

          <div className="qn-auth-features relative z-10 mx-auto hidden w-full max-w-[860px] grid-cols-3 gap-5 border-t border-white/10 pt-6 xl:grid">
            {FEATURE_POINTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white/[0.1] text-white/85 ring-1 ring-inset ring-white/10">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <p className="text-ui-md font-semibold text-white/90">{title}</p>
                </div>
                <p className="text-ui-sm leading-[18px] text-white/62">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="qn-auth-form-panel flex min-h-0 flex-col bg-surface">
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

    </div>
  )
}
