import { useEffect, useRef } from 'react'
import { useNotesStore } from '../store'
import { backend, isBackendConfigured, subscribeToSharedNoteContent } from '../lib/backend'

export const useRealtimeCollaboration = (noteId) => {
  const applyExternalUpdate = useNotesStore((s) => s.applyExternalUpdate)
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

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
      lastUpdateRef.current = null
    }
  }, [noteId, applyExternalUpdate])
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
          event: 'INSERT',
          schema: 'public',
          table: 'shared_notes',
          filter: `email=eq.${user.email}`,
        },
        () => {
          void loadSharedNotes()
          
          if ('Notification' in window && Notification.permission === 'granted') {
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
