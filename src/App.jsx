import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import ReminderModal from './components/ReminderModal'
import { ThemeProvider } from './components/ThemeProvider'
import AuthScreen from './components/AuthScreen'
import { useNotesStore, useUIStore } from './store'
import { onConnectionChange } from './lib/utils'
import { backend, isBackendConfigured } from './lib/backend'
import { createLocalUser, hasLocalSession } from './lib/localSession'
import { useShareInvitations } from './lib/useCollaboration'
import { useAppShortcuts } from './lib/shortcuts'
import { useLayoutMode } from './hooks/useBreakpoint'
import { PanelLeft, CloudOff } from 'lucide-react'
import { IconButton, Spinner, useEscapeKey, useFocusTrap } from './components/ui'

const MOBILE_HISTORY_SURFACE_KEYS = [
  'focusModeOpen',
  'editorSettingsOpen',
  'htmlEditorOpen',
  'imageUploadOpen',
  'linkModalOpen',
  'findReplaceOpen',
  'sharedNotesViewOpen',
  'shareModalOpen',
  'translateModalOpen',
  'tagManagerOpen',
  'termsModalOpen',
  'privacyModalOpen',
  'helpModalOpen',
  'noteTypesModalOpen',
  'shortcutsModalOpen',
  'archiveViewOpen',
  'globalSearchOpen',
  'duplicateModalOpen',
  'versionHistoryOpen',
  'showTrash',
  'reminderModalOpen',
  'importModalOpen',
  'exportModalOpen',
  'settingsOpen',
  'quickNoteOpen',
]

const selectMobileHistorySurface = (state) =>
  MOBILE_HISTORY_SURFACE_KEYS.find((key) => state[key]) || null

const restoreMobileHistorySurface = (surface) => {
  const nextState = Object.fromEntries(MOBILE_HISTORY_SURFACE_KEYS.map((key) => [key, false]))
  if (MOBILE_HISTORY_SURFACE_KEYS.includes(surface)) nextState[surface] = true
  useUIStore.setState(nextState)
}

const NoteEditor = lazy(() => import('./components/NoteEditor'))
const NotesList = lazy(() => import('./components/NotesList'))
const NotesGrid = lazy(() => import('./components/NotesGrid'))
const PasswordRecoveryScreen = lazy(() => import('./components/PasswordRecoveryScreen'))
const QuickNoteModal = lazy(() => import('./components/QuickNoteModal'))
const SettingsModal = lazy(() => import('./components/SettingsModal'))
const ExportModal = lazy(() => import('./components/ExportModal'))
const ImportModal = lazy(() => import('./components/ImportModal'))
const TrashView = lazy(() => import('./components/TrashView'))
const VersionHistoryModal = lazy(() => import('./components/VersionHistoryModal'))
const DuplicateDetectionModal = lazy(() => import('./components/DuplicateDetectionModal'))
const GlobalSearchModal = lazy(() => import('./components/GlobalSearchModal'))
const FocusMode = lazy(() => import('./components/FocusMode'))
const ArchiveView = lazy(() => import('./components/ArchiveView'))
const ShareNoteModal = lazy(() => import('./components/ShareNoteModal'))
const SharedNotesView = lazy(() => import('./components/SharedNotesView'))
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal'))
const NoteTypesModal = lazy(() => import('./components/NoteTypesModal'))
const HelpModal = lazy(() => import('./components/HelpModal'))
const PrivacyModal = lazy(() => import('./components/PrivacyModal'))
const TermsModal = lazy(() => import('./components/TermsModal'))
const TagManagerModal = lazy(() => import('./components/TagManagerModal'))
const TranslateModal = lazy(() => import('./components/TranslateModal'))
const EditorSettingsModal = lazy(() => import('./components/EditorSettingsModal'))

function AppLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-app">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" label="Loading your workspace" />
        <div className="text-center">
          <p className="text-ui-lg font-semibold text-content">QuickNotes</p>
          <p className="mt-1 text-ui-md text-content-muted">Loading your workspace…</p>
        </div>
      </div>
    </div>
  )
}

function DeferredSurfaceFallback() {
  return (
    <div
      role="status"
      className="fixed inset-0 z-dialog flex items-center justify-center bg-[var(--qn-overlay)]"
    >
      <div className="rounded-card border border-subtle bg-surface-raised px-5 py-4 shadow-lg">
        <Spinner label="Loading this view" />
      </div>
    </div>
  )
}

function EditorLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-raised">
      <Spinner label="Loading the editor" />
    </div>
  )
}

export default function App() {
  const {
    notes,
    selectedNoteId,
    setSelectedNote,
    setIsOnline,
    syncWithBackend,
    isOnline,
    user,
    activateCloudUser,
    activateLocalUser,
    deactivateWorkspace,
    setIsAuthChecked,
  } = useNotesStore()
  const {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    setNoteTypesModalOpen,
    setFindReplaceOpen,
    setExportModalOpen,
    setImportModalOpen,
    setGlobalSearchOpen,
    setFocusModeOpen,
    focusModeOpen,
    setShortcutsModalOpen,
    setSettingsOpen,
    setQuickNoteOpen,
    setLinkModalOpen,
    mobileView,
    setMobileView,
    viewMode,
    quickNoteOpen,
    settingsOpen,
    exportModalOpen,
    importModalOpen,
    showTrash,
    versionHistoryOpen,
    duplicateModalOpen,
    globalSearchOpen,
    archiveViewOpen,
    shortcutsModalOpen,
    noteTypesModalOpen,
    helpModalOpen,
    privacyModalOpen,
    termsModalOpen,
    tagManagerOpen,
    translateModalOpen,
    shareModalOpen,
    sharedNotesViewOpen,
    editorSettingsOpen,
  } = useUIStore()
  const modalHistorySurface = useUIStore(selectMobileHistorySurface)

  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const { isCompact, isWide, sidebarIsOverlay } = useLayoutMode()
  const sidebarToggleRef = useRef(null)
  const sidebarRef = useRef(null)
  const mobileHistoryReadyRef = useRef(false)
  const sidebarOverlayOpen = Boolean(user && sidebarIsOverlay && sidebarOpen)
  const mobileHistorySurface = modalHistorySurface || (sidebarOverlayOpen ? 'sidebar' : null)

  useShareInvitations()

  useEffect(() => {
    if (!user || !sidebarIsOverlay) {
      mobileHistoryReadyRef.current = false
      return undefined
    }

    const handlePopState = (event) => {
      if (isCompact) {
        setMobileView(event.state?.qnMobileView === 'editor' ? 'editor' : 'notes')
      }
      const surface = event.state?.qnMobileSurface || null
      restoreMobileHistorySurface(surface)
      setSidebarOpen(surface === 'sidebar')
    }
    window.addEventListener('popstate', handlePopState)

    // The persisted desktop sidebar starts open. Let the responsive sidebar
    // effect close it before history tracking begins, so loading on a phone
    // never creates a phantom drawer entry.
    const readyFrame = requestAnimationFrame(() => {
      const state = window.history.state || {}
      const nextState = { ...state }
      delete nextState.qnMobileSurface
      if (isCompact && !nextState.qnMobileView) nextState.qnMobileView = 'notes'
      window.history.replaceState(nextState, document.title)
      if (isCompact) {
        setMobileView(nextState.qnMobileView === 'editor' ? 'editor' : 'notes')
      }
      mobileHistoryReadyRef.current = true
    })

    return () => {
      cancelAnimationFrame(readyFrame)
      mobileHistoryReadyRef.current = false
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isCompact, setMobileView, setSidebarOpen, sidebarIsOverlay, user])

  useEffect(() => {
    if (!mobileHistoryReadyRef.current) return
    const state = window.history.state || {}
    const currentSurface = state.qnMobileSurface || null
    if (currentSurface === mobileHistorySurface) return

    if (mobileHistorySurface) {
      const nextState = { ...state, qnMobileSurface: mobileHistorySurface }
      if (currentSurface) window.history.replaceState(nextState, document.title)
      else window.history.pushState(nextState, document.title)
      return
    }

    if (currentSurface) window.history.back()
  }, [mobileHistorySurface])

  useEffect(() => {
    if (!mobileHistoryReadyRef.current || mobileView !== 'editor') return
    if (window.history.state?.qnMobileView === 'editor') return
    window.history.pushState(
      { ...(window.history.state || {}), qnMobileView: 'editor' },
      document.title
    )
  }, [mobileView])

  useEffect(() => {
    let disposed = false

    const finishSessionCheck = () => {
      if (disposed) return
      setIsAuthChecked(true)
      setIsLoading(false)
    }

    const activateStoredLocalWorkspace = async () => {
      if (hasLocalSession()) await activateLocalUser(createLocalUser())
    }

    if (!isBackendConfigured()) {
      void activateStoredLocalWorkspace().finally(finishSessionCheck)
      return () => {
        disposed = true
      }
    }

    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await backend.auth.getSession()
        if (session?.user) await activateCloudUser(session.user, { adoptUnowned: true })
        // A local workspace outlives a reload even on a cloud-capable build.
        else await activateStoredLocalWorkspace()
      } catch {
        await activateStoredLocalWorkspace()
      } finally {
        finishSessionCheck()
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = backend.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session?.user) {
        if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
        // Supabase advises deferring additional client work outside the auth callback.
        setTimeout(() => {
          void activateCloudUser(session.user)
        }, 0)
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false)
        setTimeout(() => {
          void deactivateWorkspace()
        }, 0)
      }
    })

    return () => {
      disposed = true
      subscription?.unsubscribe()
    }
  }, [activateCloudUser, activateLocalUser, deactivateWorkspace, setIsAuthChecked])

  useEffect(() => {
    if (user) useNotesStore.getState().cleanupExpiredTrash()
  }, [user])

  useEffect(() => {
    const preventNativeContextMenu = (event) => event.preventDefault()
    document.addEventListener('contextmenu', preventNativeContextMenu, true)
    return () => document.removeEventListener('contextmenu', preventNativeContextMenu, true)
  }, [])

  useEffect(() => {
    return onConnectionChange((online) => {
      setIsOnline(online)
      if (online && user && !user.isLocal && !document.hidden) {
        const lastSync = useNotesStore.getState().lastSyncTime
        const elapsed = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity
        if (elapsed > 30000) syncWithBackend()
      }
    })
  }, [user, setIsOnline, syncWithBackend])

  useEffect(() => {
    if (!isOnline || !user || user.isLocal) return undefined
    let cancelled = false

    const loadWorkspace = async () => {
      await useNotesStore.getState().loadSharedNotes()
      const syncSucceeded = useUIStore.getState().syncOnStartup
        ? await syncWithBackend()
        : false

      if (
        !cancelled &&
        syncSucceeded &&
        useNotesStore.getState().notes.length === 0 &&
        !localStorage.getItem(`quicknotes-setup-${user.id}`)
      ) {
        useNotesStore.getState().initializeStarterContent()
        localStorage.setItem(`quicknotes-setup-${user.id}`, 'true')
        await useNotesStore.getState().syncWithBackend()
      }
    }

    void loadWorkspace()
    return () => {
      cancelled = true
    }
  }, [user, isOnline, syncWithBackend])

  useEffect(() => {
    if (!user || user.isLocal || !isOnline) return
    const { autoSync, syncInterval } = useUIStore.getState()
    if (!autoSync || !syncInterval) return

    const intervalId = setInterval(
      () => {
        const { autoSync: stillOn } = useUIStore.getState()
        const { isSyncing } = useNotesStore.getState()
        if (stillOn && !isSyncing && navigator.onLine) syncWithBackend()
      },
      syncInterval * 60 * 1000
    )
    return () => clearInterval(intervalId)
  }, [user, isOnline, syncWithBackend])

  useEffect(() => {
    if (!user) return
    const url = new URL(window.location.href)
    let handledLaunchAction = false

    if (url.searchParams.has('share') && !user.isLocal) {
      useUIStore.getState().setSharedNotesViewOpen(true)
      url.searchParams.delete('share')
      handledLaunchAction = true
    }

    if (url.searchParams.get('action') === 'new') {
      setQuickNoteOpen(true)
      url.searchParams.delete('action')
      handledLaunchAction = true
    }

    if (handledLaunchAction) {
      const search = url.searchParams.toString()
      window.history.replaceState(
        {},
        document.title,
        `${url.pathname}${search ? `?${search}` : ''}${url.hash}`
      )
    }
  }, [setQuickNoteOpen, user])

  useEffect(() => {
    if (!user || viewMode === 'grid' || selectedNoteId || notes.length === 0) return
    const firstAvailableNote = notes.find((note) => !note.deleted && !note.archived)
    if (firstAvailableNote) setSelectedNote(firstAvailableNote.id)
  }, [notes, selectedNoteId, setSelectedNote, user, viewMode])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !user || user.isLocal || !isOnline) return
      if (!useUIStore.getState().autoSync) return
      const lastSync = useNotesStore.getState().lastSyncTime
      const elapsed = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity
      if (elapsed > 300000) syncWithBackend()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, isOnline, syncWithBackend])

  /**
   * Shortcut handlers are resolved against the user's saved bindings and
   * suppressed while typing unless the binding opts in — see
   * lib/shortcuts.js.
   */
  const shortcutHandlers = useMemo(
    () => ({
      newNote: () => setQuickNoteOpen(true),
      globalSearch: () => setGlobalSearchOpen(true),
      findReplace: () => setFindReplaceOpen(true),
      toggleSidebar: () => toggleSidebar(),
      focusMode: () => setFocusModeOpen(true),
      settings: () => setSettingsOpen(true),
      shortcuts: () => setShortcutsModalOpen(true),
      templates: () => setNoteTypesModalOpen(true),
      export: () => setExportModalOpen(true),
      import: () => setImportModalOpen(true),
      insertLink: () => setLinkModalOpen(true),
      duplicate: () => {
        const { selectedNoteId, duplicateNote } = useNotesStore.getState()
        if (selectedNoteId) duplicateNote(selectedNoteId)
      },
      archive: () => {
        const { selectedNoteId, archiveNote } = useNotesStore.getState()
        if (selectedNoteId) archiveNote(selectedNoteId)
      },
    }),
    [
      setQuickNoteOpen,
      setGlobalSearchOpen,
      setFindReplaceOpen,
      toggleSidebar,
      setFocusModeOpen,
      setSettingsOpen,
      setShortcutsModalOpen,
      setNoteTypesModalOpen,
      setExportModalOpen,
      setImportModalOpen,
      setLinkModalOpen,
    ]
  )

  useAppShortcuts(shortcutHandlers, { enabled: !!user })

  /**
   * On compact and medium layouts the sidebar overlays the workspace, so
   * it must start closed — otherwise it covers the note list on load.
   */
  useEffect(() => {
    setSidebarOpen(!sidebarIsOverlay)
  }, [sidebarIsOverlay, setSidebarOpen])

  const closeSidebarAfterNavigation = useCallback(() => {
    if (!sidebarIsOverlay) return
    setSidebarOpen(false)
    sidebarToggleRef.current?.focus()
  }, [sidebarIsOverlay, setSidebarOpen])

  const closeSidebarOverlay = useCallback(() => {
    if (sidebarIsOverlay) setSidebarOpen(false)
  }, [setSidebarOpen, sidebarIsOverlay])

  const returnToMobileNotes = useCallback(() => {
    if (isCompact && window.history.state?.qnMobileView === 'editor') {
      window.history.back()
      return
    }
    setMobileView('notes')
  }, [isCompact, setMobileView])

  useFocusTrap(sidebarRef, sidebarOverlayOpen)
  useEscapeKey(sidebarOverlayOpen, closeSidebarOverlay)

  if (isLoading) {
    return (
      <ThemeProvider>
        <AppLoading />
      </ThemeProvider>
    )
  }

  if (!user) {
    return (
      <ThemeProvider>
        <AuthScreen />
        <Suspense fallback={<DeferredSurfaceFallback />}>
          {helpModalOpen && <HelpModal />}
          {privacyModalOpen && <PrivacyModal />}
          {termsModalOpen && <TermsModal />}
        </Suspense>
      </ThemeProvider>
    )
  }

  if (isPasswordRecovery) {
    return (
      <ThemeProvider>
        <Suspense fallback={<AppLoading />}>
          <PasswordRecoveryScreen
            onComplete={() => setIsPasswordRecovery(false)}
            onCancel={() => backend.auth.signOut()}
          />
        </Suspense>
      </ThemeProvider>
    )
  }

  const showList = !isCompact || mobileView === 'notes'
  const showEditor = !isCompact || mobileView === 'editor'

  const sidebarToggle = (
    <IconButton
      ref={sidebarToggleRef}
      icon={PanelLeft}
      label={sidebarOpen ? 'Hide navigation' : 'Show navigation'}
      aria-expanded={sidebarOpen}
      aria-controls="qn-sidebar"
      data-dialog-return-focus
      onClick={toggleSidebar}
    />
  )

  return (
    <ThemeProvider>
      <div className="qn-workspace-frame flex h-[100dvh] overflow-hidden bg-app text-content">
        <a href="#qn-main" className="qn-skip-link">
          Skip to content
        </a>

        {sidebarIsOverlay && sidebarOpen && (
          <div
            className="fixed inset-0 z-drawer animate-fade-in bg-[var(--qn-overlay)]"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <div
          ref={sidebarRef}
          id="qn-sidebar"
          /**
           * A closed drawer is translated off-screen but still rendered, so
           * without `inert` its buttons stay in the tab order and a keyboard
           * user can focus controls they cannot see.
           *
           * `inert` takes a string because React 18 passes unknown
           * attributes through verbatim.
           */
          inert={sidebarIsOverlay && !sidebarOpen ? '' : undefined}
          aria-hidden={sidebarIsOverlay && !sidebarOpen ? 'true' : undefined}
          role={sidebarOverlayOpen ? 'dialog' : undefined}
          aria-modal={sidebarOverlayOpen ? 'true' : undefined}
          aria-label={sidebarOverlayOpen ? 'Navigation' : undefined}
          className={[
            'qn-sidebar-frame shrink-0 border-r border-subtle transition-transform duration-base ease-qn-out',
            sidebarIsOverlay
              ? `fixed inset-y-0 left-0 z-drawer w-[min(84vw,var(--qn-sidebar-width))] shadow-lg ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : `relative w-sidebar ${sidebarOpen ? '' : 'hidden'}`,
          ].join(' ')}
        >
          <Sidebar onNavigate={closeSidebarAfterNavigation} />
        </div>

        <div
          id="qn-main"
          tabIndex={-1}
          inert={sidebarOverlayOpen ? '' : undefined}
          aria-hidden={sidebarOverlayOpen ? 'true' : undefined}
          className="flex min-w-0 flex-1 flex-col outline-none"
        >
          {viewMode === 'grid' ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <Suspense fallback={<EditorLoading />}>
                <NotesGrid sidebarToggle={sidebarToggle} />
              </Suspense>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <div
                className={[
                  'qn-note-list-pane flex min-h-0 shrink-0 flex-col border-r border-subtle',
                  isCompact ? 'w-full' : 'w-list 2xl:w-[var(--qn-list-width-wide)]',
                  showList ? '' : 'hidden',
                ].join(' ')}
              >
                <Suspense fallback={<EditorLoading />}>
                  <NotesList
                    sidebarToggle={isWide && sidebarOpen ? null : sidebarToggle}
                    onOpenNote={() => isCompact && setMobileView('editor')}
                  />
                </Suspense>
              </div>

              <main className={`qn-editor-pane min-w-0 flex-1 ${showEditor ? 'flex' : 'hidden'}`}>
                <ErrorBoundary>
                  <Suspense fallback={<EditorLoading />}>
                    <NoteEditor onBack={returnToMobileNotes} showBack={isCompact} />
                  </Suspense>
                </ErrorBoundary>
              </main>
            </div>
          )}
        </div>

        <ReminderModal />
        <Suspense fallback={<DeferredSurfaceFallback />}>
          {quickNoteOpen && <QuickNoteModal />}
          {settingsOpen && <SettingsModal />}
          {exportModalOpen && <ExportModal />}
          {importModalOpen && <ImportModal />}
          {showTrash && <TrashView />}
          {versionHistoryOpen && <VersionHistoryModal />}
          {duplicateModalOpen && <DuplicateDetectionModal />}
          {globalSearchOpen && <GlobalSearchModal />}
          {archiveViewOpen && <ArchiveView />}
          {shortcutsModalOpen && <KeyboardShortcutsModal />}
          {noteTypesModalOpen && (
            <NoteTypesModal onCreated={() => isCompact && setMobileView('editor')} />
          )}
          {helpModalOpen && <HelpModal />}
          {privacyModalOpen && <PrivacyModal />}
          {termsModalOpen && <TermsModal />}
          {tagManagerOpen && <TagManagerModal />}
          {translateModalOpen && <TranslateModal />}
          {shareModalOpen && <ShareNoteModal />}
          {sharedNotesViewOpen && <SharedNotesView />}
          {editorSettingsOpen && <EditorSettingsModal />}
          {focusModeOpen && <FocusMode />}
        </Suspense>

        {!isOnline && !user.isLocal && (
          <div
            role="status"
            className="qn-safe-bottom fixed bottom-4 left-1/2 z-toast flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--qn-warning-border)] bg-warning-soft px-4 py-2 text-ui-md font-medium text-warning-text shadow-md"
          >
            <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            Offline — changes are saved on this device
          </div>
        )}
      </div>
    </ThemeProvider>
  )
}
