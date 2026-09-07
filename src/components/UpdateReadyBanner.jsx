import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useNotesStore } from '../store'

export default function UpdateReadyBanner({ ready }) {
  const [activating, setActivating] = useState(false)
  const persistWorkspace = useNotesStore((state) => state.persistWorkspace)

  if (!ready) return null

  const activate = async () => {
    if (activating) return
    setActivating(true)
    const saved = await persistWorkspace()
    if (!saved) {
      setActivating(false)
      return
    }
    window.dispatchEvent(new CustomEvent('quicknotes:activate-update'))
  }

  return (
    <div role="status" className="qn-update-banner flex shrink-0 items-center gap-2 border-b border-subtle bg-surface-sunken px-3 py-2 text-ui-sm text-content">
      <span className="qn-update-message mr-auto min-w-0">A new QuickNotes build is ready. It will not reload until you choose to update.</span>
      <button
        type="button"
        disabled={activating}
        aria-busy={activating || undefined}
        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-control bg-content px-2 font-medium text-surface hover:opacity-90 disabled:opacity-60"
        onClick={() => void activate()}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${activating ? 'animate-spin' : ''}`} aria-hidden="true" />
        {activating ? 'Preparing update…' : 'Update and reload'}
      </button>
    </div>
  )
}
