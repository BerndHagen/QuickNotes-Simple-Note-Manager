import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Link2, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotesStore, useUIStore } from '../store'
import { backend } from '../lib/backend'
import { createShareUrl } from '../lib/webUrls'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Spinner,
} from './ui'
import { ConfirmDialog } from './FolderDialogs'

export function validateShareEmail(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!normalized) return { value: '', error: 'Enter the person’s email address.' }
  if (normalized.length > 254) return { value: '', error: 'Enter an email address under 255 characters.' }

  const [local, domain, ...extra] = normalized.split('@')
  const valid =
    !extra.length &&
    Boolean(local) &&
    local.length <= 64 &&
    Boolean(domain) &&
    domain.includes('.') &&
    !local.startsWith('.') &&
    !local.endsWith('.') &&
    !local.includes('..') &&
    !domain.startsWith('.') &&
    !domain.endsWith('.') &&
    !domain.includes('..') &&
    /^[^\s@]+$/.test(local) &&
    /^[a-z\d.-]+$/i.test(domain)

  return valid
    ? { value: normalized, error: '' }
    : { value: '', error: 'Enter a valid email address.' }
}

const shareStatus = {
  pending: { label: 'Pending', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
}

export default function ShareNoteModal() {
  const { shareModalOpen, shareNoteId, setShareModalOpen } = useUIStore()
  const { notes, shareNote, removeShare, loadSharedNotes } = useNotesStore()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [permission, setPermission] = useState('edit')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shares, setShares] = useState([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [sharesError, setSharesError] = useState('')
  const [copiedToken, setCopiedToken] = useState(null)
  const [manualCopyToken, setManualCopyToken] = useState(null)
  const [shareToRemove, setShareToRemove] = useState(null)
  const loadGenerationRef = useRef(0)
  const copyTimerRef = useRef(null)
  const emailInputRef = useRef(null)

  const note = notes.find((candidate) => candidate.id === shareNoteId)

  const loadShares = useCallback(
    async ({ clear = true } = {}) => {
      if (!shareNoteId) return false

      const generation = loadGenerationRef.current + 1
      loadGenerationRef.current = generation
      if (clear) setShares([])
      setSharesLoading(true)
      setSharesError('')

      try {
        const { data, error } = await backend
          .from('shared_notes')
          .select('id,email,permission,status,share_link,created_at')
          .eq('note_id', shareNoteId)

        if (error) throw error
        if (loadGenerationRef.current !== generation) return false
        setShares(data || [])
        return true
      } catch (error) {
        if (loadGenerationRef.current === generation) {
          setSharesError(`Sharing details could not be loaded: ${error.message || 'Unknown error'}`)
        }
        return false
      } finally {
        if (loadGenerationRef.current === generation) setSharesLoading(false)
      }
    },
    [shareNoteId]
  )

  useEffect(() => {
    if (!shareModalOpen || !shareNoteId) {
      loadGenerationRef.current += 1
      return undefined
    }

    setEmail('')
    setEmailError('')
    setFormError('')
    setPermission('edit')
    setCopiedToken(null)
    setManualCopyToken(null)
    setShareToRemove(null)
    void loadShares()

    return () => {
      loadGenerationRef.current += 1
    }
  }, [loadShares, shareModalOpen, shareNoteId])

  useEffect(() => {
    if (shareModalOpen && shareNoteId && !note) setShareModalOpen(false)
  }, [note, setShareModalOpen, shareModalOpen, shareNoteId])

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    },
    []
  )

  const handleClose = () => {
    loadGenerationRef.current += 1
    setShareModalOpen(false)
    setEmailError('')
    setFormError('')
    setManualCopyToken(null)
    setShareToRemove(null)
  }

  const handleShare = async (event) => {
    event.preventDefault()
    if (isSubmitting || !shareNoteId) return

    const validatedEmail = validateShareEmail(email)
    if (!validatedEmail.value) {
      setEmailError(validatedEmail.error)
      emailInputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    setEmailError('')
    setFormError('')
    try {
      await shareNote(shareNoteId, validatedEmail.value, permission)
      setEmail('')
      await loadShares({ clear: false })
      await loadSharedNotes()
    } catch (error) {
      setFormError(error.message || 'The invitation could not be created.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyLink = async (share) => {
    const shareUrl = createShareUrl(share.share_link)
    if (!shareUrl) {
      toast.error('This invitation does not have a valid share link.')
      return
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(shareUrl)
      setCopiedToken(share.share_link)
      setManualCopyToken(null)
      toast.success('Share link copied')
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedToken(null), 2000)
    } catch {
      setCopiedToken(null)
      setManualCopyToken(share.share_link)
      toast.error('Clipboard access was blocked. Select and copy the link below.')
    }
  }

  const handleRemoveShare = async () => {
    if (!shareToRemove) return
    await removeShare(shareToRemove.id)
    await loadShares({ clear: false })
    await loadSharedNotes()
  }

  if (!shareModalOpen || !note) return null

  const formId = 'qn-share-note-form'

  return (
    <>
      <Modal
        open={shareModalOpen}
        onClose={handleClose}
        title="Share note"
        description={note.title?.trim() || 'Untitled note'}
        icon={Users}
        size="xl"
        initialFocusRef={emailInputRef}
        footer={
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Done
          </Button>
        }
      >
        <div className="space-y-6">
          <section aria-labelledby="add-person-heading" className="space-y-4">
            <div>
              <h3
                id="add-person-heading"
                className="flex items-center gap-2 text-title-xs font-semibold text-content"
              >
                <UserPlus className="h-4 w-4 text-accent-text" aria-hidden="true" />
                Invite someone
              </h3>
              <p className="mt-1 text-ui-md text-content-muted">
                Access is tied to the invited email account, not just the link.
              </p>
            </div>

            <form id={formId} onSubmit={handleShare} className="space-y-4" noValidate>
              <Field label="Email address" error={emailError} required>
                {(fieldProps) => (
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
                      aria-hidden="true"
                    />
                    <Input
                      {...fieldProps}
                      ref={emailInputRef}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      maxLength={254}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        setEmailError('')
                        setFormError('')
                      }}
                      onBlur={() => {
                        if (email.trim()) setEmailError(validateShareEmail(email).error)
                      }}
                      placeholder="person@example.com"
                      disabled={isSubmitting}
                      className="pl-9"
                    />
                  </div>
                )}
              </Field>

              <fieldset>
                <legend className="mb-2 text-ui-sm font-medium text-content-muted">Permission</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    {
                      value: 'view',
                      title: 'Read only',
                      description: 'Can view the note but cannot change it.',
                    },
                    {
                      value: 'edit',
                      title: 'Can edit',
                      description: 'Can update the note and collaborate with you.',
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--qn-focus-ring)] ${
                        permission === option.value
                          ? 'border-accent bg-accent-soft'
                          : 'border-strong bg-surface-raised hover:bg-surface-hover'
                      }`}
                    >
                      <input
                        type="radio"
                        name="share-permission"
                        value={option.value}
                        checked={permission === option.value}
                        onChange={(event) => setPermission(event.target.value)}
                        disabled={isSubmitting}
                        className="mt-0.5 h-4 w-4 accent-[var(--qn-accent)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-ui-md font-medium text-content">{option.title}</span>
                        <span className="mt-0.5 block text-ui-sm text-content-muted">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {formError && (
                <p
                  role="alert"
                  className="rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-ui-md text-danger-text"
                >
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                icon={UserPlus}
                loading={isSubmitting}
                disabled={!email.trim()}
                fullWidth
              >
                Create invitation
              </Button>
            </form>
          </section>

          <section aria-labelledby="people-with-access-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3
                id="people-with-access-heading"
                className="flex items-center gap-2 text-title-xs font-semibold text-content"
              >
                <Users className="h-4 w-4 text-accent-text" aria-hidden="true" />
                People with access
              </h3>
              {!sharesLoading && !sharesError && (
                <span className="text-ui-sm tabular-nums text-content-subtle">
                  {shares.length} {shares.length === 1 ? 'person' : 'people'}
                </span>
              )}
            </div>

            {sharesLoading ? (
              <div className="flex min-h-28 items-center justify-center rounded-card border border-subtle bg-surface-sunken">
                <Spinner label="Loading sharing details" />
              </div>
            ) : sharesError ? (
              <div
                role="alert"
                className="rounded-card border border-danger-border bg-danger-soft p-4 text-ui-md text-danger-text"
              >
                <p>{sharesError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => void loadShares()}
                >
                  Try again
                </Button>
              </div>
            ) : shares.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Users}
                title="No invitations yet"
                description="Invite someone above to give them access to this note."
                className="min-h-40 rounded-card border border-subtle bg-surface-sunken"
              />
            ) : (
              <div className="space-y-2">
                {shares.map((share) => {
                  const status = shareStatus[share.status] || {
                    label: 'Status unknown',
                    tone: 'neutral',
                  }
                  const manualUrl =
                    manualCopyToken === share.share_link ? createShareUrl(share.share_link) : ''

                  return (
                    <article
                      key={share.id}
                      className="rounded-card border border-subtle bg-surface-sunken p-3"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                          <Mail className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-ui-md font-medium text-content">{share.email}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge>{share.permission === 'edit' ? 'Can edit' : 'Read only'}</Badge>
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            icon={copiedToken === share.share_link ? Link2 : Copy}
                            label={
                              copiedToken === share.share_link
                                ? `Link copied for ${share.email}`
                                : `Copy share link for ${share.email}`
                            }
                            onClick={() => void handleCopyLink(share)}
                          />
                          <IconButton
                            icon={Trash2}
                            label={`Remove access for ${share.email}`}
                            variant="danger-ghost"
                            onClick={() => setShareToRemove(share)}
                          />
                        </div>
                      </div>

                      {manualUrl && (
                        <Field
                          label={`Share link for ${share.email}`}
                          hint="Select the link and copy it manually."
                          className="mt-3"
                        >
                          {(fieldProps) => (
                            <Input
                              {...fieldProps}
                              readOnly
                              value={manualUrl}
                              onFocus={(event) => event.currentTarget.select()}
                            />
                          )}
                        </Field>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <div className="flex items-start gap-2.5 rounded-card border border-info-border bg-info-soft p-3 text-ui-md text-info-text">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Send the generated link to the invited person. They must sign in with that email to
              accept; removing access invalidates the invitation.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(shareToRemove)}
        onClose={() => setShareToRemove(null)}
        onConfirm={handleRemoveShare}
        title="Remove access?"
        description={
          shareToRemove ? `${shareToRemove.email} will immediately lose access to this note.` : ''
        }
        confirmLabel="Remove access"
        icon={Trash2}
      />
    </>
  )
}
