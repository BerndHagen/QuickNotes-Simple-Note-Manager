import { ArrowLeft, ArrowRight, Files, PanelRight, Plus } from 'lucide-react'
import { useNotesStore, useUIStore } from '../../store'
import { SyncStatusPill } from '../SyncStatus'
import { BrandLogo, Button, IconButton } from '../ui'
import TopSearch from './TopSearch'

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
  const setQuickNoteOpen = useUIStore((state) => state.setQuickNoteOpen)
  const knowledgeNavigation = useNotesStore((state) => state.knowledgeNavigation)
  const navigateBack = useNotesStore((state) => state.navigateKnowledgeBack)
  const navigateForward = useNotesStore((state) => state.navigateKnowledgeForward)

  return (
    <header
      inert={inactive ? '' : undefined}
      aria-hidden={inactive ? 'true' : undefined}
      className="qn-top-chrome flex h-[var(--qn-top-chrome-height)] shrink-0 items-center border-b border-banner-border bg-banner text-banner-text"
    >
      <div className="qn-top-brand-zone flex min-w-0 items-center gap-1 px-1.5 sm:gap-2 sm:px-2.5 lg:w-sidebar lg:px-3">
        <div className="hidden min-w-0 items-center gap-2 md:flex" aria-label="QuickNotes">
          <BrandLogo className="h-6 w-6" />
          <span className="qn-brand-wordmark truncate text-ui-md font-semibold tracking-[-0.01em]">
            QuickNotes
          </span>
        </div>
        <div className="ml-auto hidden items-center md:flex" aria-label="Note navigation history">
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
        <div className="md:hidden">{navigationToggle}</div>
      </div>

      <div className="relative flex min-w-0 flex-1 items-center justify-center px-1 sm:px-3">
        <TopSearch />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 px-1.5 sm:px-2.5 lg:gap-1 lg:px-3">
        <SyncStatusPill compact className="qn-top-sync flex text-banner-muted xl:hidden" />
        <SyncStatusPill className="qn-top-sync hidden max-w-36 text-banner-muted xl:flex" />
        <div
          role="group"
          aria-label="Workspace panes"
          className="hidden items-center gap-0.5 md:flex lg:gap-1"
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
          aria-label="Create quick note"
          className="qn-top-new ml-0 hidden min-w-9 border border-white/20 bg-white px-2 text-[var(--qn-banner)] shadow-none hover:bg-white/90 md:inline-flex md:min-w-16 xl:ml-1"
        >
          <span className="hidden xl:inline">Quick note</span>
          <span className="hidden sm:inline xl:hidden">New</span>
        </Button>
      </div>
    </header>
  )
}
