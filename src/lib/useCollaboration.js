import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useNotesStore } from '../store'
import {
  backend,
  isBackendConfigured,
  subscribeToSharedNoteAccess,
  subscribeToSharedNoteContent,
  subscribeToCommentMentions,
} from '../lib/backend'

export const useRealtimeCollaboration = (noteId) => {
  const applyExternalUpdate = useNotesStore((s) => s.applyExternalUpdate)
  const loadSharedNotes = useNotesStore((s) => s.loadSharedNotes)
  const isShared = useNotesStore((s) => s.sharedNotes.some((share) => share.notes?.id === noteId))
  const channelRef = useRef(null)
  const lastUpdateRef = useRef(null)

  useEffect(() => {
    if (!noteId) return

    const channel = subscribeToSharedNoteContent(noteId, (payload) => {
      if (payload.eventType === 'UPDATE') {
        const updatedNote = payload.new

        const updateKey = `${updatedNote.id}-${updatedNote.updated_at}`
        if (lastUpdateRef.current === updateKey) {
          return
        }
        lastUpdateRef.current = updateKey

        // Server-authored change: applied without dirtying the note.
        applyExternalUpdate(noteId, {
          title: updatedNote.title,
          content: updatedNote.content,
          noteType: updatedNote.note_type || 'standard',
          noteData: updatedNote.note_data,
          updatedAt: updatedNote.updated_at,
        })
      }
    })
    const accessChannel = isShared
      ? subscribeToSharedNoteAccess(noteId, () => { void loadSharedNotes() })
      : null

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
      accessChannel?.unsubscribe()
      lastUpdateRef.current = null
    }
  }, [noteId, applyExternalUpdate, isShared, loadSharedNotes])
}

export const useCommentMentions = () => {
  const user = useNotesStore((state) => state.user)

  useEffect(() => {
    if (!user?.id || user.isLocal || !isBackendConfigured()) return undefined
    const channel = subscribeToCommentMentions(user.id, () => {
      toast.success('You were mentioned in a note comment.')
    })
    return () => channel.unsubscribe()
  }, [user?.id, user?.isLocal])
}

export const useShareInvitations = () => {
  const { user, loadSharedNotes } = useNotesStore()
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user?.email || !isBackendConfigured()) return

    const channel = backend
      .channel('share-invitations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_notes',
          filter: `email=eq.${user.email}`,
        },
        (payload) => {
          void loadSharedNotes()
          
          if (payload.eventType === 'INSERT' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('New note shared', {
                body: 'Someone shared a note with you.',
                icon: `${import.meta.env.BASE_URL}icons/icon-192x192.png`,
              })
            } catch {
              // The invitation remains visible in Shared notes when system notifications fail.
            }
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [loadSharedNotes, user?.email])
}
