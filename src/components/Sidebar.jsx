import { useMemo, useRef, useState } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Copy,
  FolderOpen,
  Keyboard,
  Kanban,
  LogOut,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Settings,
  Star,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useNotesStore, useThemeStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { getFolderIcon } from '../lib/folderIcons'
import { isBackendConfigured } from '../lib/backend'
import { formatShortcut, loadShortcuts } from '../lib/shortcuts'
import { Avatar, Button, Menu, MenuItem, MenuSeparator, NotepadGlyph, TagChip } from './ui'
import { FolderDialog, ConfirmDialog } from './FolderDialogs'

/**
 * Navigation row. A real `<button>`, so the rail is reachable by Tab and
 * operable with Enter/Space.
 */
function NavItem({ icon: Icon, label, count, selected, onClick, iconColor, trailing }) {
  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onClick={onClick}
        aria-current={selected ? 'page' : undefined}
        className={`qn-touch-target flex w-full items-center gap-3 rounded-control px-2.5 py-[7px] text-left transition-colors duration-fast ${
 selected
 ? 'bg-nav-active text-nav-active-text'
            : 'text-nav-muted hover:bg-nav-hover hover:text-nav-text'
        }`}
      >
        <Icon
          className="h-[17px] w-[17px] shrink-0"
          style={iconColor ? { color: iconColor } : undefined}
          aria-hidden="true"
        />
        <span className={`min-w-0 flex-1 truncate text-ui-lg ${selected ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
        {count > 0 && (
          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-ui-xs font-semibold tabular-nums text-nav-muted">
            {count > 999 ? '999+' : count}
          </span>
        )}
      </button>
      {trailing}
    </div>
  )
}

function SectionHeader({ label, expanded, onToggle, action }) {
  return (
    <div className="flex items-center justify-between gap-1 pl-1.5 pr-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="qn-touch-target flex min-w-0 flex-1 items-center gap-1.5 rounded-control py-1 pr-1 text-ui-xs font-semibold uppercase tracking-[0.08em] text-nav-subtle transition-colors duration-fast hover:text-nav-muted"
      >
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-fast ${expanded ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </button>
      {action}
    </div>
  )
}

/** Icon control tuned for the dark rail. */
function NavIconButton({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`qn-square-control inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-nav-subtle transition-colors duration-fast hover:bg-nav-hover hover:text-nav-text ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

export default function Sidebar({ onNavigate }) {
  const { t } = useTranslation()
  const newNoteShortcut = formatShortcut(loadShortcuts().newNote)
  const {
    folders,
    tags,
    notes,
    selectedFolderId,
    selectedTagFilter,
    createFolder,
    updateFolder,
    deleteFolder,
    setSelectedFolder,
    setSelectedTagFilter,
    user,
    pendingShares,
    logout,
  } = useNotesStore()

  const { theme, setTheme } = useThemeStore()
  const {
    setSidebarOpen,
    setQuickNoteOpen,
    setSettingsOpen,
    setShowTrash,
    setDuplicateModalOpen,
    setArchiveViewOpen,
    setNoteTypesModalOpen,
    setTagManagerOpen,
    setSharedNotesViewOpen,
    setHelpModalOpen,
    setShortcutsModalOpen,
  } = useUIStore()

  const [sections, setSections] = useState({ folders: true, tags: true })
  const [folderDialog, setFolderDialog] = useState(null)
  const [folderMenu, setFolderMenu] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const accountRef = useRef(null)
  const [accountOpen, setAccountOpen] = useState(false)

  /**
   * Every count the rail shows, from a single pass over `notes` — a row
   * filtering the array itself would cost one full scan per folder and tag
   * on every render.
   */
  const counts = useMemo(() => {
    const byFolder = new Map()
    const byTag = new Map()
    let all = 0
    let favorites = 0
    let trash = 0
    let archive = 0

    for (const note of notes) {
      if (note.deleted) {
        trash += 1
        continue
      }
      if (note.folderId) byFolder.set(note.folderId, (byFolder.get(note.folderId) || 0) + 1)
      for (const tag of note.tags || []) byTag.set(tag, (byTag.get(tag) || 0) + 1)
      if (note.archived) {
        archive += 1
        continue
      }
      all += 1
      if (note.starred) favorites += 1
    }
    return { byFolder, byTag, all, favorites, trash, archive }
  }, [notes])

  const go = (fn) => () => {
    fn()
    onNavigate?.()
  }

  const cycleTheme = () => {
    const order = ['light', 'dark', 'system']
    setTheme(order[(order.indexOf(theme) + 1) % order.length])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeLabel =
    theme === 'light'
      ? t('settings.themeLight')
      : theme === 'dark'
        ? t('settings.themeDark')
        : t('settings.themeSystem')

  const accountName = user?.username || user?.user_metadata?.username || 'Account'
  const accountDetail = user?.isLocal ? t('auth.localWorkspace', 'Saved on this device') : user?.email
  const isAllNotes = !selectedFolderId && !selectedTagFilter
  const cloudEnabled = isBackendConfigured()

  return (
    <nav
      aria-label="Workspace"
      className="qn-nav-surface flex h-full w-full flex-col bg-nav text-nav-text"
    >
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5 px-4 pb-4 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-white/10 bg-[linear-gradient(140deg,#0e5341,#05352a)] text-white shadow-sm">
          <NotepadGlyph className="h-6 w-6 shrink-0" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-title-xs font-bold leading-tight text-nav-text">QuickNotes</p>
          <p className="truncate text-ui-sm leading-tight text-nav-subtle">
            {t('sidebar.noteManager', 'Note Manager')}
          </p>
        </div>
        <NavIconButton
          icon={X}
          label={t('common.close', 'Close navigation')}
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden"
        />
      </div>

      {/* Quick note */}
      <div className="shrink-0 px-4 pb-4">
        {/* The rail's primary action. Built from the shared Button so it picks
            up the accent tokens; the ring gives it an edge against the rail,
            which is itself dark green. */}
        <Button
          variant="primary"
          fullWidth
          icon={Plus}
          onClick={go(() => setQuickNoteOpen(true))}
          className="h-10 justify-start rounded-[10px] px-3.5 text-ui-lg ring-1 ring-white/15"
        >
          <span className="flex-1 text-left">{t('sidebar.quickNote')}</span>
          <kbd className="shrink-0 font-sans text-ui-xs font-medium text-white/70">{newNoteShortcut}</kbd>
        </Button>
      </div>

      {/* Scrollable navigation */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-4">
        <ul className="space-y-0.5">
          <li>
            <NavItem
              icon={FolderOpen}
              label={t('sidebar.allNotes')}
              count={counts.all}
              selected={isAllNotes}
              onClick={go(() => {
                setSelectedFolder(null)
                setSelectedTagFilter(null)
              })}
            />
          </li>
          <li>
            <NavItem
              icon={Star}
              label={t('sidebar.favorites')}
              count={counts.favorites}
              selected={selectedTagFilter === '__starred__'}
              onClick={go(() => setSelectedTagFilter('__starred__'))}
            />
          </li>
          {cloudEnabled && (
            <li>
              <NavItem
                icon={Users}
                label={t('sidebar.sharedNotes', 'Shared with me')}
                count={pendingShares?.length || 0}
                onClick={go(() => setSharedNotesViewOpen(true))}
              />
            </li>
          )}
          <li>
            <NavItem
              icon={Trash2}
              label={t('sidebar.trash')}
              count={counts.trash}
              onClick={go(() => setShowTrash(true))}
            />
          </li>
          <li>
            <NavItem
              icon={Archive}
              label={t('sidebar.archive')}
              count={counts.archive}
              onClick={go(() => setArchiveViewOpen(true))}
            />
          </li>
          <li>
            <NavItem
              icon={Kanban}
              label={t('sidebar.noteTypes', 'Workspaces & Kanban')}
              onClick={go(() => setNoteTypesModalOpen(true))}
            />
          </li>
          <li>
            <NavItem
              icon={Copy}
              label={t('sidebar.findDuplicates')}
              onClick={go(() => setDuplicateModalOpen(true))}
            />
          </li>
        </ul>

        {/* Folders */}
        <section aria-label={t('sidebar.folders')}>
          <SectionHeader
            label={t('sidebar.folders')}
            expanded={sections.folders}
            onToggle={() => setSections((s) => ({ ...s, folders: !s.folders }))}
            action={
              <NavIconButton
                icon={Plus}
                label={t('folders.createFolder', 'New folder')}
                onClick={go(() => setFolderDialog({}))}
              />
            }
          />
          {sections.folders && (
            <ul className="mt-1 space-y-0.5">
              {folders.length === 0 && (
                <li className="px-2.5 py-1.5 text-ui-md text-nav-subtle">
                  {t('folders.empty', 'No folders yet')}
                </li>
              )}
              {folders.map((folder) => {
                const Icon = getFolderIcon(folder.icon)
                return (
                  <li
                    key={folder.id}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setFolderMenu({ folder, point: { x: e.clientX, y: e.clientY } })
                    }}
                  >
                    <NavItem
                      icon={Icon}
                      iconColor={folder.color}
                      label={folder.name}
                      count={counts.byFolder.get(folder.id) || 0}
                      selected={selectedFolderId === folder.id}
                      onClick={go(() => setSelectedFolder(folder.id))}
                      trailing={
                        /* The rail paints a gradient, so this control masks the
                           label behind it with a blur rather than a flat fill. */
                        <NavIconButton
                          icon={Pencil}
                          label={`${t('common.edit', 'Edit')} ${folder.name}`}
                          onClick={go(() => setFolderDialog({ folder }))}
                          className="qn-nav-row-action absolute right-1.5 bg-[rgba(8,61,49,0.92)] opacity-0 backdrop-blur-sm focus-visible:opacity-100 group-hover:opacity-100"
                        />
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Tags */}
        <section aria-label={t('sidebar.tags')}>
          <SectionHeader
            label={t('sidebar.tags')}
            expanded={sections.tags}
            onToggle={() => setSections((s) => ({ ...s, tags: !s.tags }))}
            action={
              <NavIconButton
                icon={Settings}
                label={t('tags.manage', 'Manage tags')}
                onClick={go(() => setTagManagerOpen(true))}
              />
            }
          />
          {sections.tags && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 px-1.5">
              {tags.length === 0 && (
                <p className="text-ui-md text-nav-subtle">{t('tags.empty', 'No tags yet')}</p>
              )}
              {tags.map((tag) => {
                const active = selectedTagFilter === tag.name
                return (
                  <TagChip
                    key={tag.id}
                    as="button"
                    type="button"
                    surface="dark"
                    aria-pressed={active}
                    onClick={go(() => setSelectedTagFilter(tag.name))}
                    name={tag.name}
                    color={tag.color}
                    count={counts.byTag.get(tag.name) || 0}
                    className={active ? 'ring-1 ring-white/40' : ''}
                  />
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="qn-safe-bottom shrink-0 px-3 pb-3">
        <ul className="space-y-0.5 border-t border-nav-border pt-2">
          <li>
            <NavItem
              icon={Settings}
              label={t('sidebar.settings', 'Settings')}
              onClick={go(() => setSettingsOpen(true))}
            />
          </li>
          <li>
            <NavItem
              icon={Keyboard}
              label={t('sidebar.keyboardShortcuts', 'Keyboard shortcuts')}
              onClick={go(() => setShortcutsModalOpen(true))}
            />
          </li>
          <li>
            <NavItem
              icon={HelpCircle}
              label={t('sidebar.help', 'Help & Support')}
              onClick={go(() => setHelpModalOpen(true))}
              trailing={
                <ChevronRight
                  className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-nav-subtle"
                  aria-hidden="true"
                />
              }
            />
          </li>
        </ul>

        <button
          ref={accountRef}
          type="button"
          onClick={() => setAccountOpen((v) => !v)}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          className="mt-2 flex w-full items-center gap-2.5 rounded-control border-t border-nav-border px-2 pb-1 pt-3 text-left transition-colors duration-fast hover:bg-nav-hover"
        >
          <Avatar user={user} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui-lg font-semibold text-nav-text">{accountName}</span>
            <span className="block truncate text-ui-sm text-nav-subtle">{accountDetail}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-nav-subtle" aria-hidden="true" />
        </button>
      </div>

      <Menu
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        anchorRef={accountRef}
        placement="top-start"
        label="Account"
        width={220}
      >
        <MenuItem
          icon={Settings}
          onClick={() => {
            setAccountOpen(false)
            setSettingsOpen(true)
            onNavigate?.()
          }}
        >
          {t('sidebar.settings', 'Settings')}
        </MenuItem>
        <MenuItem
          icon={ThemeIcon}
          onClick={() => {
            setAccountOpen(false)
            cycleTheme()
          }}
        >
          {`${t('settings.theme', 'Theme')}: ${themeLabel}`}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={LogOut}
          tone="danger"
          disabled={isSigningOut}
          aria-busy={isSigningOut || undefined}
          onClick={async () => {
            if (isSigningOut) return
            setIsSigningOut(true)
            try {
              const signedOut = await logout()
              if (signedOut) {
                setAccountOpen(false)
                onNavigate?.()
              }
            } finally {
              setIsSigningOut(false)
            }
          }}
        >
          {user?.isLocal
            ? t('auth.closeWorkspace', 'Close workspace')
            : t('auth.signOut', 'Sign out')}
        </MenuItem>
      </Menu>

      <Menu
        open={!!folderMenu}
        onClose={() => setFolderMenu(null)}
        point={folderMenu?.point}
        label={folderMenu?.folder?.name}
        width={190}
      >
        <MenuItem
          icon={Pencil}
          onClick={() => {
            setFolderDialog({ folder: folderMenu.folder })
            setFolderMenu(null)
            onNavigate?.()
          }}
        >
          {t('common.edit', 'Edit folder')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={Trash2}
          tone="danger"
          onClick={() => {
            setConfirmDelete(folderMenu.folder)
            setFolderMenu(null)
            onNavigate?.()
          }}
        >
          {t('common.delete', 'Delete folder')}
        </MenuItem>
      </Menu>

      <FolderDialog
        open={!!folderDialog}
        folder={folderDialog?.folder}
        existingNames={folders.map((f) => f.name)}
        onClose={() => setFolderDialog(null)}
        onSubmit={(data) =>
          folderDialog?.folder ? updateFolder(folderDialog.folder.id, data) : createFolder(data)
        }
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => deleteFolder(confirmDelete.id)}
        icon={Trash2}
        title={t('folders.deleteFolder', 'Delete folder?')}
        description={
          confirmDelete
            ? `"${confirmDelete.name}" will be removed. Its ${
                counts.byFolder.get(confirmDelete.id) || 0
              } note(s) are kept and moved out of the folder.`
            : ''
        }
        confirmLabel={t('common.delete', 'Delete folder')}
        cancelLabel={t('common.cancel', 'Cancel')}
      />
    </nav>
  )
}
