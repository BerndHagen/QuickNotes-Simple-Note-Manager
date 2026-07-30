import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Sidebar,
  NotesList,
  NotesGrid,
  NoteEditor,
  ErrorBoundary,
  QuickNoteModal,
  SettingsModal,
  TemplateModal,
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
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import NoteTemplatesModal from './components/NoteTemplatesModal'
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
  const { setIsOnline, syncWithBackend, isOnline, user, setUser, setIsAuthChecked } = useNotesStore()
  const {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    setTemplateModalOpen,
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
  const { isCompact, isWide, sidebarIsOverlay } = useLayoutMode()
  const sidebarToggleRef = useRef(null)

  useShareInvitations()

  useEffect(() => {
    useNotesStore.getState().cleanupExpiredTrash()
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      if (!isBackendConfigured()) {
        setIsAuthChecked(true)
        setIsLoading(false)
        return
      }
      try {
        const {
          data: { session },
        } = await backend.auth.getSession()
        if (session?.user) setUser(session.user)
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
    } = backend.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        const isNewUser =
          session.user.created_at &&
          new Date().getTime() - new Date(session.user.created_at).getTime() < 60000
        if (isNewUser && !localStorage.getItem(`quicknotes-setup-${session.user.id}`)) {
          useNotesStore.getState().initializeStarterContent()
          localStorage.setItem(`quicknotes-setup-${session.user.id}`, 'true')
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear all local data to prevent cross-account data leaks
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
        })
      }
    })

    return () => subscription?.unsubscribe()
  }, [setIsAuthChecked, setUser])

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
    if (!isOnline || !user) return
    useNotesStore.getState().loadSharedNotes()
    if (useUIStore.getState().syncOnStartup) syncWithBackend()
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
      templates: () => setTemplateModalOpen(true),
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
      setTemplateModalOpen,
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
      <div className="flex h-[100dvh] overflow-hidden bg-app text-content">
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
           * A closed drawer is translated off-screen but still rendered,
           * so without `inert` its buttons stay in the tab order and a
           * keyboard user tabs into controls they cannot see (measured
           * at x = -252 while still reporting as visible).
           * `inert` takes a string here because React 18 passes unknown
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
        <TemplateModal />
        <ExportModal />
        <ImportModal />
        <ReminderModal />
        <TrashView />
        <VersionHistoryModal />
        <DuplicateDetectionModal />
        <GlobalSearchModal />
        <ArchiveView />
        <KeyboardShortcutsModal />
        <NoteTemplatesModal />
        <NoteTypesModal />
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
