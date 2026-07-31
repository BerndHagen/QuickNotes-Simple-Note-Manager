/**
 * The local-workspace session: a signed-out mode where notes stay in this
 * browser only.
 *
 * The flag is deliberately separate from Supabase's session so that reloading
 * lands the user back in the workspace they chose, with no network round-trip.
 */

const LOCAL_SESSION_KEY = 'quicknotes-local-session'

export const createLocalUser = () => ({
  id: 'quicknotes-local-workspace',
  email: '',
  isLocal: true,
  app_metadata: { provider: 'local' },
  user_metadata: {
    first_name: 'My workspace',
    full_name: 'My workspace',
  },
})

export const hasLocalSession = () => {
  try {
    return window.localStorage.getItem(LOCAL_SESSION_KEY) === 'active'
  } catch {
    return false
  }
}

export const startLocalSession = () => {
  window.localStorage.setItem(LOCAL_SESSION_KEY, 'active')
}

export const endLocalSession = () => {
  window.localStorage.removeItem(LOCAL_SESSION_KEY)
}
