import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, MessageSquare, RefreshCw, Trash2 } from 'lucide-react'
import {
  createNoteComment,
  deleteNoteComment,
  getNoteComments,
  getNoteParticipants,
  subscribeToNoteComments,
} from '../../lib/backend'
import { Button, EmptyState, IconButton, Modal, Spinner, Textarea } from '../ui'

const formatCommentTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function NoteCommentsModal({ open, onClose, note, currentUserId, anchorId = null, objectId = null }) {
  const [comments, setComments] = useState([])
  const [participants, setParticipants] = useState([])
  const [draft, setDraft] = useState('')
  const [mentionedIds, setMentionedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const generationRef = useRef(0)

  const load = useCallback(async ({ preserve = false } = {}) => {
    if (!open || !note?.id) return
    const generation = generationRef.current + 1
    generationRef.current = generation
    if (!preserve) setLoading(true)
    setError('')
    try {
      const [nextComments, nextParticipants] = await Promise.all([
        getNoteComments(note.id),
        getNoteParticipants(note.id),
      ])
      if (generationRef.current !== generation) return
      setComments(nextComments)
      setParticipants(nextParticipants)
    } catch (loadError) {
      if (generationRef.current === generation) {
        setError(loadError?.message || 'Comments could not be loaded.')
      }
    } finally {
      if (generationRef.current === generation) setLoading(false)
    }
  }, [note?.id, open])

  useEffect(() => {
    if (!open || !note?.id) {
      generationRef.current += 1
      return undefined
    }
    setDraft('')
    setMentionedIds(new Set())
    void load()
    const channel = subscribeToNoteComments(note.id, () => { void load({ preserve: true }) })
    return () => {
      generationRef.current += 1
      channel.unsubscribe()
    }
  }, [load, note?.id, open])

  const mentionable = useMemo(
    () => participants.filter((participant) => participant.user_id !== currentUserId),
    [currentUserId, participants]
  )

  const handleDraftChange = (event) => {
    const next = event.target.value
    setDraft(next)
    setMentionedIds((current) => new Set([...current].filter((id) => {
      const participant = participants.find((candidate) => candidate.user_id === id)
      return participant && next.includes(`@${participant.username}`)
    })))
  }

  const addMention = (participant) => {
    const token = `@${participant.username}`
    setMentionedIds((current) => new Set([...current, participant.user_id]))
    setDraft((current) => current.includes(token)
      ? current
      : `${current}${current && !/\s$/u.test(current) ? ' ' : ''}${token} `)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const submit = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await createNoteComment({
        noteId: note.id,
        body,
        mentionedUserIds: [...mentionedIds],
        anchorId,
        objectId,
      })
      setDraft('')
      setMentionedIds(new Set())
      await load({ preserve: true })
    } catch (submitError) {
      setError(submitError?.message || 'The comment could not be posted.')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (commentId) => {
    setError('')
    try {
      await deleteNoteComment(commentId)
      await load({ preserve: true })
    } catch (deleteError) {
      setError(deleteError?.message || 'The comment could not be removed.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Comments"
      description={note?.title?.trim() || 'Untitled note'}
      icon={MessageSquare}
      size="xl"
      initialFocusRef={textareaRef}
      bodyPadding="none"
    >
      <div className="flex min-h-[28rem] flex-col">
        <section aria-label="Comment thread" className="min-h-0 flex-1 border-b border-subtle bg-surface px-5 py-4 sm:px-6">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center" role="status">
              <Spinner />
              <span className="qn-sr-only">Loading comments</span>
            </div>
          ) : error && comments.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center" role="alert">
              <p className="max-w-sm text-ui-md text-danger-text">{error}</p>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => void load()}>Retry</Button>
            </div>
          ) : comments.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No comments yet"
              description="Add context for the people who can access this note."
              className="min-h-48"
            />
          ) : (
            <ol className="divide-y divide-subtle">
              {comments.map((comment) => {
                const canDelete = comment.author_id === currentUserId || !note.isShared
                return (
                  <li key={comment.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-ui-xs font-semibold text-accent-text" aria-hidden="true">
                        {(comment.author_username || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-ui-md font-semibold text-content">{comment.author_username}</span>
                          <time className="text-ui-xs text-content-subtle" dateTime={comment.created_at}>{formatCommentTime(comment.created_at)}</time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-ui-md text-content">{comment.body}</p>
                        {(comment.anchor_id || comment.object_id) && (
                          <p className="mt-1 text-ui-xs text-content-muted">
                            Anchored to {comment.object_id ? 'workspace object' : 'document section'}
                          </p>
                        )}
                        {comment.mentioned_usernames?.length > 0 && (
                          <p className="mt-1 text-ui-xs text-content-muted">Notified {comment.mentioned_usernames.map((name) => `@${name}`).join(', ')}</p>
                        )}
                      </div>
                      {canDelete && (
                        <IconButton icon={Trash2} label="Delete comment" size="sm" variant="danger-ghost" onClick={() => void remove(comment.id)} />
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <form onSubmit={submit} className="shrink-0 space-y-3 bg-surface-panel px-5 py-4 sm:px-6">
          {error && comments.length > 0 && <p role="alert" className="text-ui-sm text-danger-text">{error}</p>}
          <label className="block text-ui-sm font-medium text-content" htmlFor="qn-comment-draft">Add a comment</label>
          <Textarea
            id="qn-comment-draft"
            ref={textareaRef}
            value={draft}
            onChange={handleDraftChange}
            maxLength={4000}
            rows={3}
            placeholder="Write a comment…"
          />
          <div className="flex flex-wrap items-center gap-2">
            {mentionable.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Mention a participant">
                <AtSign className="h-3.5 w-3.5 text-content-subtle" aria-hidden="true" />
                {mentionable.map((participant) => (
                  <button
                    key={participant.user_id}
                    type="button"
                    onClick={() => addMention(participant)}
                    className="rounded-control border border-subtle bg-surface-raised px-2 py-1 text-ui-xs text-content-muted hover:bg-surface-hover hover:text-content"
                  >
                    @{participant.username}
                  </button>
                ))}
              </div>
            )}
            <span className="ml-auto text-ui-xs text-content-subtle">{draft.length}/4000</span>
            <Button type="submit" size="sm" variant="primary" loading={submitting} disabled={!draft.trim()}>
              Comment
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
