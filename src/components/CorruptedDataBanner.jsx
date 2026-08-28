import { AlertTriangle, Download } from 'lucide-react'
import { useNotesStore } from '../store'
import { createRawRecoveryExport } from '../lib/recovery'

const downloadRecovery = (records, ownerId) => {
  const payload = createRawRecoveryExport(records, { ownerId })
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `quicknotes-raw-recovery-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function CorruptedDataBanner() {
  const records = useNotesStore((state) => state.corruptedNotes)
  const ownerId = useNotesStore((state) => state.cacheOwnerId)
  if (!records?.length) return null

  return (
    <section
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-warning-border bg-warning-soft px-4 py-2 text-ui-sm text-warning-text"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        {records.length === 1 ? 'One note was' : `${records.length} notes were`} isolated because the stored data could not be opened safely. The original recovery data was not deleted.
      </p>
      <button
        type="button"
        className="inline-flex min-h-8 items-center gap-2 rounded-control border border-warning-border bg-surface-raised px-3 font-medium hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={() => downloadRecovery(records, ownerId)}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export raw recovery data
      </button>
    </section>
  )
}
