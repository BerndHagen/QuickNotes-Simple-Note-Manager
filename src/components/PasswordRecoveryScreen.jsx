import { useRef, useState } from 'react'
import { BrandLogo, Button, Input } from './ui'
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'
import { backend } from '../lib/backend'
import { getAuthErrorMessage, MIN_PASSWORD_LENGTH, validateNewPassword } from '../lib/authValidation'

export default function PasswordRecoveryScreen({ onComplete, onCancel }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState('')
  const passwordRef = useRef(null)
  const confirmationRef = useRef(null)
  const submittingRef = useRef(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current) return
    const passwordError = validateNewPassword(password)
    if (passwordError) {
      setError(passwordError)
      setErrorField('password')
      passwordRef.current?.focus()
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match')
      setErrorField('confirmation')
      confirmationRef.current?.focus()
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setError('')
    setErrorField('')
    try {
      const { error: updateError } = await backend.auth.updateUser({ password })
      if (updateError) throw updateError
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError, 'Your password could not be updated.'))
      setErrorField('form')
      return
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
    onComplete?.()
  }

  return (
    <main className="qn-auth-page flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-[460px] rounded-dialog border border-strong bg-surface-raised p-7 shadow-dialog sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <BrandLogo className="h-10 w-10" />
          <div>
            <p className="text-title-md font-bold text-content">QuickNotes</p>
            <p className="text-ui-sm text-content-muted">Secure account recovery</p>
          </div>
        </div>

        <Lock className="mb-5 h-6 w-6 text-accent-text" aria-hidden="true" />
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
              <Input
                id="qn-recovery-password"
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                  setErrorField('')
                }}
                autoComplete="new-password"
                aria-invalid={errorField === 'password'}
                aria-describedby={`qn-recovery-password-hint${errorField === 'password' ? ' qn-recovery-error' : ''}`}
                className="h-11 pr-11 text-ui-lg"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-content-subtle hover:bg-surface-hover hover:text-content"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <p id="qn-recovery-password-hint" className="mt-1.5 text-ui-xs text-content-subtle">
              Use at least {MIN_PASSWORD_LENGTH} characters. A memorable passphrase works well.
            </p>
          </div>

          <div>
            <label htmlFor="qn-recovery-confirmation" className="mb-1.5 block text-ui-sm font-semibold text-content-muted">
              Confirm new password
            </label>
            <Input
              id="qn-recovery-confirmation"
              ref={confirmationRef}
              type="password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value)
                setError('')
                setErrorField('')
              }}
              autoComplete="new-password"
              aria-invalid={errorField === 'confirmation'}
              aria-describedby={errorField === 'confirmation' ? 'qn-recovery-error' : undefined}
              className="h-11 text-ui-lg"
            />
          </div>

          {error && (
            <p id="qn-recovery-error" role="alert" className="rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-ui-md text-danger-text">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            icon={CheckCircle2}
            loading={isSubmitting}
            fullWidth
          >
            Update password
          </Button>
          <Button
            variant="ghost"
            onClick={() => onCancel?.()}
            disabled={isSubmitting}
            fullWidth
          >
            Cancel and sign out
          </Button>
        </form>
      </div>
    </main>
  )
}
