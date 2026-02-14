import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId, repairMojibake } from '../lib/utils'
import { db, saveNoteOffline, addToSyncQueue, getPendingSyncItems, removeSyncItem, clearLocalData, SyncStatus } from '../lib/db'
import { backend, isBackendConfigured } from '../lib/backend'
import toast from 'react-hot-toast'
const WELCOME_TITLE = 'Welcome to QuickNotes! \u{1F389}'

const createStarterContent = () => {
  const welcomeNote = {
    id: generateId(),
    title: WELCOME_TITLE,
    content: `<h2>Your Personal Notes App</h2>
<p>Welcome to QuickNotes - a modern note-taking application designed to help you organize your thoughts!</p>

<h3>\u2728 Key Features</h3>
<ul>
  <li><strong>Rich Text Editor</strong> - Format your notes with bold, italic, lists, and more</li>
  <li><strong>Folders & Tags</strong> - Organize notes with folders and color-coded tags</li>
  <li><strong>Cloud Sync</strong> - Access your notes from any device</li>
  <li><strong>Offline Support</strong> - Works even without internet</li>
  <li><strong>Dark Mode</strong> - Easy on the eyes</li>
  <li><strong>Templates</strong> - Quick-start with meeting notes, to-do lists, and more</li>
</ul>

<h3>\u{1F680} Getting Started</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Create your first note with the + button</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Organize with folders in the sidebar</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Add tags to categorize your notes</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Try the Quick Note feature (Ctrl+N)</p></div></li>
</ul>

<p>Happy note-taking! \u{1F4DD}</p>`,
    folderId: null,
    tags: ['welcome', 'getting-started'],
    starred: true,
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: SyncStatus.PENDING,
  }

  const starterFolders = [
    {
      id: generateId(),
      name: 'Work',
      icon: 'Briefcase',
      color: '#3b82f6',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: SyncStatus.PENDING,
    },
    {
      id: generateId(),
      name: 'Personal',
      icon: 'Home',
      color: '#22c55e',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: SyncStatus.PENDING,
    },
    {
      id: generateId(),
      name: 'Ideas',
      icon: 'Lightbulb',
      color: '#f59e0b',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: SyncStatus.PENDING,
    },
  ]

  const starterTags = [
    { id: generateId(), name: 'welcome', color: '#3b82f6' },
    { id: generateId(), name: 'getting-started', color: '#22c55e' },
    { id: generateId(), name: 'work', color: '#ef4444' },
    { id: generateId(), name: 'important', color: '#f97316' },
    { id: generateId(), name: 'ideas', color: '#8b5cf6' },
    { id: generateId(), name: 'todo', color: '#06b6d4' },
    { id: generateId(), name: 'personal', color: '#ec4899' },
  ]

  return { welcomeNote, starterFolders, starterTags }
}

