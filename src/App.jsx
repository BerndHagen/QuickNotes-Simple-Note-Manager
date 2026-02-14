import React, { useEffect, useState } from 'react'
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
  SharedNotesView
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
import { onConnectionChange, createShortcutHandler } from './lib/utils'
import { backend, isBackendConfigured } from './lib/backend'
import { useShareInvitations } from './lib/useCollaboration'
import { Menu, PanelLeftClose } from 'lucide-react'

export default function App() {
  const { 
    setIsOnline, 
    syncWithBackend, 
    isOnline, 
    user, 
    setUser,
    setIsAuthChecked 
  } = useNotesStore()
  const { sidebarOpen, toggleSidebar, setTemplateModalOpen, setFindReplaceOpen, setExportModalOpen, setImportModalOpen, setGlobalSearchOpen, setFocusModeOpen, focusModeOpen, setShortcutsModalOpen, mobileView, viewMode } = useUIStore()
  const [isLoading, setIsLoading] = useState(true)

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
        const { data: { session } } = await backend.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
        }
      } catch (error) {
      } finally {
        setIsAuthChecked(true)
        setIsLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = backend.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          
          const isNewUser = session.user.created_at && 
            (new Date().getTime() - new Date(session.user.created_at).getTime()) < 60000
          
          if (isNewUser && !localStorage.getItem(`quicknotes-setup-${session.user.id}`)) {
            const { initializeStarterContent } = useNotesStore.getState()
            initializeStarterContent()
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
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    const cleanup = onConnectionChange((online) => {
      setIsOnline(online)
      if (online && user && !document.hidden) {
        const lastSync = useNotesStore.getState().lastSyncTime
        const timeSinceLastSync = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity
        if (timeSinceLastSync > 30000) {
          syncWithBackend()
        }
      }
    })

    return cleanup
  }, [user])

  useEffect(() => {
    if (isOnline && user) {
      const { loadSharedNotes } = useNotesStore.getState()
      loadSharedNotes()
      
      const { syncOnStartup } = useUIStore.getState()
      if (syncOnStartup) {
        syncWithBackend()
      }
    }
  }, [user])

  useEffect(() => {
    if (!user || !isOnline) return
    
    const { autoSync, syncInterval } = useUIStore.getState()
    if (!autoSync || !syncInterval) return
    
    const intervalMs = syncInterval * 60 * 1000 // convert minutes to ms
    const intervalId = setInterval(() => {
      const { autoSync: currentAutoSync } = useUIStore.getState()
      const { isSyncing } = useNotesStore.getState()
      if (currentAutoSync && !isSyncing && navigator.onLine) {
        syncWithBackend()
      }
    }, intervalMs)
    
    return () => clearInterval(intervalId)
  }, [user, isOnline])

  useEffect(() => {
    const handleShareLink = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const shareToken = urlParams.get('share')
      
      if (shareToken && user) {
        const { setSharedNotesViewOpen } = useUIStore.getState()
        setSharedNotesViewOpen(true)
        
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    if (user) {
      handleShareLink()
    }
  }, [user])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && isOnline) {
        const { autoSync } = useUIStore.getState()
        if (!autoSync) return
        
        const lastSync = useNotesStore.getState().lastSyncTime
        const timeSinceLastSync = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity
        if (timeSinceLastSync > 300000) {
          syncWithBackend()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, isOnline])

  useEffect(() => {
    const handler = createShortcutHandler({
      'ctrl+\\': () => toggleSidebar(),
      'cmd+\\': () => toggleSidebar(),
      'ctrl+t': () => setTemplateModalOpen(true),
      'cmd+t': () => setTemplateModalOpen(true),
      'ctrl+f': () => setFindReplaceOpen(true),
      'cmd+f': () => setFindReplaceOpen(true),
      'ctrl+e': () => setExportModalOpen(true),
      'cmd+e': () => setExportModalOpen(true),
      'ctrl+i': () => setImportModalOpen(true),
      'cmd+i': () => setImportModalOpen(true),
      'ctrl+k': () => setGlobalSearchOpen(true),
      'cmd+k': () => setGlobalSearchOpen(true),
      'ctrl+shift+f': () => setFocusModeOpen(true),
      'ctrl+shift+k': () => useUIStore.getState().setLinkModalOpen(true),
      'cmd+shift+f': () => setFocusModeOpen(true),
      'cmd+shift+k': () => useUIStore.getState().setLinkModalOpen(true),
      'ctrl+/': () => setShortcutsModalOpen(true),
      'cmd+/': () => setShortcutsModalOpen(true),
    })

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center logo-badge badge-shine">
                <svg className="w-7 h-7 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
              </div>
              <div className="absolute -inset-3 rounded-3xl border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" style={{ animationDuration: '1.2s' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">QuickNotes</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 font-medium">Loading your workspace...</p>
            </div>
          </div>
        </div>
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

  return (
    <ThemeProvider>
        <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden transition-opacity"
            onClick={toggleSidebar}
          />
        )}
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className={`fixed top-4 left-4 z-40 p-2.5 bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 border border-gray-100 dark:border-gray-800/80 active:scale-95 hover:scale-105 ${
              mobileView === 'editor' ? 'hidden md:block' : 'block'
            }`}
            title="Open sidebar (Ctrl+\\)"
          >
            <Menu className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
        <div
          className={`fixed md:relative z-40 h-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex-shrink-0 border-r border-[#cbd1db] dark:border-gray-800 ${
            sidebarOpen ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'
          } overflow-hidden`}
        >
          <Sidebar />
        </div>
        {sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="hidden md:block absolute top-1/2 -translate-y-1/2 left-[273px] z-40 p-1 bg-white dark:bg-gray-900 rounded-full shadow-md hover:shadow-lg transition-all duration-200 border border-gray-100 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-90 hover:scale-110"
            title="Collapse sidebar (Ctrl+\\)"
          >
            <PanelLeftClose className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          </button>
        )}
        {viewMode === 'grid' ? (
          /* Grid View - Full width grid of notes */
          <div className="flex-1 min-w-0 overflow-hidden">
            <NotesGrid />
          </div>
        ) : (
          /* List View - Notes List + Editor side by side */
          <div className="flex flex-1 min-w-0 overflow-hidden">
            <div 
              className={`flex-shrink-0 h-full ${
                mobileView === 'editor' ? 'hidden md:block' : 'w-full md:w-80'
              }`}
            >
              <NotesList />
            </div>
            <div 
              className={`flex-1 min-w-0 h-full ${
                mobileView === 'notes' ? 'hidden md:block' : 'block'
              }`}
            >
              <ErrorBoundary>
                <NoteEditor />
              </ErrorBoundary>
            </div>
          </div>
        )}
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
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-amber-50 border border-amber-200/80 text-amber-700 rounded-2xl shadow-lg shadow-amber-500/10 flex items-center gap-3 text-[13px] font-semibold z-50 backdrop-blur-sm">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Offline mode — Changes saved locally
          </div>
        )}
      </div>
    </ThemeProvider>
  )
}
