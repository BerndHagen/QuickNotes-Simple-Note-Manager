import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Users, ExternalLink, LogOut, RefreshCw, Mail, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useNotesStore } from '../store'
import { useUIStore } from '../store'
import LegacyDialog from './ui/LegacyDialog'
import { ConfirmDialog } from './FolderDialogs'

export default function SharedNotesView() {
  const { sharedNotesViewOpen, setSharedNotesViewOpen } = useUIStore()
  const { 
    sharedNotes, 
    pendingShares, 
    loadSharedNotes, 
    acceptShare, 
    declineShare, 
    leaveSharedNote,
    setSelectedNoteId 
  } = useNotesStore()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('accepted')
  const [confirmation, setConfirmation] = useState(null)
  const [busyShareId, setBusyShareId] = useState(null)
  const [error, setError] = useState('')
  const acceptedTabRef = useRef(null)
  const pendingTabRef = useRef(null)
  const busyShareRef = useRef(null)

  const acceptedShares = Array.isArray(sharedNotes)
    ? sharedNotes.filter((share) => share?.notes?.id)
    : []
  const pendingInvitations = Array.isArray(pendingShares)
    ? pendingShares.filter((share) => share?.id && (share?.notes || share)?.id)
    : []

  const handleRefresh = useCallback(async ({ preferPending = false } = {}) => {
    setIsLoading(true)
    setError('')
    try {
      await loadSharedNotes()
      if (preferPending && useNotesStore.getState().pendingShares.length > 0) {
        setActiveTab('pending')
      }
    } catch (refreshError) {
      setError(refreshError?.message || 'Shared notes could not be refreshed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [loadSharedNotes])

  useEffect(() => {
    if (sharedNotesViewOpen) void handleRefresh({ preferPending: true })
  }, [handleRefresh, sharedNotesViewOpen])

  const handleAccept = async (shareId) => {
    if (busyShareRef.current) return
    busyShareRef.current = shareId
    setBusyShareId(shareId)
    setError('')
    try {
      await acceptShare(shareId)
      setActiveTab('accepted')
    } catch (acceptError) {
      setError(acceptError?.message || 'The invitation could not be accepted. Please try again.')
    } finally {
      busyShareRef.current = null
      setBusyShareId(null)
    }
  }

  const handleDecline = async (shareId) => {
    try {
      await declineShare(shareId)
      await handleRefresh()
    } catch (declineError) {
      throw new Error(declineError?.message || 'The invitation could not be declined. Please try again.')
    }
  }

  const handleLeave = async (noteId) => {
    try {
      await leaveSharedNote(noteId)
      await handleRefresh()
    } catch (leaveError) {
      throw new Error(leaveError?.message || 'The shared note could not be left. Please try again.')
    }
  }

  const handleOpenNote = (noteId) => {
    setSelectedNoteId(noteId)
    setSharedNotesViewOpen(false)
  }

  const handleTabKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const nextTab = activeTab === 'accepted' ? 'pending' : 'accepted'
    setActiveTab(nextTab)
    const nextTabRef = nextTab === 'accepted' ? acceptedTabRef : pendingTabRef
    nextTabRef.current?.focus()
  }

  if (!sharedNotesViewOpen) return null

  return (
    <LegacyDialog label="Shared notes" onClose={() => setSharedNotesViewOpen(false)} align="center">
      <div className="bg-surface-raised rounded-2xl shadow-2xl border border-subtle max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 qn-banner-surface text-white">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Shared Notes</h2>
              <p className="text-sm text-white/70">Notes shared with you</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label="Refresh shared notes"
              aria-busy={isLoading || undefined}
              className="p-2 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
              title="Refresh shared notes"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            
            <button
              type="button"
              onClick={() => setSharedNotesViewOpen(false)}
              aria-label="Close shared notes"
              className="qn-square-control rounded-full p-2 transition-colors hover:bg-white/20"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="border-b border-subtle px-6">
          <div role="tablist" aria-label="Shared note status" className="flex gap-4">
            <button
              ref={acceptedTabRef}
              type="button"
              role="tab"
              id="shared-notes-accepted-tab"
              aria-controls="shared-notes-accepted-panel"
              aria-selected={activeTab === 'accepted'}
              tabIndex={activeTab === 'accepted' ? 0 : -1}
              onClick={() => setActiveTab('accepted')}
              onKeyDown={handleTabKeyDown}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
 activeTab === 'accepted'
 ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-content-muted hover:text-content dark:text-content-subtle dark:hover:text-content-subtle'
              }`}
            >
              Accepted ({acceptedShares.length})
            </button>
            
            <button
              ref={pendingTabRef}
              type="button"
              role="tab"
              id="shared-notes-pending-tab"
              aria-controls="shared-notes-pending-panel"
              aria-selected={activeTab === 'pending'}
              tabIndex={activeTab === 'pending' ? 0 : -1}
              onClick={() => setActiveTab('pending')}
              onKeyDown={handleTabKeyDown}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors relative ${
 activeTab === 'pending'
 ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-content-muted hover:text-content dark:text-content-subtle dark:hover:text-content-subtle'
              }`}
            >
              Pending ({pendingInvitations.length})
              {pendingInvitations.length > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && <p role="status" className="qn-sr-only">Refreshing shared notes</p>}
          {error && (
            <p role="alert" className="mb-4 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 text-sm text-danger-text">
              {error}
            </p>
          )}
          {activeTab === 'accepted' && (
            <div
              id="shared-notes-accepted-panel"
              role="tabpanel"
              aria-labelledby="shared-notes-accepted-tab"
              className="space-y-3"
            >
              {acceptedShares.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-content-subtle dark:text-content-muted mx-auto mb-4" />
                  <p className="text-content-muted mb-2">
                    No shared notes
                  </p>
                  <p className="text-sm text-content-subtle">
                    When someone shares a note with you, it will appear here
                  </p>
                </div>
              ) : (
                acceptedShares.map((share) => {
                  const note = share.notes
                  if (!note) return null
                  
                  return (
                    <div
                      key={share.id}
                      className="p-4 border border-subtle rounded-lg hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-content truncate">
                              {String(note.title || 'Untitled note')}
                            </h3>
                            <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                              {share.permission === 'edit' ? 'Can Edit' : 'Read Only'}
                            </span>
                          </div>
                          
                          {note.content && (
                            <p className="text-sm text-content-muted line-clamp-2">
                              {String(note.content || '').replace(/<[^>]*>/g, '').substring(0, 150)}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => note.id && handleOpenNote(note.id)}
                            disabled={!note.id}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open
                          </button>
                          
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmation({
                                kind: 'leave',
                                id: note.id,
                                title: String(note.title || 'Untitled note'),
                              })
                            }
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            aria-label={`Leave ${String(note.title || 'shared note')}`}
                            title="Leave shared note"
                          >
                            <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
          {activeTab === 'pending' && (
            <div
              id="shared-notes-pending-panel"
              role="tabpanel"
              aria-labelledby="shared-notes-pending-tab"
              className="space-y-3"
            >
              {pendingInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-content-subtle dark:text-content-muted mx-auto mb-4" />
                  <p className="text-content-muted mb-2">
                    No pending shares
                  </p>
                  <p className="text-sm text-content-subtle">
                    Share requests will appear here
                  </p>
                </div>
              ) : (
                pendingInvitations.map((share) => {
                  const note = share.notes || share
                  if (!note || !note.id) {
                    return null
                  }
                  
                  return (
                    <div
                      key={share.id}
                      className="p-4 border-2 border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                    >
                      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            <h3 className="font-medium text-content truncate">
                              New share: {String(note.title || 'Untitled note')}
                            </h3>
                          </div>
                          
                          <div className="text-sm text-content-muted mb-2">
                            <span className="font-medium">{String(share.shared_by || 'A collaborator')}</span> wants to share this note with you
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-surface-raised text-content-muted rounded border border-subtle ">
                              {share.permission === 'edit' ? 'Edit Permission' : 'Read Only'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleAccept(share.id)}
                            disabled={!!busyShareId}
                            aria-busy={busyShareId === share.id || undefined}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:cursor-wait disabled:opacity-60"
                          >
                            {busyShareId === share.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckCircle className="w-4 h-4" aria-hidden="true" />
                            )}
                            {busyShareId === share.id ? 'Accepting…' : 'Accept'}
                          </button>
                          
                          <button
                            type="button"
                            disabled={!!busyShareId}
                            onClick={() =>
                              setConfirmation({
                                kind: 'decline',
                                id: share.id,
                                title: String(note.title || 'Untitled note'),
                              })
                            }
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
        <div className="p-4 bg-surface-sunken border-t border-subtle">
          <div className="text-xs text-content-muted flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>
              Note edits sync while collaborators work. Refresh this list to check for new invitations.
            </span>
          </div>
        </div>
        <ConfirmDialog
          open={!!confirmation}
          onClose={() => setConfirmation(null)}
          onConfirm={() =>
            confirmation?.kind === 'leave'
              ? handleLeave(confirmation.id)
              : handleDecline(confirmation.id)
          }
          title={confirmation?.kind === 'leave' ? 'Leave shared note?' : 'Decline invitation?'}
          description={
            confirmation?.kind === 'leave'
              ? `You will lose access to “${confirmation.title}”.`
              : `The invitation to “${confirmation?.title || 'this note'}” will be declined.`
          }
          confirmLabel={confirmation?.kind === 'leave' ? 'Leave note' : 'Decline'}
        />
      </div>
    </LegacyDialog>
  )
}
