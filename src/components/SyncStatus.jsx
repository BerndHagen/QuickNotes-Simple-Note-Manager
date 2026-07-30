import { useEffect, useState } from 'react'
import { Check, CloudOff, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { useNotesStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { formatSyncTime } from '../lib/utils'

/**
 * Derives one honest status from the three signals the store exposes.
 *
 * The old UI showed a static "Sync" link whenever the browser was
 * online, regardless of whether anything was actually pending or the
 * last attempt had failed.
 */
export function useSyncStatus() {
  const isOnline = useNotesStore((s) => s.isOnline)
  const isSyncing = useNotesStore((s) => s.isSyncing)
  const lastSyncTime = useNotesStore((s) => s.lastSyncTime)
  const pendingCount = useNotesStore(
    (s) => s.notes.filter((n) => n.syncStatus === 'pending').length
  )

  if (!isOnline) return { state: 'offline', pendingCount, lastSyncTime }
  if (isSyncing) return { state: 'syncing', pendingCount, lastSyncTime }
  if (pendingCount > 0) return { state: 'pending', pendingCount, lastSyncTime }
  return { state: 'synced', pendingCount, lastSyncTime }
}

const CONFIG = {
  synced: { icon: Check, tone: 'text-success-text', key: 'sync.synced', fallback: 'Synced' },
  syncing: { icon: Loader2, tone: 'text-accent-text', key: 'sync.syncing', fallback: 'Syncing…', spin: true },
  pending: { icon: RefreshCw, tone: 'text-warning-text', key: 'sync.pending', fallback: 'Unsynced changes' },
  offline: { icon: CloudOff, tone: 'text-content-subtle', key: 'sync.offline', fallback: 'Offline' },
  error: { icon: AlertTriangle, tone: 'text-danger-text', key: 'sync.error', fallback: 'Sync failed' },
}

/**
 * Compact sync affordance for the sidebar footer.
 *
 * Doubles as the manual "sync now" trigger. The label is not
 * colour-only: the icon changes shape per state as well.
 */
export function SyncStatusPill({ className = '' }) {
  const { t } = useTranslation()
  const { state, pendingCount, lastSyncTime } = useSyncStatus()
  const syncWithBackend = useNotesStore((s) => s.syncWithBackend)
  const config = CONFIG[state]
  const Icon = config.icon
  const label = t(config.key) || config.fallback
  const canSync = state !== 'offline' && state !== 'syncing'

  const title =
    state === 'offline'
      ? t('sync.offlineHint', 'Changes are saved locally and will sync when you reconnect')
      : `${label} · ${formatSyncTime(lastSyncTime)}`

  return (
    <button
      type="button"
      onClick={canSync ? syncWithBackend : undefined}
      disabled={!canSync}
      title={title}
      className={`flex min-w-0 items-center gap-1.5 rounded-control px-1.5 py-1 text-ui-xs font-medium transition-colors duration-fast disabled:cursor-default ${
        canSync ? 'hover:bg-surface-hover' : ''
      } ${config.tone} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${config.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="truncate">
        {label}
        {state === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
      </span>
      {/* Announced to screen readers when the state changes, not on every render. */}
      <span aria-live="polite" className="qn-sr-only">
        {label}
      </span>
    </button>
  )
}

/**
 * "Saved" / "Saving…" indicator for the editor status bar.
 *
 * Shows `Saving…` while a write is in flight and settles to `Saved`
 * with the timestamp, mirroring what the note list already knows.
 */
export function SaveStatus({ note, className = '' }) {
  const { t } = useTranslation()
  const [justSaved, setJustSaved] = useState(false)
  const pending = note?.syncStatus === 'pending'

  useEffect(() => {
    if (pending) return
    setJustSaved(true)
    const timer = setTimeout(() => setJustSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [pending, note?.updatedAt])

  if (!note) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-ui-sm ${
        pending ? 'text-content-muted' : 'text-success-text'
      } ${className}`}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">
        {pending ? t('editor.saving', 'Saving…') : t('editor.saved', 'Saved')}
      </span>
      {!pending && !justSaved && (
        <span className="hidden text-content-subtle sm:inline">
          · {formatSyncTime(note.updatedAt)}
        </span>
      )}
    </span>
  )
}
