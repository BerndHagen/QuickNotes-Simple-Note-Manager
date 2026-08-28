import { AlertTriangle, Download } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'

export default function PersistenceErrorBanner() {
  const error = useNotesStore((state) => state.persistenceError)
  const setExportModalOpen = useUIStore((state) => state.setExportModalOpen)

  if (!error) return null
  const durableWriteFailed = error.source === 'indexeddb'

  return (
    <div
      role="alert"
      className={`flex min-h-10 flex-wrap items-center gap-2 border-b px-3 py-2 text-ui-sm ${
        durableWriteFailed
          ? 'border-danger-border bg-danger-soft text-danger-text'
          : 'border-warning-border bg-warning-surface text-warning-text'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="mr-auto">
        {durableWriteFailed
          ? 'QuickNotes could not save a change to browser storage. Keep this tab open and export a backup before closing it.'
          : 'QuickNotes could not update its small browser cache. Canonical data remains in the local database, but session preferences may not survive reload.'}
      </span>
      <button
        type="button"
        className="inline-flex min-h-8 items-center gap-1.5 rounded-control border border-current px-2 font-medium hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={() => setExportModalOpen(true)}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Export backup
      </button>
    </div>
  )
}
