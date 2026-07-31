import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Sidebar,
  NotesList,
  NotesGrid,
  NoteEditor,
  ErrorBoundary,
  QuickNoteModal,
  SettingsModal,
  ThemeProvider,
  ExportModal,
  ImportModal,
  ReminderModal,
  TrashView,
  VersionHistoryModal,
  DuplicateDetectionModal,
  GlobalSearchModal,
  FocusMode,
  ArchiveView,
  ShareNoteModal,
  SharedNotesView,
} from './components'
import AuthScreen from './components/AuthScreen'
import PasswordRecoveryScreen from './components/PasswordRecoveryScreen'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import NoteTypesModal from './components/NoteTypesModal'
import HelpModal from './components/HelpModal'
import PrivacyModal from './components/PrivacyModal'
import TermsModal from './components/TermsModal'
import TagManagerModal from './components/TagManagerModal'
import TranslateModal from './components/TranslateModal'
import EditorSettingsModal from './components/EditorSettingsModal'
import { useNotesStore, useUIStore } from './store'
import { onConnectionChange } from './lib/utils'
import { backend, isBackendConfigured } from './lib/backend'
import { createLocalUser, hasLocalSession } from './lib/localSession'
import { useShareInvitations } from './lib/useCollaboration'
import { useAppShortcuts } from './lib/shortcuts'
import { useLayoutMode } from './hooks/useBreakpoint'
import { PanelLeft, CloudOff } from 'lucide-react'
import { IconButton, Spinner } from './components/ui'

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

export default function App() {
  const {
    notes,
    selectedNoteId,
    setSelectedNote,
    setIsOnline,
    syncWithBackend,
    isOnline,
    user,
    setUser,
    activateCloudUser,
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
  } = useUIStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const { isCompact, isWide, sidebarIsOverlay } = useLayoutMode()
  const sidebarToggleRef = useRef(null)

  useShareInvitations()

  useEffect(() => {
    useNotesStore.getState().cleanupExpiredTrash()
  }, [])

  useEffect(() => {
    if (!isBackendConfigured()) {
      if (hasLocalSession()) setUser(createLocalUser())
      setIsAuthChecked(true)
      setIsLoading(false)
      return undefined
    }

    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await backend.auth.getSession()
        if (session?.user) await activateCloudUser(session.user, { adoptUnowned: true })
      } catch {
        /* falls through to the sign-in screen */
      } finally {
        setIsAuthChecked(true)
        setIsLoading(false)
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
          void (async () => {
            const { clearLocalData } = await import('./lib/db')
            await clearLocalData()
            localStorage.removeItem('quicknotes-storage')
            setUser(null)
            useNotesStore.setState({
              notes: [],
              folders: [],
              tags: [],
              selectedNoteId: null,
              selectedFolderId: null,
              selectedTagFilter: null,
              searchQuery: '',
              sharedNotes: [],
              pendingShares: [],
              lastSyncTime: null,
              cacheOwnerId: null,
            })
          })()
        }, 0)
      }
    })

    return () => subscription?.unsubscribe()
  }, [activateCloudUser, setIsAuthChecked, setUser])

  useEffect(() => {
    return onConnectionChange((online) => {
      setIsOnline(online)
      if (online && user && !document.hidden) {
        const lastSync = useNotesStore.getState().lastSyncTime
        const elapsed = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity
        if (elapsed > 30000) syncWithBackend()
      }
    })
  }, [user, setIsOnline, syncWithBackend])

  useEffect(() => {
    if (!isOnline || !user) return undefined
    let cancelled = false

    const loadWorkspace = async () => {
      await useNotesStore.getState().loadSharedNotes()
      const syncSucceeded = useUIStore.getState().syncOnStartup
        ? await syncWithBackend()
        : false

      if (
        !cancelled &&
        syncSucceeded &&
        !user.isLocal &&
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
    if (!user || !isOnline) return
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
    const shareToken = new URLSearchParams(window.location.search).get('share')
    if (!shareToken) return
    useUIStore.getState().setSharedNotesViewOpen(true)
    window.history.replaceState({}, document.title, window.location.pathname)
  }, [user])

  useEffect(() => {
    if (!user || selectedNoteId || notes.length === 0) return
    const firstAvailableNote = notes.find((note) => !note.deleted && !note.archived)
    if (firstAvailableNote) setSelectedNote(firstAvailableNote.id)
  }, [notes, selectedNoteId, setSelectedNote, user])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !user || !isOnline) return
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
      </ThemeProvider>
    )
  }

  if (isPasswordRecovery) {
    return (
      <ThemeProvider>
        <PasswordRecoveryScreen
          onComplete={() => setIsPasswordRecovery(false)}
          onCancel={() => backend.auth.signOut()}
        />
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
          className={[
            'shrink-0 border-r border-subtle transition-transform duration-base ease-qn-out',
            sidebarIsOverlay
              ? `fixed inset-y-0 left-0 z-drawer w-[min(84vw,var(--qn-sidebar-width))] shadow-lg ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : `relative w-sidebar ${sidebarOpen ? '' : 'hidden'}`,
          ].join(' ')}
        >
          <Sidebar onNavigate={closeSidebarAfterNavigation} />
        </div>

        <div id="qn-main" className="flex min-w-0 flex-1 flex-col">
          {viewMode === 'grid' ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <NotesGrid sidebarToggle={sidebarToggle} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <div
                className={[
                  'flex min-h-0 shrink-0 flex-col border-r border-subtle',
                  isCompact ? 'w-full' : 'w-list 2xl:w-[var(--qn-list-width-wide)]',
                  showList ? '' : 'hidden',
                ].join(' ')}
              >
                <NotesList
                  sidebarToggle={isWide && sidebarOpen ? null : sidebarToggle}
                  onOpenNote={() => isCompact && setMobileView('editor')}
                />
              </div>

              <main className={`min-w-0 flex-1 ${showEditor ? 'flex' : 'hidden'}`}>
                <ErrorBoundary>
                  <NoteEditor onBack={() => setMobileView('notes')} showBack={isCompact} />
                </ErrorBoundary>
              </main>
            </div>
          )}
        </div>

        <QuickNoteModal />
        <SettingsModal />
        <ExportModal />
        <ImportModal />
        <ReminderModal />
        <TrashView />
        <VersionHistoryModal />
        <DuplicateDetectionModal />
        <GlobalSearchModal />
        <ArchiveView />
        <KeyboardShortcutsModal />
        <NoteTypesModal onCreated={() => isCompact && setMobileView('editor')} />
        <HelpModal />
        <PrivacyModal />
        <TermsModal />
        <TagManagerModal />
        <TranslateModal />
        <ShareNoteModal />
        <SharedNotesView />
        <EditorSettingsModal />
        {focusModeOpen && <FocusMode />}

        {!isOnline && (
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
