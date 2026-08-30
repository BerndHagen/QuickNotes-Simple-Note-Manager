import { ArrowLeft, ArrowRight, Files, PanelRight, Plus, Search } from 'lucide-react'
import { useNotesStore, useUIStore } from '../../store'
import { SyncStatusPill } from '../SyncStatus'
import { BrandLogo, Button, IconButton } from '../ui'

export default function TopChrome({
  navigationToggle,
  collectionOpen,
  onToggleCollection,
  showCollectionControl = true,
  inspectorOpen,
  onToggleInspector,
  showInspectorControl = false,
  inactive = false,
}) {
  const setGlobalSearchOpen = useUIStore((state) => state.setGlobalSearchOpen)
  const setQuickNoteOpen = useUIStore((state) => state.setQuickNoteOpen)
  const knowledgeNavigation = useNotesStore((state) => state.knowledgeNavigation)
  const navigateBack = useNotesStore((state) => state.navigateKnowledgeBack)
  const navigateForward = useNotesStore((state) => state.navigateKnowledgeForward)

  return (
    <header
      inert={inactive ? '' : undefined}
      aria-hidden={inactive ? 'true' : undefined}
      className="qn-top-chrome hidden h-[var(--qn-top-chrome-height)] shrink-0 items-center border-b border-banner-border bg-banner text-banner-text md:flex"
    >
      <div className="flex min-w-0 items-center gap-2 px-2.5 lg:w-sidebar lg:px-3">
        <div className="flex min-w-0 items-center gap-2" aria-label="QuickNotes">
          <BrandLogo className="h-7 w-7" />
          <span className="hidden truncate text-ui-lg font-semibold tracking-[-0.01em] lg:block">
            QuickNotes
          </span>
        </div>
        <div className="hidden items-center md:flex" aria-label="Note navigation history">
          <IconButton
            icon={ArrowLeft}
            tone="onBanner"
            size="sm"
            label="Previous note"
            disabled={!knowledgeNavigation?.back?.length}
            onClick={navigateBack}
          />
          <IconButton
            icon={ArrowRight}
            tone="onBanner"
            size="sm"
            label="Next note"
            disabled={!knowledgeNavigation?.forward?.length}
            onClick={navigateForward}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-3">
        <button
          type="button"
          onClick={() => setGlobalSearchOpen(true)}
          aria-label="Search all notes"
          className="qn-top-search flex h-8 w-full max-w-[32rem] items-center gap-2 border border-banner-border bg-white/[0.07] px-3 text-left text-ui-md text-banner-muted transition-colors duration-fast hover:bg-banner-hover hover:text-banner-text"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search notes and workspaces</span>
          <kbd className="hidden border border-white/15 bg-black/10 px-1.5 py-0.5 font-sans text-ui-xs text-banner-muted xl:inline">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 px-2.5 lg:gap-1 lg:px-3">
        <SyncStatusPill className="qn-top-sync hidden max-w-36 text-banner-muted xl:flex" />
        <div
          role="group"
          aria-label="Workspace panes"
          className="flex items-center gap-0.5 lg:gap-1"
        >
          {navigationToggle}
          {showCollectionControl && (
            <IconButton
              icon={Files}
              tone="onBanner"
              active={collectionOpen}
              label={collectionOpen ? 'Hide note list' : 'Show note list'}
              aria-pressed={collectionOpen}
              aria-controls="qn-collection-pane"
              aria-expanded={collectionOpen}
              onClick={onToggleCollection}
            />
          )}
          {showInspectorControl && (
            <IconButton
              icon={PanelRight}
              tone="onBanner"
              active={inspectorOpen}
              label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
              aria-pressed={inspectorOpen}
              aria-controls="qn-inspector"
              aria-expanded={inspectorOpen}
              onClick={onToggleInspector}
            />
          )}
        </div>
        <Button
          size="sm"
          icon={Plus}
          onClick={() => setQuickNoteOpen(true)}
          className="qn-top-new ml-1 border border-white/20 bg-white text-[var(--qn-banner)] shadow-none hover:bg-white/90"
        >
          <span className="hidden xl:inline">Quick note</span>
          <span className="xl:hidden">New</span>
        </Button>
      </div>
    </header>
  )
}
