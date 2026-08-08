/**
 * The local-workspace session: a signed-out mode where notes stay in this
 * browser only.
 *
 * The flag is deliberately separate from Supabase's session so that reloading
 * lands the user back in the workspace they chose, with no network round-trip.
 */

const LOCAL_SESSION_KEY = 'quicknotes-local-session'
const LOCAL_WORKSPACE_NAME_KEY = 'quicknotes-local-name'
const DEFAULT_LOCAL_WORKSPACE_NAME = 'My workspace'

/** The name a local workspace shows, which outlives a reload. */
export const getLocalWorkspaceName = () => {
  try {
    return window.localStorage.getItem(LOCAL_WORKSPACE_NAME_KEY) || DEFAULT_LOCAL_WORKSPACE_NAME
  } catch {
    return DEFAULT_LOCAL_WORKSPACE_NAME
  }
}

export const setLocalWorkspaceName = (name) => {
  try {
    const trimmed = (name || '').trim()
    if (trimmed) window.localStorage.setItem(LOCAL_WORKSPACE_NAME_KEY, trimmed)
    else window.localStorage.removeItem(LOCAL_WORKSPACE_NAME_KEY)
  } catch {
    /* storage unavailable — the name simply falls back to the default */
  }
}

export const createLocalUser = () => {
  const username = getLocalWorkspaceName()
  return {
    id: 'quicknotes-local-workspace',
    email: '',
    isLocal: true,
    username,
    app_metadata: { provider: 'local' },
    user_metadata: {},
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
