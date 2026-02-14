import { useEffect, useRef } from 'react'
import { useNotesStore } from '../store'
import { backend, isBackendConfigured, subscribeToSharedNoteContent } from '../lib/backend'

export const useRealtimeCollaboration = (noteId) => {
  const { updateNote } = useNotesStore()
  const channelRef = useRef(null)
  const lastUpdateRef = useRef(null)
  const isLocalUpdateRef = useRef(false)

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

        isLocalUpdateRef.current = false

        updateNote(noteId, {
          title: updatedNote.title,
          content: updatedNote.content,
          updatedAt: updatedNote.updated_at,
          _isExternalUpdate: true
        })
      }
    })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
      lastUpdateRef.current = null
      isLocalUpdateRef.current = false
    }
  }, [noteId])

  const markLocalUpdate = () => {
    isLocalUpdateRef.current = true
  }

  return { markLocalUpdate }
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
        (payload) => {
          loadSharedNotes()
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Note Shared', {
              body: 'Someone shared a note with you',
              icon: '/icons/icon-192x192.png'
            })
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
  }, [user?.email])
}