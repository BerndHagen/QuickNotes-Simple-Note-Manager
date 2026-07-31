import { forwardRef, useMemo } from 'react'
import { Pin, Star } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { formatNoteDate, htmlToPlainText, truncateText, getNoteTypePreview } from '../lib/utils'
import { getFolderIcon } from '../lib/folderIcons'
import { TagChip } from './ui'

const CLAMP = { 0: 'hidden', 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' }

/**
 * A single row in the note list.
 *
 * Rendered as a real `<button>` inside a `<li>` so the list is
 * navigable with Tab and operable with Enter/Space. `aria-current`
 * communicates which note the editor is showing.
 *
 * Honours the `notePreviewLines`, `compactMode` and `dateFormat` settings.
 */
const NoteCard = forwardRef(function NoteCard(
  {
    note,
    isSelected,
    isMultiSelected,
    onClick,
    onContextMenu,
    onMouseEnter,
    onMouseLeave,
    isDragging,
    dragHandle,
  },
  ref
) {
  const tags = useNotesStore((s) => s.tags)
  const folders = useNotesStore((s) => s.folders)
  const toggleStar = useNotesStore((s) => s.toggleStar)
  const { language } = useTranslation()
  const notePreviewLines = useUIStore((s) => s.notePreviewLines)
  const compactMode = useUIStore((s) => s.compactMode)
  const dateFormat = useUIStore((s) => s.dateFormat)

  const preview = useMemo(() => {
    const special = getNoteTypePreview(note, 140)
    if (special) return special
    return truncateText(htmlToPlainText(note.content), 140)
  }, [note])

  const tagColor = (name) => tags.find((t) => t.name === name)?.color || '#6b7280'
  const folder = note.folderId ? folders.find((f) => f.id === note.folderId) : null
  const FolderIcon = getFolderIcon(folder?.icon)
  const visibleTags = note.tags?.slice(0, 3) || []
  const extraTags = (note.tags?.length || 0) - visibleTags.length

  return (
    <li className="relative px-3 py-1">
      {dragHandle}
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-current={isSelected ? 'true' : undefined}
        aria-pressed={isMultiSelected || undefined}
        className={[
          'note-card relative flex w-full flex-col gap-1.5 rounded-card border text-left transition-colors duration-fast',
          compactMode ? 'px-3 py-2' : 'px-3.5 py-3',
          isSelected
            ? 'border-[var(--qn-accent-border)] bg-accent-soft'
            : isMultiSelected
              ? 'border-[var(--qn-info-border)] bg-info-soft'
              : 'border-subtle bg-surface-raised hover:border-strong',
          isDragging ? 'opacity-50' : '',
        ].join(' ')}
      >
        {/* The pin indicator and the star control share one corner, so the
            title reserves that width rather than running underneath them. */}
        <div className="flex items-start gap-2">
          <h3
            className={`min-w-0 flex-1 truncate pr-11 font-semibold text-content ${
 compactMode ? 'text-ui-md' : 'text-title-xs'
 }`}
          >
            {note.title || 'Untitled note'}
          </h3>
        </div>

        {notePreviewLines > 0 && (
          <p
            className={`text-ui-md leading-relaxed text-content-muted ${
 CLAMP[notePreviewLines] || CLAMP[2]
 }`}
          >
            {preview || 'Empty note'}
          </p>
        )}

        {!compactMode && visibleTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {visibleTags.map((tag) => (
              <TagChip key={tag} name={tag} color={tagColor(tag)} />
            ))}
            {extraTags > 0 && (
              <span className="text-ui-xs font-medium text-content-subtle">+{extraTags}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-ui-xs font-medium text-content-subtle">
          <time dateTime={note.updatedAt} className="shrink-0 tabular-nums">
            {formatNoteDate(note.updatedAt, language, dateFormat)}
          </time>
          {folder && (
            <span className="flex min-w-0 items-center gap-1">
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <FolderIcon
                className="h-3 w-3 shrink-0"
                style={{ color: folder.color }}
                aria-hidden="true"
              />
              <span className="truncate">{folder.name}</span>
            </span>
          )}
        </div>
      </button>

      {/* The star sits outside the card button: nesting interactive elements is
          invalid HTML and breaks screen-reader navigation. The pin rides along
          so the two never land on the same pixels. */}
      <div
        className={`absolute right-3.5 flex items-center gap-1 ${compactMode ? 'top-2' : 'top-3'}`}
      >
        {note.pinned && (
          <>
            <Pin className="h-3 w-3 shrink-0 fill-current text-accent" aria-hidden="true" />
            <span className="qn-sr-only">Pinned</span>
          </>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleStar(note.id)
          }}
          aria-label={
            note.starred ? `Remove ${note.title} from favourites` : `Add ${note.title} to favourites`
          }
          aria-pressed={!!note.starred}
          className={`qn-inline-target flex h-6 w-6 items-center justify-center rounded-control transition-colors duration-fast hover:bg-surface-active ${
            note.starred ? 'text-warning' : 'text-content-subtle opacity-60 hover:opacity-100'
          }`}
        >
          <Star
            className={`h-3.5 w-3.5 ${note.starred ? 'fill-current text-warning' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </li>
  )
})

export default NoteCard
