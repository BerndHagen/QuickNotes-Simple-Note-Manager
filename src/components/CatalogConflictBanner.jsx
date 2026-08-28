import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNotesStore } from '../store'

const LABELS = {
  folders: 'folder',
  tags: 'tag',
  saved_views: 'Smart View',
  note_templates: 'template',
}

export default function CatalogConflictBanner() {
  const conflict = useNotesStore((state) => state.catalogConflicts[0] || null)
  const conflictCount = useNotesStore((state) => state.catalogConflicts.length)
  const resolveCatalogConflict = useNotesStore((state) => state.resolveCatalogConflict)
  const [resolving, setResolving] = useState(false)

  if (!conflict) return null
  const label = LABELS[conflict.table] || 'workspace item'
  const remoteDeleted = !conflict.remote

  const resolve = async (choice) => {
    setResolving(true)
    try {
      await resolveCatalogConflict(choice)
    } catch (error) {
      toast.error(error?.message || 'The sync conflict could not be resolved.')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div
      role="alert"
      className="flex min-h-10 flex-wrap items-center gap-2 border-b border-warning-border bg-warning-surface px-3 py-2 text-ui-sm text-warning-text"
    >
      <span className="mr-auto">
        {remoteDeleted
          ? `This ${label} was deleted on another device while you changed it here. Choose whether to accept the deletion or restore your version.`
          : `This ${label} changed here and on another device. Choose which version to keep.`}
        {conflictCount > 1 ? ` ${conflictCount - 1} more conflict${conflictCount === 2 ? '' : 's'} will follow.` : ''}
      </span>
      <button
        type="button"
        className="rounded-control border border-warning-border px-2 py-1 font-medium hover:bg-surface-hover disabled:opacity-60"
        disabled={resolving}
        onClick={() => void resolve('incoming')}
      >
        {remoteDeleted ? 'Accept deletion' : 'Use incoming'}
      </button>
      <button
        type="button"
        className="rounded-control bg-warning-text px-2 py-1 font-medium text-surface hover:opacity-90 disabled:opacity-60"
        disabled={resolving}
        onClick={() => void resolve('local')}
      >
        Keep mine
      </button>
    </div>
  )
}
