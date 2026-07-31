/**
 * Client-side account rules and the user-facing wording for auth failures.
 *
 * `MIN_PASSWORD_LENGTH` has to match the minimum configured in the Supabase
 * dashboard, otherwise the backend accepts passwords this app rejects.
 */

export const MIN_PASSWORD_LENGTH = 12

export const validateNewPassword = (password) => {
  if (!password) return 'Password is required'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (password.length > 128) return 'Use no more than 128 characters'
  return ''
}

export const getAuthErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  const messagesByCode = {
    email_address_invalid: 'Enter a valid email address.',
    email_not_confirmed: 'Confirm your email before signing in.',
    invalid_credentials: 'The email or password is incorrect.',
    over_email_send_rate_limit:
      'Email delivery is temporarily rate-limited. Wait a few minutes and try again.',
    over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
    signup_disabled: 'New account registration is currently unavailable.',
    user_already_exists: 'An account already exists for this email.',
    weak_password: `Use a stronger password with at least ${MIN_PASSWORD_LENGTH} characters.`,
  }

  const messagesByLegacyText = {
    'Invalid login credentials': messagesByCode.invalid_credentials,
    'User already registered': messagesByCode.user_already_exists,
  }

  return (
    messagesByCode[error?.code] ||
    messagesByLegacyText[error?.message] ||
    error?.message ||
    fallback
  )
}
