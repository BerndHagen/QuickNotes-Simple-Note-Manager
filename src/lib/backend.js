import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isBackendConfigured = () => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.includes('supabase.co')
  )
}

export const getRedirectUrl = () => {
  if (window.location.hostname !== 'localhost') {
    return window.location.origin + window.location.pathname
  }
  return window.location.origin + '/QuickNotes-Simple-Note-Manager/'
}

export const backend = isBackendConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  
  const { data, error } = await backend
    .from('shared_notes')
    .insert({
      note_id: noteId,
      shared_by: user.id,
      email: email,
      permission,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const acceptShare = async (shareId) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { data: { user } } = await backend.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const { error } = await backend
    .rpc('accept_share_invitation', { p_share_id: shareId })

  if (error) throw error

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
  return data
}

export const getSharedNotes = async (userId) => {
  if (!isBackendConfigured()) return []
  
  if (!userId) {
    const { data: { user } } = await backend.auth.getUser()
    userId = user?.id
    if (!userId) return []
  }
  
  const { data: acceptedShares, error: acceptedError } = await backend
    .from('accepted_shares')
    .select('*, notes(id, title, content, user_id, folder_id, tags, starred, pinned, deleted, archived, note_type, note_data, created_at, updated_at)')
    .eq('user_id', userId)

  if (acceptedError) {
    const { data, error } = await backend
      .from('shared_notes')
      .select('*, notes(id, title, content, user_id, folder_id, tags, starred, pinned, deleted, archived, note_type, note_data, created_at, updated_at)')
      .or(`shared_by.eq.${userId},shared_with.eq.${userId}`)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })

    if (error) {
      return []
    }
    return data || []
  }
  
  return acceptedShares || []
}

export const getPendingShares = async (userId) => {
  if (!isBackendConfigured()) return []
  
  const { data: { user } } = await backend.auth.getUser()
  if (!user) return []
  
  const email = user.email
  if (!email) return []
  
  const { data, error } = await backend
    .from('shared_notes')
    .select('*, notes(id, title, content, user_id)')
    .eq('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return []
  }
  return data || []
}

export const removeShare = async (shareId) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { error } = await backend
    .from('shared_notes')
    .delete()
    .eq('id', shareId)

  if (error) throw error
}

export const leaveSharedNote = async (noteId) => {
  if (!isBackendConfigured()) throw new Error('Backend not configured')
  
  const { error } = await backend
    .rpc('leave_shared_note', { p_note_id: noteId })

  if (error) throw error
}

/**
 * Delete the current user's account and all associated data.
 * Calls a SECURITY DEFINER stored procedure that cascades deletion
 * across all tables (notes, folders, tags, versions, shares, cursors)
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
    .select('id, note_id, title, content, created_at')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })
    .limit(30)
  
  if (error) {
    return []
  }
  
  return (data || []).map(v => ({
    id: v.id,
    noteId: v.note_id,
    title: v.title,
    content: v.content,
    createdAt: v.created_at,
    source: 'remote',
  }))
}