export const useNotesStore = create(
  persist(
    (set, get) => ({
      notes: [],
      folders: [],
      tags: [],
      selectedNoteId: null,
      selectedFolderId: null,
      selectedTagFilter: null,
      searchQuery: '',
      isEditing: false,
      isSyncing: false,
      lastSyncTime: null,
      isOnline: navigator.onLine,
      user: null,
      isAuthChecked: false,
      sharedNotes: [],
      pendingShares: [],
      isNewUser: false,

      initializeStarterContent: () => {
        const { welcomeNote, starterFolders, starterTags } = createStarterContent()
        
        set({
          notes: [welcomeNote],
          folders: starterFolders,
          tags: starterTags,
          selectedNoteId: welcomeNote.id,
          isNewUser: true,
        })

        saveNoteOffline(welcomeNote)
        addToSyncQueue('notes', 'insert', welcomeNote)
        
        starterFolders.forEach(folder => {
          db.folders.put(folder)
          addToSyncQueue('folders', 'insert', folder)
        })
        
        starterTags.forEach(tag => {
          db.tags.put(tag)
          addToSyncQueue('tags', 'insert', tag)
        })
      },


      createNote: (note = {}) => {
        const newNote = {
          id: generateId(),
          title: note.title || 'New Note',
          content: note.content || '',
          folderId: note.folderId || get().selectedFolderId,
          tags: note.tags || [],
          starred: false,
          pinned: false,
          noteType: note.noteType || 'standard',
          noteData: note.noteData || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          notes: [newNote, ...state.notes],
          selectedNoteId: newNote.id,
          isEditing: true,
        }))

        saveNoteOffline(newNote)
        addToSyncQueue('notes', 'insert', newNote)

        return newNote
      },

      updateNote: async (id, updates) => {
        const { notes, sharedNotes, user } = get()
        
        const sharedNote = sharedNotes.find((share) => share.notes?.id === id)
        
        if (sharedNote) {
          if (sharedNote.permission !== 'edit') {
            throw new Error('You do not have permission to edit this shared note')
          }
          
          const keyMap = {
            folderId: 'folder_id',
            deletedAt: 'deleted_at',
            archivedAt: 'archived_at',
            noteType: 'note_type',
            noteData: 'note_data',
            sortOrder: 'sort_order',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          }
          const skipKeys = new Set(['syncStatus', 'order', 'reminders'])
          const snakeUpdates = {}
          for (const [key, value] of Object.entries(updates)) {
            if (key.startsWith('_')) continue // skip internal flags like _isExternalUpdate
            if (skipKeys.has(key)) continue
            snakeUpdates[keyMap[key] || key] = value
          }
          
          const { backend } = await import('../lib/backend')
          const { error } = await backend
            .from('notes')
            .update({
              ...snakeUpdates,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
          
          if (error) throw error
          
          set((state) => ({
            sharedNotes: state.sharedNotes.map((share) =>
              share.notes?.id === id
                ? { ...share, notes: { ...share.notes, ...updates, updatedAt: new Date().toISOString() } }
                : share
            ),
          }))
          
          return
        }
        
        const updatedNote = {
          ...updates,
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...updatedNote } : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, ...updatedNote })
          addToSyncQueue('notes', 'update', { id, ...updatedNote })
        }
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  deleted: true,
                  deletedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          selectedNoteId:
            state.selectedNoteId === id
              ? state.notes.find((n) => n.id !== id && !n.deleted)?.id || null
              : state.selectedNoteId,
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, deleted: true, deletedAt: new Date().toISOString() })
          addToSyncQueue('notes', 'update', { id, deleted: true })

          if (isBackendConfigured()) {
            const { user } = get()
            if (user) {
              backend.from('notes').update({ deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', id).eq('user_id', user.id).then(() => {})
            }
          }
        }
      },

      restoreNote: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  deleted: false,
                  deletedAt: null,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, deleted: false, deletedAt: null })
          addToSyncQueue('notes', 'update', { id, deleted: false })

          if (isBackendConfigured()) {
            const { user } = get()
            if (user) {
              backend.from('notes').update({ deleted: false, deleted_at: null, updated_at: new Date().toISOString() })
                .eq('id', id).eq('user_id', user.id).then(() => {})
            }
          }
        }
      },

      permanentlyDeleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          selectedNoteId:
            state.selectedNoteId === id
              ? state.notes.find((n) => n.id !== id && !n.deleted)?.id || null
              : state.selectedNoteId,
        }))

        db.notes.delete(id)
        addToSyncQueue('notes', 'delete', { id })

        if (isBackendConfigured()) {
          const { user } = get()
          if (user) {
            backend.from('notes').delete().eq('id', id).eq('user_id', user.id)
              .then(() => {})
          }
        }
      },

      /**
       * Auto-delete notes that have been in trash for more than 30 days.
       */
      cleanupExpiredTrash: () => {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
        const now = Date.now()
        const { notes, user } = get()
        
        const expired = notes.filter(note => 
          note.deleted && note.deletedAt && 
          (now - new Date(note.deletedAt).getTime()) > THIRTY_DAYS_MS
        )
        
        if (expired.length > 0) {
          for (const note of expired) {
            db.notes.delete(note.id)
            addToSyncQueue('notes', 'delete', { id: note.id })

            if (isBackendConfigured() && user) {
              backend.from('notes').delete().eq('id', note.id).eq('user_id', user.id)
                .then(() => {})
            }
          }
          
          set((state) => ({
            notes: state.notes.filter(note => 
              !(note.deleted && note.deletedAt && 
                (now - new Date(note.deletedAt).getTime()) > THIRTY_DAYS_MS)
            ),
          }))
        }
      },

      toggleStar: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  starred: !note.starred,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id, starred: note.starred })
        }
      },

      togglePin: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  pinned: !note.pinned,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id, pinned: note.pinned })
        }
      },

      reorderNotes: (orderedIds) => {
        set((state) => {
          const now = new Date().toISOString()
          const updatedNotes = state.notes.map(note => {
            const newOrder = orderedIds.indexOf(note.id)
            if (newOrder !== -1 && note.order !== newOrder) {
              const updatedNote = {
                ...note,
                order: newOrder,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING,
              }
              saveNoteOffline(updatedNote)
              addToSyncQueue('notes', 'update', { id: note.id, order: newOrder })
              return updatedNote
            }
            return { ...note, order: note.order ?? orderedIds.indexOf(note.id) }
          })
          
          return { notes: updatedNotes }
        })
      },

      archiveNote: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  archived: true,
                  archivedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          selectedNoteId:
            state.selectedNoteId === id
              ? state.notes.find((n) => n.id !== id && !n.deleted && !n.archived)?.id || null
              : state.selectedNoteId,
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, archived: true, archivedAt: new Date().toISOString() })
          addToSyncQueue('notes', 'update', { id, archived: true })
        }
      },

      unarchiveNote: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  archived: false,
                  archivedAt: null,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === id)
        if (note) {
          saveNoteOffline({ ...note, archived: false, archivedAt: null })
          addToSyncQueue('notes', 'update', { id, archived: false })
        }
      },

      duplicateNote: (id) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) return

        const duplicate = {
          ...note,
          id: generateId(),
          title: `${note.title} (Copy)`,
          starred: false,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          notes: [duplicate, ...state.notes],
          selectedNoteId: duplicate.id,
        }))

        saveNoteOffline(duplicate)
        addToSyncQueue('notes', 'insert', duplicate)
      },

      moveNote: (noteId, folderId) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  folderId,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === noteId)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id: noteId, folderId })
        }
      },

      createFolder: (folder = {}) => {
        const newFolder = {
          id: generateId(),
          name: folder.name || 'New Folder',
          icon: folder.icon || 'Folder',
          color: folder.color || '#6b7280',
          parentId: folder.parentId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          folders: [...state.folders, newFolder],
        }))

        db.folders.put(newFolder)
        addToSyncQueue('folders', 'insert', newFolder)

        return newFolder
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === id
              ? {
                  ...folder,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : folder
          ),
        }))

        const folder = get().folders.find((f) => f.id === id)
        if (folder) {
          db.folders.put(folder)
          addToSyncQueue('folders', 'update', { id, ...updates })
        }
      },

      deleteFolder: (id) => {
        const affectedNotes = get().notes.filter((n) => n.folderId === id)
        
        set((state) => ({
          notes: state.notes.map((note) =>
            note.folderId === id
              ? {
                  ...note,
                  folderId: null,
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
          folders: state.folders.filter((folder) => folder.id !== id),
          selectedFolderId:
            state.selectedFolderId === id ? null : state.selectedFolderId,
        }))

        for (const note of affectedNotes) {
          const updated = { ...note, folderId: null, updatedAt: new Date().toISOString(), syncStatus: SyncStatus.PENDING }
          saveNoteOffline(updated)
        }

        db.folders.delete(id)
        addToSyncQueue('folders', 'delete', { id })
      },

      createTag: (tag) => {
        const newTag = {
          id: generateId(),
          name: tag.name,
          color: tag.color || '#6b7280',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: SyncStatus.PENDING,
        }

        set((state) => ({
          tags: [...state.tags, newTag],
        }))

        db.tags.put(newTag)
        addToSyncQueue('tags', 'insert', newTag)

        return newTag
      },

      updateTag: (id, updates) => {
        const oldTag = get().tags.find((t) => t.id === id)
        if (!oldTag) return

        const updatedTag = { ...oldTag, ...updates, updatedAt: new Date().toISOString(), syncStatus: SyncStatus.PENDING }

        set((state) => ({
          tags: state.tags.map((tag) =>
            tag.id === id ? updatedTag : tag
          ),
        }))

        if (updates.name && updates.name !== oldTag.name) {
          set((state) => ({
            notes: state.notes.map((note) => ({
              ...note,
              tags: note.tags?.map((t) => t === oldTag.name ? updates.name : t) || [],
            })),
            selectedTagFilter:
              state.selectedTagFilter === oldTag.name ? updates.name : state.selectedTagFilter,
          }))

          const affectedNotes = get().notes.filter(n => n.tags?.includes(updates.name))
          for (const note of affectedNotes) {
            const updated = { ...note, updatedAt: new Date().toISOString(), syncStatus: SyncStatus.PENDING }
            saveNoteOffline(updated)
            addToSyncQueue('notes', 'update', { id: note.id, tags: note.tags })
          }
        }

        db.tags.put(updatedTag)
        const { syncStatus: _s, ...tagDataForSync } = updatedTag
        addToSyncQueue('tags', 'update', tagDataForSync)
      },

      deleteTag: (id) => {
        const tag = get().tags.find((t) => t.id === id)
        if (!tag) return

        const affectedNoteIds = get().notes
          .filter(n => n.tags?.includes(tag.name))
          .map(n => n.id)

        set((state) => ({
          notes: state.notes.map((note) => ({
            ...note,
            tags: note.tags?.filter((t) => t !== tag.name) || [],
          })),
          tags: state.tags.filter((t) => t.id !== id),
          selectedTagFilter:
            state.selectedTagFilter === tag.name ? null : state.selectedTagFilter,
        }))
        
        for (const noteId of affectedNoteIds) {
          const note = get().notes.find(n => n.id === noteId)
          if (note) {
            const updated = { ...note, updatedAt: new Date().toISOString(), syncStatus: SyncStatus.PENDING }
            saveNoteOffline(updated)
            addToSyncQueue('notes', 'update', { id: noteId, tags: note.tags })
          }
        }

        db.tags.delete(id)
        addToSyncQueue('tags', 'delete', { id })
      },

      addTagToNote: (noteId, tagName) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  tags: [...new Set([...(note.tags || []), tagName])],
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === noteId)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id: noteId, tags: note.tags })
        }
      },

      removeTagFromNote: (noteId, tagName) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  tags: (note.tags || []).filter((t) => t !== tagName),
                  updatedAt: new Date().toISOString(),
                  syncStatus: SyncStatus.PENDING,
                }
              : note
          ),
        }))

        const note = get().notes.find((n) => n.id === noteId)
        if (note) {
          saveNoteOffline(note)
          addToSyncQueue('notes', 'update', { id: noteId, tags: note.tags })
        }
      },
      setSelectedNote: (id) => set({ selectedNoteId: id }),
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSelectedFolder: (id) => set({ selectedFolderId: id, selectedTagFilter: null }),
      setSelectedTagFilter: (tag) => set({ selectedTagFilter: tag, selectedFolderId: null }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setIsEditing: (editing) => set({ isEditing: editing }),
      setIsOnline: (online) => set({ isOnline: online }),
      setUser: (user) => set({ user }),
      setIsAuthChecked: (checked) => set({ isAuthChecked: checked }),
      
      logout: async () => {
        if (isBackendConfigured()) {
          const { user } = get()
          if (user) {
            try {
              const pendingItems = await getPendingSyncItems()
              for (const item of pendingItems) {
                if (item.operation === 'delete') {
                  await backend.from(item.table).delete()
                    .eq('id', item.data.id)
                    .eq('user_id', user.id)
                }
              }
            } catch (e) {
            }
          }
          await backend.auth.signOut()
        }
        await clearLocalData()
        localStorage.removeItem('quicknotes-remember')
        localStorage.removeItem('quicknotes-storage')
        set({ 
          user: null,
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
          isSyncing: false,
        })
      },

      setSyncing: (syncing) => set({ isSyncing: syncing }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      syncWithBackend: async () => {
        if (!isBackendConfigured()) {
          return
        }
        
        const { user } = get()
        if (!user) {
          return
        }

        try {
          const { data: { session } } = await backend.auth.getSession()
          if (!session) {
            set({ user: null })
            return
          }
        } catch {
          return
        }

        const showNotifications = useUIStore.getState().showSyncNotifications
        
        set({ isSyncing: true })
        const syncToast = showNotifications ? toast.loading('Synchronizing...') : null

        try {
          const pendingSyncItems = await getPendingSyncItems()
          
          const folderDeletions = pendingSyncItems.filter(
            item => item.table === 'folders' && item.operation === 'delete'
          )
          for (const item of folderDeletions) {
            const { error } = await backend
              .from('folders')
              .delete()
              .eq('id', item.data.id)
              .eq('user_id', user.id)
            
            if (!error) {
              await removeSyncItem(item.id)
            }
          }
          
          const tagDeletions = pendingSyncItems.filter(
            item => item.table === 'tags' && item.operation === 'delete'
          )
          for (const item of tagDeletions) {
            const { error } = await backend
              .from('tags')
              .delete()
              .eq('id', item.data.id)
              .eq('user_id', user.id)
            
            if (!error) {
              await removeSyncItem(item.id)
            }
          }

          const { data: remoteFolders } = await backend
            .from('folders')
            .select('*')
            .eq('user_id', user.id)

          const localFolders = get().folders
          const remoteFolderIds = new Set((remoteFolders || []).map(f => f.id))
          
          // Upload local folders that exist on server (update) or are new (insert)
          // Skip only starter folders that don't have a matching remote ID AND the remote already has one with the same name
          const remoteFolderNames = new Set((remoteFolders || []).map(f => f.name.toLowerCase()))
          const starterFolderNames = new Set(['work', 'personal', 'ideas'])
          
          const foldersToUpload = localFolders.filter(folder => {
            if (remoteFolderIds.has(folder.id)) {
              return true
            }
            if (starterFolderNames.has(folder.name.toLowerCase()) && remoteFolderNames.has(folder.name.toLowerCase())) {
              return false
            }
            return true
          })
          
          for (const folder of foldersToUpload) {
            const folderData = {
              id: folder.id,
              user_id: user.id,
              name: folder.name,
              icon: folder.icon || 'Folder',
              color: folder.color || '#10b981',
              parent_id: folder.parentId || null,
              created_at: folder.createdAt || new Date().toISOString(),
              updated_at: folder.updatedAt || folder.createdAt || new Date().toISOString(),
              sync_status: 'synced',
            }
            
            const { error } = await backend
              .from('folders')
              .upsert(folderData)
              .select()
            
            if (error) {
            }
          }

          if (remoteFolders && remoteFolders.length > 0) {
            set((state) => {
              const remoteFolderMap = new Map(remoteFolders.map(rf => [rf.id, rf]))
              
              const deletedFolderIds = new Set(folderDeletions.map(d => d.data.id))
              
              const mergedFolders = state.folders.map(lf => {
                const remote = remoteFolderMap.get(lf.id)
                if (remote) {
                  return {
                    id: remote.id,
                    name: remote.name,
                    icon: remote.icon || 'Folder',
                    color: remote.color || '#10b981',
                    parentId: remote.parent_id || null,
                    createdAt: remote.created_at,
                    updatedAt: remote.updated_at || remote.created_at,
                    syncStatus: SyncStatus.SYNCED,
                  }
                }
                return lf
              })
              
              for (const rf of remoteFolders) {
                if (deletedFolderIds.has(rf.id)) {
                  continue
                }
                if (state.folders.find(lf => lf.id === rf.id)) {
                  continue
                }
                mergedFolders.push({
                  id: rf.id,
                  name: rf.name,
                  icon: rf.icon || 'Folder',
                  color: rf.color || '#10b981',
                  parentId: rf.parent_id || null,
                  createdAt: rf.created_at,
                  updatedAt: rf.updated_at || rf.created_at,
                  syncStatus: SyncStatus.SYNCED,
                })
              }
              
              return { folders: mergedFolders }
            })
          }

          const { data: remoteTags } = await backend
            .from('tags')
            .select('*')
            .eq('user_id', user.id)

          const localTags = get().tags
          const remoteTagNames = new Set((remoteTags || []).map(t => t.name.toLowerCase()))
          const remoteTagIds = new Set((remoteTags || []).map(t => t.id))
          const starterTagNames = new Set(['welcome', 'getting-started', 'work', 'important', 'ideas', 'todo', 'personal', 'reference'])
          
          const tagsToUpload = localTags.filter(tag => {
            if (remoteTagIds.has(tag.id)) {
              return true
            }
            if (starterTagNames.has(tag.name.toLowerCase()) && remoteTagNames.has(tag.name.toLowerCase())) {
              return false
            }
            return true
          })
          
          for (const tag of tagsToUpload) {
            const tagData = {
              id: tag.id,
              user_id: user.id,
              name: tag.name,
              color: tag.color || '#3b82f6',
              created_at: tag.createdAt || new Date().toISOString(),
            }
            
            const { error } = await backend
              .from('tags')
              .upsert(tagData)
              .select()
            
            if (error) {
            }
          }

          if (remoteTags && remoteTags.length > 0) {
            set((state) => {
              const remoteTagMap = new Map(remoteTags.map(rt => [rt.id, rt]))
              
              const deletedTagIds = new Set(tagDeletions.map(d => d.data.id))
              
              const mergedTags = state.tags.map(lt => {
                const remote = remoteTagMap.get(lt.id)
                if (remote) {
                  return {
                    id: remote.id,
                    name: remote.name,
                    color: remote.color || '#3b82f6',
                    createdAt: remote.created_at,
                    syncStatus: SyncStatus.SYNCED,
                  }
                }
                return lt
              })
              
              for (const rt of remoteTags) {
                if (deletedTagIds.has(rt.id)) {
                  continue
                }
                if (state.tags.find(lt => lt.id === rt.id)) {
                  continue
                }
                mergedTags.push({
                  id: rt.id,
                  name: rt.name,
                  color: rt.color || '#3b82f6',
                  createdAt: rt.created_at,
                  syncStatus: SyncStatus.SYNCED,
                })
              }
              
              return { tags: mergedTags }
            })
          }

          const toSnakeCase = (note) => {
            // Merge reminders array into note_data JSONB for Supabase persistence
            const baseNoteData = note.noteData || {}
            const remindersData = note.reminders?.length ? { reminders: note.reminders } : {}
            const mergedNoteData = { ...baseNoteData, ...remindersData }
            const hasNoteData = Object.keys(mergedNoteData).length > 0

            // Set reminder TIMESTAMPTZ to the next upcoming (non-notified) reminder
            const nextReminder = note.reminders?.length
              ? note.reminders
                  .filter(r => !r.notified)
                  .map(r => r.datetime)
                  .sort()[0] || null
              : (note.reminder || null)

            return {
              id: note.id,
              user_id: user.id,
              folder_id: note.folderId || null,
              title: note.title,
              content: note.content,
              starred: note.starred || false,
              pinned: note.pinned || false,
              deleted: note.deleted || false,
              deleted_at: note.deletedAt || null,
              archived: note.archived || false,
              archived_at: note.archivedAt || null,
              reminder: nextReminder,
              tags: note.tags || [],
              sort_order: note.order ?? null,
              note_type: note.noteType || 'standard',
              note_data: hasNoteData ? mergedNoteData : null,
              created_at: note.createdAt,
              updated_at: note.updatedAt,
              sync_status: 'synced',
            }
          }

          const toCamelCase = (note) => {
            // Extract reminders from note_data JSONB, rest goes to noteData
            const rawNoteData = note.note_data || {}
            const { reminders: remindersFromData, ...restNoteData } = rawNoteData
            const hasRestData = Object.keys(restNoteData).length > 0

            return {
              id: note.id,
              userId: note.user_id,
              folderId: note.folder_id,
              title: note.title,
              content: note.content,
              starred: note.starred,
              pinned: note.pinned,
              deleted: note.deleted || false,
              deletedAt: note.deleted_at,
              archived: note.archived || false,
              archivedAt: note.archived_at,
              reminder: note.reminder,
              reminders: remindersFromData || [],
              tags: note.tags || [],
              order: note.sort_order ?? null,
              noteType: note.note_type || 'standard',
              noteData: hasRestData ? restNoteData : null,
              createdAt: note.created_at,
              updatedAt: note.updated_at,
              syncStatus: SyncStatus.SYNCED,
            }
          }

          const pendingNotes = get().notes.filter(
            (n) => n.syncStatus === SyncStatus.PENDING && n.title !== WELCOME_TITLE
          )

          let syncedCount = 0
          let errorCount = 0

          for (const note of pendingNotes) {
            const { error } = await backend
              .from('notes')
              .upsert(toSnakeCase(note))
              .select()

            if (!error) {
              syncedCount++
              set((state) => ({
                notes: state.notes.map((n) =>
                  n.id === note.id ? { ...n, syncStatus: SyncStatus.SYNCED } : n
                ),
              }))
            } else {
              errorCount++
            }
          }

          const noteSyncItems = await getPendingSyncItems()
          const noteDeletions = noteSyncItems.filter(
            item => item.table === 'notes' && item.operation === 'delete'
          )
          
          for (const item of noteDeletions) {
            const { error } = await backend
              .from('notes')
              .delete()
              .eq('id', item.data.id)
              .eq('user_id', user.id)
            
            if (!error) {
              await removeSyncItem(item.id)
            }
          }

          const { data: remoteNotes, error: fetchError } = await backend
            .from('notes')
            .select('*')
            .eq('user_id', user.id)

          if (fetchError) {
            throw fetchError
          }

          if (remoteNotes) {
            set((state) => {
              const localNotesMap = new Map(state.notes.map((n) => [n.id, n]))
              const updatedNotes = [...state.notes]
              let newNotesCount = 0
              let updatedCount = 0

              for (const remoteNote of remoteNotes) {
                const localNote = localNotesMap.get(remoteNote.id)
                
                if (!localNote) {
                  const wasDeleted = noteDeletions.some(d => d.data.id === remoteNote.id)
                  if (!wasDeleted) {
                    updatedNotes.push(toCamelCase(remoteNote))
                    newNotesCount++
                  }
                } else {
                  if (localNote.syncStatus === SyncStatus.PENDING) {
                    continue
                  }
                  
                  if (localNote.deleted && !remoteNote.deleted) {
                    continue
                  }
                  
                  const remoteUpdated = new Date(remoteNote.updated_at)
                  const localUpdated = new Date(localNote.updatedAt)
                  
                  const bufferMs = 2000
                  if (remoteUpdated.getTime() > localUpdated.getTime() + bufferMs) {
                    const idx = updatedNotes.findIndex(n => n.id === remoteNote.id)
                    if (idx !== -1) {
                      const remoteData = toCamelCase(remoteNote)
                      if (localNote.order !== undefined && localNote.order !== null && remoteData.order === null) {
                        remoteData.order = localNote.order
                      }
                      updatedNotes[idx] = remoteData
                      updatedCount++
                    }
                  } else {
                  }
                }
              }

              return { notes: updatedNotes }
            })
          }

          try {
            await get().loadSharedNotes()
          } catch (err) {
          }

          // Clean up sync queue: remove all non-deletion items that accumulated
          // (insert/update items are synced via syncStatus, not the queue)
          try {
            const remainingItems = await getPendingSyncItems()
            for (const item of remainingItems) {
              if (item.operation !== 'delete') {
                await removeSyncItem(item.id)
              }
            }
          } catch (err) {
          }

          set({ lastSyncTime: new Date().toISOString() })
          
          const showNotifications = useUIStore.getState().showSyncNotifications
          
          if (errorCount > 0 && syncToast) {
            toast.error(`Sync partially failed (${errorCount} errors)`, { id: syncToast })
          } else if (showNotifications && syncToast) {
            toast.success(`Sync successful! ${syncedCount > 0 ? `${syncedCount} changes uploaded.` : 'Everything up to date.'}`, { id: syncToast })
          } else if (syncToast) {
            toast.dismiss(syncToast)
          }
        } catch (error) {
          if (syncToast) {
            toast.error(`Sync failed: ${error.message}`, { id: syncToast })
          }
        } finally {
          set({ isSyncing: false })
        }
      },

      getFilteredNotes: () => {
        const { notes, selectedFolderId, selectedTagFilter, searchQuery } = get()

        let filtered = notes.filter((note) => !note.deleted && !note.archived)

        if (selectedFolderId) {
          filtered = filtered.filter((note) => note.folderId === selectedFolderId)
        }

        if (selectedTagFilter) {
          filtered = filtered.filter((note) =>
            note.tags?.includes(selectedTagFilter)
          )
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          filtered = filtered.filter(
            (note) =>
              note.title.toLowerCase().includes(query) ||
              note.content.toLowerCase().includes(query) ||
              note.tags?.some((tag) => tag.toLowerCase().includes(query))
          )
        }

        return filtered.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          if (a.starred && !b.starred) return -1
          if (!a.starred && b.starred) return 1
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        })
      },

      getSelectedNote: () => {
        const { notes, sharedNotes, selectedNoteId } = get()
        let note = notes.find((note) => note.id === selectedNoteId)
        if (!note) {
          const shared = sharedNotes.find((share) => share.notes?.id === selectedNoteId)
          note = shared?.notes
        }
        return note
      },

      shareNote: async (noteId, email, permission = 'edit') => {
        try {
          const { createShareLink } = await import('../lib/backend')
          const share = await createShareLink(noteId, email, permission)
          
          set((state) => ({
            pendingShares: [...state.pendingShares, share]
          }))
          
          toast.success(`Note shared with ${email}`)
          return share
        } catch (error) {
          toast.error(`Failed to share: ${error.message || 'Unknown error'}`)
          throw error
        }
      },

      acceptShare: async (shareId) => {
        try {
          const { acceptShare } = await import('../lib/backend')
          const { share, acceptedShare } = await acceptShare(shareId)
          
          const newSharedNote = {
            id: acceptedShare.id,
            user_id: acceptedShare.user_id,
            note_id: acceptedShare.note_id,
            permission: acceptedShare.permission,
            created_at: acceptedShare.created_at,
            notes: share.notes ? {
              id: share.notes.id,
              title: share.notes.title,
              content: share.notes.content,
              userId: share.notes.user_id,
              createdAt: share.notes.created_at,
              updatedAt: share.notes.updated_at,
              folderId: share.notes.folder_id,
              tags: share.notes.tags || [],
              starred: share.notes.starred || false,
              pinned: share.notes.pinned || false,
              deleted: share.notes.deleted || false,
              archived: share.notes.archived || false,
              noteType: share.notes.note_type || 'standard',
              noteData: share.notes.note_data || null,
              isShared: true,
              sharePermission: acceptedShare.permission || 'view',
            } : null
          }
          
          if (newSharedNote.notes && newSharedNote.notes.id) {
            set((state) => ({
              sharedNotes: [...state.sharedNotes, newSharedNote],
              pendingShares: state.pendingShares.filter(s => s.id !== shareId)
            }))
          } else {
            set((state) => ({
              pendingShares: state.pendingShares.filter(s => s.id !== shareId)
            }))
            await get().loadSharedNotes()
          }
          
          toast.success('Shared note accepted')
          return { share, acceptedShare }
        } catch (error) {
          toast.error(`Failed to accept share: ${error.message || 'Unknown error'}`)
          throw error
        }
      },

      declineShare: async (shareId) => {
        try {
          const { declineShare } = await import('../lib/backend')
          await declineShare(shareId)
          
          set((state) => ({
            pendingShares: state.pendingShares.filter(s => s.id !== shareId)
          }))
          
          toast.success('Share declined')
        } catch (error) {
          toast.error('Failed to decline share')
          throw error
        }
      },

      removeShare: async (shareId) => {
        try {
          const { removeShare } = await import('../lib/backend')
          await removeShare(shareId)
          
          set((state) => ({
            pendingShares: state.pendingShares.filter(s => s.id !== shareId)
          }))
          
          toast.success('Share removed')
        } catch (error) {
          toast.error('Failed to remove share')
          throw error
        }
      },

      leaveSharedNote: async (noteId) => {
        try {
          const { leaveSharedNote } = await import('../lib/backend')
          await leaveSharedNote(noteId)
          
          set((state) => ({
            sharedNotes: state.sharedNotes.filter(s => s.note_id !== noteId)
          }))
          
          toast.success('Left shared note')
        } catch (error) {
          toast.error('Failed to leave shared note')
          throw error
        }
      },

      loadSharedNotes: async () => {
        if (!isBackendConfigured()) return
        const { user } = get()
        if (!user) return
        
        try {
          const { getSharedNotes, getPendingShares } = await import('../lib/backend')
          const [shared, pending] = await Promise.all([
            getSharedNotes(user.id),
            getPendingShares(user.id)
          ])
          
          const normalizedShared = (shared || []).map(share => ({
            ...share,
            notes: share.notes ? {
              id: share.notes.id,
              title: share.notes.title,
              content: share.notes.content,
              userId: share.notes.user_id,
              folderId: share.notes.folder_id,
              tags: share.notes.tags || [],
              starred: share.notes.starred || false,
              pinned: share.notes.pinned || false,
              deleted: share.notes.deleted || false,
              archived: share.notes.archived || false,
              noteType: share.notes.note_type || 'standard',
              noteData: share.notes.note_data || null,
              createdAt: share.notes.created_at,
              updatedAt: share.notes.updated_at,
              isShared: true,
              sharePermission: share.permission || 'view',
            } : null
          }))
          
          const normalizedPending = (pending || []).map(share => ({
            ...share,
            notes: share.notes ? {
              id: share.notes.id,
              title: share.notes.title,
              content: share.notes.content,
              userId: share.notes.user_id,
            } : null
          }))
          
          set({
            sharedNotes: normalizedShared,
            pendingShares: normalizedPending,
          })
        } catch (error) {
        }
      },
    }),
    {
      name: 'quicknotes-storage',
      partialize: (state) => ({
        notes: state.notes,
        folders: state.folders,
        tags: state.tags,
        lastSyncTime: state.lastSyncTime,
      }),
      onRehydrateStorage: () => (state) => {
        // Repair any mojibake (double-encoded UTF-8) in stored notes
        if (state?.notes?.length) {
          let repaired = false
          const fixedNotes = state.notes.map(note => {
            const fixedTitle = repairMojibake(note.title)
            const fixedContent = repairMojibake(note.content)
            if (fixedTitle !== note.title || fixedContent !== note.content) {
              repaired = true
              return { ...note, title: fixedTitle, content: fixedContent }
            }
            return note
          })
          if (repaired) {
            state.notes = fixedNotes
          }
        }
      },
    }
  )
)

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'quicknotes-theme',
    }
  )
)

