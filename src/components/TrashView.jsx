import { useMemo, useState } from 'react'
import { AlertTriangle, Clock, RotateCcw, Trash2 } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { formatDate, htmlToPlainText, truncateText } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import { Button, EmptyState, IconButton, Modal } from './ui'
import { ConfirmDialog } from './FolderDialogs'

export default function TrashView() {
  const { t, language } = useTranslation()
  const { notes, restoreNote, permanentlyDeleteNote } = useNotesStore()
  const { showTrash, setShowTrash } = useUIStore()
  const [deleteTarget, setDeleteTarget] = useState(null)

  const trashedNotes = useMemo(
    () =>
      notes
        .filter((note) => note.deleted)
        .sort((first, second) => new Date(second.deletedAt) - new Date(first.deletedAt)),
    [notes]
  )

  const getDaysRemaining = (deletedAt) => {
    const expiryDate = new Date(new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    const daysRemaining = Math.ceil((expiryDate - new Date()) / (24 * 60 * 60 * 1000))
    return Math.max(0, Number.isFinite(daysRemaining) ? daysRemaining : 0)
  }

  const closeTrash = () => {
    setDeleteTarget(null)
    setShowTrash(false)
  }

  const handleRestoreAll = () => {
    trashedNotes.forEach((note) => restoreNote(note.id))
  }

  const handleEmptyTrash = () => {
    trashedNotes.forEach((note) => permanentlyDeleteNote(note.id))
  }

  const handlePermanentDelete = () => {
    if (deleteTarget?.id) permanentlyDeleteNote(deleteTarget.id)
  }

  const countLabel = `${trashedNotes.length} ${trashedNotes.length === 1 ? 'note' : 'notes'} · ${t(
    'trash.autoDelete'
  )}`

  return (
    <>
      <Modal
        open={showTrash}
        onClose={closeTrash}
        title={t('trash.title')}
        description={countLabel}
        icon={Trash2}
        size="xl"
        bodyClassName="!overflow-hidden bg-surface-raised p-0 sm:p-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          {trashedNotes.length > 0 && (
            <div className="flex shrink-0 flex-col gap-2 border-b border-subtle bg-surface-raised px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Button
                variant="primary"
                size="sm"
                icon={RotateCcw}
                fullWidth
                className="sm:w-auto"
                onClick={handleRestoreAll}
              >
                {t('trash.restoreAll')}
              </Button>
              <Button
                variant="danger-ghost"
                size="sm"
                icon={Trash2}
                fullWidth
                className="sm:w-auto"
                onClick={() => setDeleteTarget({ all: true })}
              >
                {t('trash.emptyTrash')}
              </Button>
            </div>
          )}

          <div
            role="region"
            aria-label={t('trash.title')}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)]"
          >
            {trashedNotes.length === 0 ? (
              <EmptyState
                icon={Trash2}
                title={t('trash.empty')}
                description={t('trash.emptyDescription')}
              />
            ) : (
              <ul className="space-y-2 p-3 sm:p-4">
                {trashedNotes.map((note) => {
                  const daysRemaining = getDaysRemaining(note.deletedAt)
                  const preview = truncateText(htmlToPlainText(note.content), 100)
                  const title = note.title || t('notes.untitled', 'Untitled note')
                  const headingId = `qn-trashed-note-${note.id}`

                  return (
                    <li key={note.id} className="rounded-card border border-subtle bg-surface-raised p-4 shadow-xs transition-[border-color,box-shadow] hover:border-strong hover:shadow-sm">
                      <article aria-labelledby={headingId}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 id={headingId} className="truncate text-ui-lg font-semibold text-content">
                              {title}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-ui-md text-content-muted">
                              {preview || t('notes.noPreview')}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-ui-xs text-content-muted">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                {t('trash.deleted')} {formatDate(note.deletedAt, language)}
                              </span>
                              <span
                                className={`flex items-center gap-1.5 ${
                                  daysRemaining <= 7 ? 'font-medium text-danger-text' : ''
                                }`}
                              >
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                {daysRemaining} {t('trash.daysLeft')}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-end gap-2">
                            <IconButton
                              icon={RotateCcw}
                              size="sm"
                              label={`${t('common.restore')} ${title}`}
                              onClick={() => restoreNote(note.id)}
                            />
                            <IconButton
                              icon={Trash2}
                              size="sm"
                              variant="danger-ghost"
                              label={`${t('trash.permanentDelete')}: ${title}`}
                              onClick={() => setDeleteTarget({ id: note.id, title })}
                            />
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showTrash && !!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTarget?.all ? handleEmptyTrash : handlePermanentDelete}
        title={deleteTarget?.all ? t('trash.emptyTrash') : t('trash.permanentDelete')}
        description={
          deleteTarget?.all
            ? t('trash.emptyTrashConfirm')
            : `${t('trash.permanentDeleteConfirm')} “${deleteTarget?.title || ''}”`
        }
        confirmLabel={deleteTarget?.all ? t('trash.emptyTrash') : t('trash.permanentDelete')}
      />
    </>
  )
}
