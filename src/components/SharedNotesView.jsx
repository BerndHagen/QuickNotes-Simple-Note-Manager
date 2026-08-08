import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle,
  Clock,
  ExternalLink,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { Badge, Button, EmptyState, IconButton, Input, Modal, Select } from './ui'
import { ConfirmDialog } from './FolderDialogs'

const plainText = (content = '') => String(content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

export default function SharedNotesView() {
  const { sharedNotesViewOpen, setSharedNotesViewOpen } = useUIStore()
  const {
    sharedNotes,
    pendingShares,
    loadSharedNotes,
    acceptShare,
    declineShare,
    leaveSharedNote,
    setSelectedNoteId,
  } = useNotesStore()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('accepted')
  const [query, setQuery] = useState('')
  const [permissionFilter, setPermissionFilter] = useState('all')
  const [confirmation, setConfirmation] = useState(null)
  const [busyShareId, setBusyShareId] = useState(null)
  const [error, setError] = useState('')
  const acceptedTabRef = useRef(null)
  const pendingTabRef = useRef(null)
  const busyShareRef = useRef(null)

  const acceptedShares = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return (Array.isArray(sharedNotes) ? sharedNotes : [])
      .filter((share) => share?.notes?.id && !share.notes.deleted)
      .filter((share) => permissionFilter === 'all' || share.permission === permissionFilter)
      .filter((share) => {
        if (!normalizedQuery) return true
        const searchable = [
          share.notes.title,
          plainText(share.notes.content),
          share.owner_name,
        ].join(' ').toLocaleLowerCase()
        return searchable.includes(normalizedQuery)
      })
      .sort((left, right) =>
        String(right.notes.updatedAt || right.notes.updated_at || '').localeCompare(
          String(left.notes.updatedAt || left.notes.updated_at || '')
        )
      )
  }, [permissionFilter, query, sharedNotes])

  const acceptedCount = Array.isArray(sharedNotes)
    ? sharedNotes.filter((share) => share?.notes?.id && !share.notes.deleted).length
    : 0
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

  return (
    <>
      <Modal
        open={sharedNotesViewOpen}
        onClose={() => setSharedNotesViewOpen(false)}
        title="Shared notes"
        description="Notes other QuickNotes users have shared with you"
        icon={Users}
        size="2xl"
        bodyClassName="flex flex-col"
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-subtle">
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
              className={`border-b-2 px-1 py-3 text-ui-md font-medium transition-colors ${
                activeTab === 'accepted'
                  ? 'border-accent text-accent-text'
                  : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              Accepted ({acceptedCount})
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
              className={`relative border-b-2 px-1 py-3 text-ui-md font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'border-accent text-accent-text'
                  : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              Pending ({pendingInvitations.length})
              {pendingInvitations.length > 0 && (
                <span aria-hidden="true" className="absolute right-0 top-2 h-2 w-2 rounded-full bg-warning" />
              )}
            </button>
          </div>
          <IconButton
            icon={RefreshCw}
            iconClassName={isLoading ? 'animate-spin' : ''}
            label="Refresh shared notes"
            size="sm"
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            onClick={() => handleRefresh()}
          />
        </div>

        {isLoading && <p role="status" className="qn-sr-only">Refreshing shared notes</p>}
        {error && (
          <p role="alert" className="mb-4 rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-ui-md text-danger-text">
            {error}
          </p>
        )}

        {activeTab === 'accepted' && (
          <div
            id="shared-notes-accepted-panel"
            role="tabpanel"
            aria-labelledby="shared-notes-accepted-tab"
          >
            {acceptedCount > 0 && (
              <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <label className="relative block">
                  <span className="qn-sr-only">Search shared notes</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, content, or owner"
                    aria-label="Search shared notes"
                    className="pl-9"
                  />
                </label>
                <Select
                  value={permissionFilter}
                  onChange={(event) => setPermissionFilter(event.target.value)}
                  aria-label="Filter shared notes by permission"
                >
                  <option value="all">All permissions</option>
                  <option value="edit">Can edit</option>
                  <option value="view">Read only</option>
                </Select>
              </div>
            )}

            {acceptedCount === 0 ? (
              <EmptyState
                icon={Users}
                title="No shared notes"
                description="When someone shares a note with you, it will appear here."
              />
            ) : acceptedShares.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching shared notes"
                description="Try a different search or permission filter."
                size="sm"
              />
            ) : (
              <div className="space-y-3">
                {acceptedShares.map((share) => {
                  const note = share.notes
                  const ownerName = String(share.owner_name || 'Another QuickNotes user')
                  const preview = plainText(note.content).slice(0, 150)
                  return (
                    <article key={share.id} className="rounded-card border border-subtle bg-surface-raised p-4 transition-colors hover:bg-surface-hover">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="min-w-0 flex-1 truncate font-medium text-content" title={String(note.title || 'Untitled note')}>
                              {String(note.title || 'Untitled note')}
                            </h3>
                            <Badge tone={share.permission === 'edit' ? 'accent' : 'neutral'}>
                              {share.permission === 'edit' ? 'Can edit' : 'Read only'}
                            </Badge>
                          </div>
                          <div className="mb-2 flex min-w-0 items-center gap-2 text-ui-sm text-content-muted">
                            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-text">
                              {ownerName.charAt(0).toLocaleUpperCase() || 'Q'}
                            </span>
                            <span className="truncate" title={ownerName}>Owner: {ownerName}</span>
                          </div>
                          {preview && <p className="line-clamp-2 text-ui-md text-content-muted">{preview}</p>}
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-2">
                          <Button variant="primary" size="sm" icon={ExternalLink} onClick={() => handleOpenNote(note.id)}>
                            Open
                          </Button>
                          <IconButton
                            icon={LogOut}
                            label={`Leave ${String(note.title || 'shared note')}`}
                            variant="danger-ghost"
                            size="sm"
                            onClick={() => setConfirmation({ kind: 'leave', id: note.id, title: String(note.title || 'Untitled note') })}
                          />
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
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
              <EmptyState
                icon={Clock}
                title="No pending shares"
                description="New share invitations will appear here."
              />
            ) : pendingInvitations.map((share) => {
              const note = share.notes || share
              const ownerName = String(share.owner_name || share.shared_by || 'A QuickNotes user')
              return (
                <article key={share.id} className="rounded-card border border-warning-border bg-warning-soft p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0 text-warning-text" aria-hidden="true" />
                        <h3 className="truncate font-medium text-content">New share: {String(note.title || 'Untitled note')}</h3>
                      </div>
                      <p className="mb-2 text-ui-md text-content-muted">
                        <span className="font-medium text-content">{ownerName}</span> wants to share this note with you.
                      </p>
                      <Badge>{share.permission === 'edit' ? 'Can edit' : 'Read only'}</Badge>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={CheckCircle}
                        loading={busyShareId === share.id}
                        disabled={!!busyShareId}
                        onClick={() => handleAccept(share.id)}
                      >
                        {busyShareId === share.id ? 'Accepting…' : 'Accept'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={XCircle}
                        disabled={!!busyShareId}
                        onClick={() => setConfirmation({ kind: 'decline', id: share.id, title: String(note.title || 'Untitled note') })}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-control bg-surface-sunken px-3 py-2.5 text-ui-sm text-content-muted">
          <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Edits sync between collaborators. Notes in the owner’s Trash stay unavailable until restored.</span>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        onConfirm={() => confirmation?.kind === 'leave' ? handleLeave(confirmation.id) : handleDecline(confirmation.id)}
        title={confirmation?.kind === 'leave' ? 'Leave shared note?' : 'Decline invitation?'}
        description={confirmation?.kind === 'leave'
          ? `You will lose access to “${confirmation.title}”.`
          : `The invitation to “${confirmation?.title || 'this note'}” will be declined.`}
        confirmLabel={confirmation?.kind === 'leave' ? 'Leave note' : 'Decline'}
      />
    </>
  )
}
