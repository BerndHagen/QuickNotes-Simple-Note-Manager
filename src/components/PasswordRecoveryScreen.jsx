import { useState } from 'react'
import { buttonClasses } from './ui'
import { CheckCircle2, Eye, EyeOff, FileText, Lock, RefreshCw } from 'lucide-react'
import { backend } from '../lib/backend'
import { getAuthErrorMessage, MIN_PASSWORD_LENGTH, validateNewPassword } from '../lib/authValidation'

export default function PasswordRecoveryScreen({ onComplete, onCancel }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const passwordError = validateNewPassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const { error: updateError } = await backend.auth.updateUser({ password })
      if (updateError) throw updateError
      onComplete()
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError, 'Your password could not be updated.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-[460px] rounded-[20px] border border-subtle bg-surface-raised p-7 shadow-xl sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent text-accent-on shadow-md">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-title-md font-bold text-content">QuickNotes</p>
            <p className="text-ui-sm text-content-muted">Secure account recovery</p>
          </div>
        </div>

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] border border-accent-border bg-accent-soft text-accent-text">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.035em] text-content">
          Choose a new password.
        </h1>
        <p className="mb-7 mt-2 text-ui-lg leading-6 text-content-muted">
          Your reset link is verified. Set a new password to finish recovering your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="qn-recovery-password" className="mb-1.5 block text-ui-sm font-semibold text-content-muted">
              New password
            </label>
            <div className="relative">
              <input
                id="qn-recovery-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
                autoComplete="new-password"
                className="h-11 w-full rounded-[10px] border border-strong bg-surface-raised px-3 pr-11 text-ui-lg text-content outline-none focus:border-accent focus:ring-2 focus:ring-[var(--qn-accent-soft)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-content-subtle hover:bg-surface-hover hover:text-content"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-ui-xs text-content-subtle">
              Use at least {MIN_PASSWORD_LENGTH} characters. A memorable passphrase works well.
            </p>
          </div>

          <div>
            <label htmlFor="qn-recovery-confirmation" className="mb-1.5 block text-ui-sm font-semibold text-content-muted">
              Confirm new password
            </label>
            <input
              id="qn-recovery-confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value)
                setError('')
              }}
              autoComplete="new-password"
              className="h-11 w-full rounded-[10px] border border-strong bg-surface-raised px-3 text-ui-lg text-content outline-none focus:border-accent focus:ring-2 focus:ring-[var(--qn-accent-soft)]"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-ui-md text-danger-text">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={buttonClasses({ variant: 'primary' }) + ' w-full'}
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            Update password
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-10 w-full rounded-[10px] text-ui-md font-semibold text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-60"
          >
            Cancel and sign out
          </button>
        </form>
      </div>
    </main>
  )
}
