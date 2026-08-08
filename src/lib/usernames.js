export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/

export const normalizeUsername = (value) => String(value || '').trim()

export const validateUsername = (value) => {
  const username = normalizeUsername(value)
  if (!username) return 'Username is required'
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use 3-32 letters, numbers, dots, underscores, or hyphens'
  }
  return ''
}
