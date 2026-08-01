/**
 * The local-workspace session: a signed-out mode where notes stay in this
 * browser only.
 *
 * The flag is deliberately separate from Supabase's session so that reloading
 * lands the user back in the workspace they chose, with no network round-trip.
 */

const LOCAL_SESSION_KEY = 'quicknotes-local-session'
const LOCAL_NAME_KEY = 'quicknotes-local-name'
const DEFAULT_LOCAL_NAME = 'My workspace'

/** The name a local workspace shows, which outlives a reload. */
export const getLocalDisplayName = () => {
  try {
    return window.localStorage.getItem(LOCAL_NAME_KEY) || DEFAULT_LOCAL_NAME
  } catch {
    return DEFAULT_LOCAL_NAME
  }
}

export const setLocalDisplayName = (name) => {
  try {
    const trimmed = (name || '').trim()
    if (trimmed) window.localStorage.setItem(LOCAL_NAME_KEY, trimmed)
    else window.localStorage.removeItem(LOCAL_NAME_KEY)
  } catch {
    /* storage unavailable — the name simply falls back to the default */
  }
}

export const createLocalUser = () => {
  const name = getLocalDisplayName()
  return {
    id: 'quicknotes-local-workspace',
    email: '',
    isLocal: true,
    app_metadata: { provider: 'local' },
    user_metadata: {
      first_name: name,
      full_name: name,
    },
  }
}

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
