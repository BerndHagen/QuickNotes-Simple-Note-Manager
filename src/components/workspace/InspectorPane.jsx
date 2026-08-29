import { useMemo, useState } from 'react'
import { Copy, FileText, Link2, ListTree, X } from 'lucide-react'
import { useNotesStore } from '../../store'
import { formatSyncTime, htmlToPlainText } from '../../lib/utils'
import { NOTE_TYPE_CONFIG, NOTE_TYPES } from '../editors/noteTypes'
import { useBacklinks, useForwardLinks } from '../NoteLinkPopover'
import { IconButton, TagChip } from '../ui'
import { createInternalNoteHref } from '../../lib/knowledge/links'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'info', label: 'Info', icon: FileText },
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'links', label: 'Links', icon: Link2 },
]

const parseOutline = (html = '') => {
  const documentNode = new DOMParser().parseFromString(html, 'text/html')
  return [...documentNode.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading, index) => ({
    id: heading.getAttribute('data-anchor-id') || `legacy-heading-${index}`,
    index,
    level: Number(heading.tagName.slice(1)),
    text: heading.textContent?.trim() || 'Untitled section',
  }))
}

export default function InspectorPane({ onClose, embedded = false }) {
  const note = useNotesStore((state) => state.getSelectedNote())
  const folders = useNotesStore((state) => state.folders)
  const tags = useNotesStore((state) => state.tags)
  const navigateToKnowledgeTarget = useNotesStore((state) => state.navigateToKnowledgeTarget)
  const [activeTab, setActiveTab] = useState('info')
  const backlinks = useBacklinks(note?.id)
  const forwardLinks = useForwardLinks(note?.id)

  const outline = useMemo(() => parseOutline(note?.content), [note?.content])
  const plainText = useMemo(() => htmlToPlainText(note?.content || ''), [note?.content])
  const words = plainText.trim() ? plainText.trim().split(/\s+/u).length : 0
  const folder = note?.folderId ? folders.find((item) => item.id === note.folderId) : null
  const noteType = note?.noteType || NOTE_TYPES.STANDARD
  const typeLabel = NOTE_TYPE_CONFIG[noteType]?.name || 'Document'
  const tagColor = (name) => tags.find((tag) => tag.name === name)?.color || '#6b7280'

  const focusHeading = (heading) => {
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(heading.id) : heading.id
    const target = document.querySelector(`.ProseMirror [data-anchor-id="${escaped}"]`) ||
      document.querySelectorAll('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6')[heading.index]
    target
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const copyHeadingLink = async (heading) => {
    const href = createInternalNoteHref({ noteId: note.id, anchorId: heading.id })
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}${href}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Heading link copied')
    } catch {
      toast.error('Could not copy the heading link')
    }
  }

  return (
    <aside id="qn-inspector" aria-label="Inspector" className="flex h-full min-h-0 flex-col bg-panel">
      {!embedded && (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-subtle px-3">
          <h2 className="min-w-0 flex-1 truncate text-title-sm font-semibold text-content">Inspector</h2>
          <IconButton icon={X} size="sm" label="Hide inspector" onClick={onClose} />
        </header>
      )}

      <div role="tablist" aria-label="Inspector sections" className="flex shrink-0 border-b border-subtle px-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`qn-inspector-${id}`}
            onClick={() => setActiveTab(id)}
            className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-1 text-ui-sm font-medium transition-colors ${
              activeTab === id
                ? 'border-accent text-accent-text'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {activeTab === 'info' && (
          <div id="qn-inspector-info" role="tabpanel" className="space-y-5">
            <section>
              <h3 className="qn-inspector-heading">Properties</h3>
              <dl className="qn-inspector-list">
                <div><dt>Type</dt><dd>{typeLabel}</dd></div>
                <div><dt>Folder</dt><dd>{folder?.name || 'No folder'}</dd></div>
                <div><dt>Created</dt><dd>{formatSyncTime(note?.createdAt)}</dd></div>
                <div><dt>Updated</dt><dd>{formatSyncTime(note?.updatedAt)}</dd></div>
              </dl>
            </section>

            {noteType === NOTE_TYPES.STANDARD && (
              <section>
                <h3 className="qn-inspector-heading">Document</h3>
                <dl className="qn-inspector-list">
                  <div><dt>Words</dt><dd>{words.toLocaleString('en-US')}</dd></div>
                  <div><dt>Characters</dt><dd>{plainText.length.toLocaleString('en-US')}</dd></div>
                  <div><dt>Headings</dt><dd>{outline.length}</dd></div>
                </dl>
              </section>
            )}

            <section>
              <h3 className="qn-inspector-heading">Tags</h3>
              {note?.tags?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {note.tags.map((tag) => <TagChip key={tag} name={tag} color={tagColor(tag)} />)}
                </div>
              ) : (
                <p className="text-ui-md text-content-subtle">No tags assigned</p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'outline' && (
          <div id="qn-inspector-outline" role="tabpanel">
            {outline.length ? (
              <ol className="space-y-0.5">
                {outline.map((heading) => (
                  <li key={heading.id}>
                    <div className="group flex items-center">
                      <button
                        type="button"
                        onClick={() => focusHeading(heading)}
                        className="min-w-0 flex-1 truncate border-l-2 border-transparent py-1.5 pr-2 text-left text-ui-md text-content-muted hover:border-accent hover:bg-surface-hover hover:text-content"
                        style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }}
                      >
                        {heading.text}
                      </button>
                      {heading.id !== `legacy-heading-${heading.index}` && (
                        <button
                          type="button"
                          onClick={() => copyHeadingLink(heading)}
                          aria-label={`Copy link to ${heading.text}`}
                          className="qn-inspector-row-action qn-square-control h-7 w-7 shrink-0 text-content-subtle opacity-0 hover:text-content focus:opacity-100 group-hover:opacity-100"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-2 text-ui-md text-content-subtle">No headings in this document.</p>
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div id="qn-inspector-links" role="tabpanel">
            <h3 className="qn-inspector-heading">Links from this note</h3>
            {forwardLinks.length ? (
              <ul className="mb-5 divide-y divide-[var(--qn-border-subtle)]">
                {forwardLinks.map((link) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      disabled={link.targetBroken || link.targetDeleted}
                      onClick={() => navigateToKnowledgeTarget({ noteId: link.targetNoteId, anchorId: link.targetAnchorId, objectId: link.targetObjectId })}
                      className="flex w-full items-start gap-2 py-2 text-left text-ui-md text-content-muted hover:text-content disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-text" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate">{link.targetTitle}</span>
                        <span className="block truncate text-ui-xs text-content-subtle">{link.targetBroken ? 'Broken link' : link.targetDeleted ? 'In Trash' : link.context}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="mb-5 py-2 text-ui-md text-content-subtle">No links from this note.</p>}

            <h3 className="qn-inspector-heading">Backlinks</h3>
            {backlinks.length ? (
              <ul className="divide-y divide-[var(--qn-border-subtle)]">
                {backlinks.map((backlink) => (
                  <li key={backlink.linkId || backlink.id}>
                    <button
                      type="button"
                      disabled={backlink.sourceDeleted}
                      onClick={() => navigateToKnowledgeTarget({ noteId: backlink.sourceNoteId, anchorId: backlink.sourceAnchorId, objectId: backlink.sourceObjectId })}
                      className="flex w-full items-start gap-2 py-2 text-left text-ui-md text-content-muted hover:text-content disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-accent-text" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate">{backlink.title || 'Untitled note'}</span>
                        <span className="block line-clamp-2 text-ui-xs text-content-subtle">{backlink.sourceDeleted ? 'Source is in Trash' : backlink.context}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-ui-md text-content-subtle">No notes link to this one.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
