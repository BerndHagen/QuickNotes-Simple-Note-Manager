import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_PUBLIC_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isBackendConfigured = () => {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) return false

  try {
    const url = new URL(SUPABASE_URL)
    return ['http:', 'https:'].includes(url.protocol) && SUPABASE_PUBLIC_KEY.length >= 20
  } catch {
    return false
  }
}

export const getRedirectUrl = () => {
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).href
}

export const backend = isBackendConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: async () => ({ data: null, error: new Error('Backend not configured. Check .env file.') }),
        signInWithPassword: async () => ({ data: null, error: new Error('Backend not configured. Check .env file.') }),
        resetPasswordForEmail: async () => ({ error: new Error('Backend not configured. Check .env file.') }),
        getUser: async () => ({ data: { user: null } }),
        updateUser: async () => ({ error: new Error('Backend not configured. Check .env file.') }),
        signOut: async () => ({ error: null }),
      },
      from: () => {
        const builder = {
          select: () => builder,
          insert: () => builder,
          update: () => builder,
          upsert: () => builder,
          delete: () => builder,
          eq: () => builder,
          neq: () => builder,
          in: () => builder,
          is: () => builder,
          not: () => builder,
          or: () => builder,
          order: () => builder,
          limit: () => builder,
          single: () => ({
            then: (resolve) => resolve({ data: null, error: null }),
            catch: (fn) => Promise.resolve({ data: null, error: null }).catch(fn),
          }),
          then: (resolve) => resolve({ data: [], error: null }),
          catch: (fn) => Promise.resolve({ data: [], error: null }).catch(fn),
        }
        return builder
      },
      channel: () => ({
        on: function () { return this },
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
      removeChannel: async () => 'ok',
      rpc: async () => ({ data: null, error: new Error('Backend not configured. Check .env file.') }),
    }

export const subscribeToSharedNoteContent = (noteId, callback) => {
  if (!isBackendConfigured()) {
    return { unsubscribe: () => {} }
  }

  const channel = backend
    .channel(`shared-note-${noteId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notes',
        filter: `id=eq.${noteId}`,
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()

  return {
    unsubscribe: () => {
      backend.removeChannel(channel)
    },
  }
}

export const createShareLink = async (noteId, email, permission = 'view') => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { data: { user } } = await backend.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await backend.rpc('create_share_invitation', {
    p_note_id: noteId,
    p_email: normalizedEmail,
    p_permission: permission,
  })

  if (error) throw error
  return data
}

export const getMyUsername = async () => {
  if (!isBackendConfigured()) return ''

  const { data, error } = await backend.rpc('get_my_username')
  if (error) throw error
  return typeof data === 'string' ? data : ''
}

export const usernameIsAvailable = async (username) => {
  if (!isBackendConfigured()) return true

  const { data, error } = await backend.rpc('username_is_available', {
    p_username: String(username || '').trim(),
  })
  if (error) throw error
  return data === true
}

export const updateMyUsername = async (username) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')

  const { data, error } = await backend.rpc('update_my_username', {
    p_username: String(username || '').trim(),
  })
  if (error) throw error
  return data
}

export const acceptShare = async (shareId) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { data: { user } } = await backend.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const { data: accepted, error } = await backend
    .rpc('accept_share_invitation', { p_share_id: shareId })

  if (error) throw error
  if (!accepted) throw new Error('This invitation is no longer available')

  const { data: share, error: shareError } = await backend
    .from('shared_notes')
    .select('*, notes(*)')
    .eq('id', shareId)
    .single()

  if (shareError) throw shareError

  const { data: acceptedShare, error: acceptedError } = await backend
    .from('accepted_shares')
    .select('*')
    .eq('note_id', share.note_id)
    .eq('user_id', user.id)
    .single()

  if (acceptedError) throw acceptedError

  return { share, acceptedShare }
}

export const declineShare = async (shareId) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { data, error } = await backend
    .rpc('decline_share_invitation', { p_share_id: shareId })

  if (error) throw error
  if (!data) throw new Error('This invitation is no longer available')
  return data
}

export const getSharedNotes = async (userId) => {
  if (!isBackendConfigured()) return []
  
  if (!userId) {
    const { data: { user } } = await backend.auth.getUser()
    userId = user?.id
    if (!userId) return []
  }
  
  const { data: sharedRows, error: rpcError } = await backend.rpc('get_shared_notes')

  if (rpcError) throw rpcError

  return (sharedRows || []).map((share) => ({
      id: share.id,
      note_id: share.note_id,
      permission: share.permission,
      created_at: share.created_at,
      owner_id: share.owner_id,
      owner_name: share.owner_name,
      notes: {
        id: share.note_id,
        title: share.note_title,
        content: share.note_content,
        user_id: share.owner_id,
        folder_id: share.note_folder_id,
        tags: share.note_tags || [],
        starred: share.note_starred,
        pinned: share.note_pinned,
        deleted: false,
        archived: share.note_archived,
        note_type: share.note_type,
        note_data: share.note_data,
        created_at: share.note_created_at,
        updated_at: share.note_updated_at,
      },
    }))
}

export const getPendingShares = async (userId) => {
  if (!isBackendConfigured()) return []
  
  const { data: { user } } = await backend.auth.getUser()
  if (!user) return []
  
  if (userId && user.id !== userId) {
    throw new Error('Cannot load invitations for another account')
  }

  const { data, error } = await backend.rpc('get_pending_share_invitations')

  if (error) throw error
  return (data || []).map((share) => ({
    ...share,
    shared_by: share.owner_name,
    notes: {
      id: share.note_id,
      title: share.note_title,
    },
  }))
}

export const removeShare = async (shareId) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { data, error } = await backend
    .rpc('revoke_share_invitation', { p_share_id: shareId })

  if (error) throw error
  if (!data) throw new Error('Share not found or already removed')
}

export const leaveSharedNote = async (noteId) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { data, error } = await backend
    .rpc('leave_shared_note', { p_note_id: noteId })

  if (error) throw error
  if (!data) throw new Error('Shared note not found or already left')
}

export const updateSharedNote = async (noteId, updates) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')

  const allowedKeys = new Set(['title', 'content', 'noteType', 'noteData'])
  const patch = {}
  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.has(key)) continue
    if (key === 'noteType') patch.note_type = value
    else if (key === 'noteData') patch.note_data = value
    else patch[key] = value
  }

  if (Object.keys(patch).length === 0) return

  const { data, error } = await backend.rpc('update_shared_note', {
    p_note_id: noteId,
    p_patch: patch,
  })

  if (error) throw error
  if (!data) throw new Error('Shared note not found or no longer editable')
}

/**
 * Delete the current user's account and all associated data.
 * Calls a SECURITY DEFINER stored procedure that cascades deletion
 * across all tables (notes, folders, tags, versions, and shares)
 * and removes the auth.users entry.
 */
export const deleteUserAccount = async () => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')

  const { data: { user } } = await backend.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await backend.rpc('delete_user_account')
  if (error) throw error

  await backend.auth.signOut()
}

/**
 * Fetch version history for a note from Supabase.
 * Returns versions sorted by created_at descending (newest first).
 */
export const getRemoteNoteVersions = async (noteId) => {
  if (!isBackendConfigured()) return []
  
  const { data, error } = await backend
    .from('note_versions')
    .select('id, note_id, title, content, note_type, note_data, created_at')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })
    .limit(30)
  
  if (error) throw error
  
  return (data || []).map(v => ({
    id: v.id,
    noteId: v.note_id,
    title: v.title,
    content: v.content,
    noteType: v.note_type || 'standard',
    noteData: v.note_data,
    createdAt: v.created_at,
    source: 'remote',
  }))
}