export const useUIStore = create(
  persist(
    (set) => ({
      sidebarOpen: true,
      notesListWidth: 320,
      quickNoteOpen: false,
      settingsOpen: false,
      shareModalOpen: false,
      shareNoteId: null,
      sharedNotesViewOpen: false,
      templateModalOpen: false,
      exportModalOpen: false,
      importModalOpen: false,
      reminderModalOpen: false,
      reminderNoteId: null,
      showTrash: false,
      findReplaceOpen: false,
      noteLinkPopoverOpen: false,
      noteLinkPosition: { x: 0, y: 0 },
      imageUploadOpen: false,
      versionHistoryOpen: false,
      versionHistoryNoteId: null,
      duplicateModalOpen: false,
      currentSort: 'updated-desc',
      showFavorites: false,
      globalSearchOpen: false,
      focusModeOpen: false,
      linkModalOpen: false,
      archiveViewOpen: false,
      voiceInputActive: false,
      multiSelectMode: false,
      selectedNoteIds: [],
      shortcutsModalOpen: false,
      templatesModalOpen: false,
      noteTypesModalOpen: false,
      helpModalOpen: false,
      privacyModalOpen: false,
      termsModalOpen: false,
      tagManagerOpen: false,
      mobileEditorOpen: false,
      mobileView: 'notes',
      viewMode: 'list',
      translateModalOpen: false,
      translateText: '',
      language: 'en',
      autoSync: true,
      syncInterval: 5,
      syncOnStartup: true,
      showSyncNotifications: true,
      editorSettingsOpen: false,
      htmlEditorOpen: false,
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setNotesListWidth: (width) => set({ notesListWidth: width }),
  setQuickNoteOpen: (open) => set({ quickNoteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setShareModalOpen: (open, noteId = null) => set({ shareModalOpen: open, shareNoteId: noteId }),
  setSharedNotesViewOpen: (open) => set({ sharedNotesViewOpen: open }),
  setTemplateModalOpen: (open) => set({ templateModalOpen: open }),
  setExportModalOpen: (open) => set({ exportModalOpen: open }),
  setImportModalOpen: (open) => set({ importModalOpen: open }),
  setReminderModalOpen: (open, noteId = null) => set({ reminderModalOpen: open, reminderNoteId: noteId }),
  setShowTrash: (show) => set({ showTrash: show }),
  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),
  setNoteLinkPopoverOpen: (open, position = null) => set({ 
    noteLinkPopoverOpen: open, 
    noteLinkPosition: position || { x: 0, y: 0 } 
  }),
  setImageUploadOpen: (open) => set({ imageUploadOpen: open }),
  setVersionHistoryOpen: (open, noteId = null) => set({ 
    versionHistoryOpen: open, 
    versionHistoryNoteId: noteId 
  }),
  setDuplicateModalOpen: (open) => set({ duplicateModalOpen: open }),
  setCurrentSort: (sort) => set({ currentSort: sort }),
  setShowFavorites: (show) => set({ showFavorites: show, showTrash: false }),
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
  setFocusModeOpen: (open) => set({ focusModeOpen: open }),
  setLinkModalOpen: (open) => set({ linkModalOpen: open }),
  setArchiveViewOpen: (open) => set({ archiveViewOpen: open }),
  setVoiceInputActive: (active) => set({ voiceInputActive: active }),
  setMultiSelectMode: (mode) => set({ multiSelectMode: mode, selectedNoteIds: [] }),
  setShortcutsModalOpen: (open) => set({ shortcutsModalOpen: open }),
  setTemplatesModalOpen: (open) => set({ templatesModalOpen: open }),
  setNoteTypesModalOpen: (open) => set({ noteTypesModalOpen: open }),
  setHelpModalOpen: (open) => set({ helpModalOpen: open }),
  setPrivacyModalOpen: (open) => set({ privacyModalOpen: open }),
  setMobileEditorOpen: (open) => set({ mobileEditorOpen: open, mobileView: open ? 'editor' : 'notes' }),
  setMobileView: (view) => set({ mobileView: view, mobileEditorOpen: view === 'editor' }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTermsModalOpen: (open) => set({ termsModalOpen: open }),
  setTagManagerOpen: (open) => set({ tagManagerOpen: open }),
  setTranslateModalOpen: (open) => set({ translateModalOpen: open }),
  setTranslateText: (text) => set({ translateText: text }),
  openTranslateModal: (text) => set({ translateModalOpen: true, translateText: text }),
  setEditorSettingsOpen: (open) => set({ editorSettingsOpen: open }),
  setHTMLEditorOpen: (open) => set({ htmlEditorOpen: open }),
  toggleNoteSelection: (noteId) => set((state) => {
    const isSelected = state.selectedNoteIds.includes(noteId)
    return {
      selectedNoteIds: isSelected
        ? state.selectedNoteIds.filter((id) => id !== noteId)
        : [...state.selectedNoteIds, noteId],
    }
  }),
  clearNoteSelection: () => set({ selectedNoteIds: [], multiSelectMode: false }),
  setLanguage: (lang) => set({ language: lang }),
  setAutoSync: (enabled) => set({ autoSync: enabled }),
  setSyncInterval: (minutes) => set({ syncInterval: minutes }),
  setSyncOnStartup: (enabled) => set({ syncOnStartup: enabled }),
  setShowSyncNotifications: (enabled) => set({ showSyncNotifications: enabled }),
}),
    {
      name: 'quicknotes-ui-settings',
      partialize: (state) => ({ 
        language: state.language,
        currentSort: state.currentSort,
        notesListWidth: state.notesListWidth,
        viewMode: state.viewMode,
        autoSync: state.autoSync,
        syncInterval: state.syncInterval,
        syncOnStartup: state.syncOnStartup,
        showSyncNotifications: state.showSyncNotifications,
      }),
    }
  )
)
