import { useMemo } from 'react'
import { FileText, Clock, Type, Hash, Share2 } from 'lucide-react'
import { SaveStatus } from './SyncStatus'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { formatSyncTime } from '../lib/utils'
import { isBackendConfigured } from '../lib/backend'

const calculateReadingTime = (wordCount) => {
  const minutes = Math.ceil(wordCount / 200)
  if (minutes < 1) return 'Less than 1 min'
  if (minutes === 1) return '1 min read'
  return `${minutes} min read`
}

export default function NoteStatistics({ note }) {
  const setShareModalOpen = useUIStore((s) => s.setShareModalOpen)
  const { t } = useTranslation()

  const stats = useMemo(() => {
    if (!note) return null

    const plainText = note.content 
      ? note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
      : ''
    
    const characters = plainText.replace(/\s/g, '').length
    
    const charactersWithSpaces = plainText.length
    
    const words = plainText.trim().split(/\s+/).filter(Boolean).length
    
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0).length
    
    const paragraphs = note.content 
      ? (note.content.match(/<p[^>]*>/gi) || []).length || 1
      : 0
    
    const lines = plainText.split(/\n/).filter(l => l.trim().length > 0).length || 1
    
    const readingTime = calculateReadingTime(words)
    
    const speakingMinutes = Math.ceil(words / 150)
    const speakingTime = speakingMinutes < 1 ? 'Less than 1 min' : `${speakingMinutes} min`
    
    const tagCount = note.tags?.length || 0
    
    const linkCount = (note.content?.match(/<a[^>]*href/gi) || []).length
    
    const checklistTotal = (note.content?.match(/data-type="taskItem"/gi) || []).length
    const checklistDone = (note.content?.match(/data-checked="true"/gi) || []).length
    
    return {
      characters,
      charactersWithSpaces,
      words,
      sentences,
      paragraphs,
      lines,
      readingTime,
      speakingTime,
      tagCount,
      linkCount,
      checklistTotal,
      checklistDone,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
  }, [note])

  if (!stats) return null
  const isSpecialized = note.noteType && note.noteType !== 'standard'

  /* Metrics scroll horizontally inside their own track on narrow screens; the
     save state stays pinned so it is never scrolled out of reach. The track
     takes focus so it can also be scrolled with the arrow keys. */
  return (
    <footer className="qn-safe-bottom flex shrink-0 items-center gap-3 border-t border-subtle bg-surface px-3 py-2 sm:px-5">
      {isSpecialized ? (
        <span className="min-w-0 flex-1 text-ui-sm text-content-subtle">
          Structured workspace
        </span>
      ) : (
        <ul
          tabIndex={0}
          aria-label="Note statistics"
          className="qn-focus-inset flex min-w-0 flex-1 items-center gap-3 overflow-x-auto text-ui-sm text-content-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <li className="flex shrink-0 items-center gap-1.5">
            <Type className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            <span className="tabular-nums">{stats.words.toLocaleString('en-US')}</span> words
          </li>
          <li className="flex shrink-0 items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            <span className="tabular-nums">{stats.characters.toLocaleString('en-US')}</span> chars
          </li>
          <li className="flex shrink-0 items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            {stats.readingTime}
          </li>
          {stats.checklistTotal > 0 && (
            <li className="flex shrink-0 items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
              <span className="tabular-nums">
                {stats.checklistDone}/{stats.checklistTotal}
              </span>{' '}
              tasks
            </li>
          )}
        </ul>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-ui-sm text-content-subtle lg:inline">
          {t('editor.lastEdited', 'Last edited')}: {formatSyncTime(stats.updatedAt)}
        </span>
        <SaveStatus note={note} />
        {isBackendConfigured() && (
          <button
            type="button"
            onClick={() => setShareModalOpen(true, note.id)}
            className="hidden h-control-sm items-center gap-1.5 rounded-control border border-strong px-2.5 text-ui-sm font-medium text-content transition-colors duration-fast hover:bg-surface-hover sm:inline-flex"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('editor.share', 'Share')}
          </button>
        )}
      </div>
    </footer>
  )
}

export function NoteStatisticsDetailed({ note }) {
  const stats = useMemo(() => {
    if (!note) return null

    const plainText = note.content 
      ? note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
      : ''
    
    const characters = plainText.replace(/\s/g, '').length
    const charactersWithSpaces = plainText.length
    const words = plainText.trim().split(/\s+/).filter(Boolean).length
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0).length
    const paragraphs = note.content 
      ? (note.content.match(/<p[^>]*>/gi) || []).length || 1
      : 0
    const lines = plainText.split(/\n/).filter(l => l.trim().length > 0).length || 1
    const readingTime = calculateReadingTime(words)
    const speakingMinutes = Math.ceil(words / 150)
    const speakingTime = speakingMinutes < 1 ? 'Less than 1 min' : `${speakingMinutes} min`
    const tagCount = note.tags?.length || 0
    const linkCount = (note.content?.match(/<a[^>]*href/gi) || []).length
    const checklistTotal = (note.content?.match(/data-type="taskItem"/gi) || []).length
    const checklistDone = (note.content?.match(/data-checked="true"/gi) || []).length
    const headingCount = (note.content?.match(/<h[1-6][^>]*>/gi) || []).length
    const codeBlockCount = (note.content?.match(/<pre[^>]*>/gi) || []).length
    const imageCount = (note.content?.match(/<img[^>]*>/gi) || []).length
    
    const allWords = plainText.trim().split(/\s+/).filter(Boolean)
    const avgWordLength = allWords.length > 0 
      ? (allWords.reduce((sum, w) => sum + w.length, 0) / allWords.length).toFixed(1)
      : 0
    
    const avgSentenceLength = sentences > 0 
      ? Math.round(words / sentences)
      : 0

    return {
      characters,
      charactersWithSpaces,
      words,
      sentences,
      paragraphs,
      lines,
      readingTime,
      speakingTime,
      tagCount,
      linkCount,
      checklistTotal,
      checklistDone,
      headingCount,
      codeBlockCount,
      imageCount,
      avgWordLength,
      avgSentenceLength,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
  }, [note])

  if (!stats) return null

  const statGroups = [
    {
      title: 'Content',
      items: [
        { label: 'Words', value: stats.words.toLocaleString('en-US') },
        { label: 'Characters', value: stats.characters.toLocaleString('en-US') },
        { label: 'Characters (with spaces)', value: stats.charactersWithSpaces.toLocaleString('en-US') },
        { label: 'Sentences', value: stats.sentences.toLocaleString('en-US') },
        { label: 'Paragraphs', value: stats.paragraphs.toLocaleString('en-US') },
        { label: 'Lines', value: stats.lines.toLocaleString('en-US') },
      ]
    },
    {
      title: 'Time',
      items: [
        { label: 'Reading time', value: stats.readingTime },
        { label: 'Speaking time', value: stats.speakingTime },
      ]
    },
    {
      title: 'Structure',
      items: [
        { label: 'Headings', value: stats.headingCount },
        { label: 'Links', value: stats.linkCount },
        { label: 'Code blocks', value: stats.codeBlockCount },
        { label: 'Images', value: stats.imageCount },
        { label: 'Tags', value: stats.tagCount },
        ...(stats.checklistTotal > 0 ? [
          { label: 'Tasks', value: `${stats.checklistDone}/${stats.checklistTotal}` }
        ] : [])
      ]
    },
    {
      title: 'Readability',
      items: [
        { label: 'Avg. word length', value: `${stats.avgWordLength} chars` },
        { label: 'Avg. sentence length', value: `${stats.avgSentenceLength} words` },
      ]
    },
    {
      title: 'Dates',
      items: [
        { 
          label: 'Created', 
          value: new Date(stats.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        },
        { 
          label: 'Last modified', 
          value: new Date(stats.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        },
      ]
    }
  ]

  return (
    <div className="space-y-4">
      {statGroups.map((group) => (
        <div key={group.title}>
          <h4 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
            {group.title}
          </h4>
          <div className="bg-surface-sunken rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
            {group.items.map((item) => (
              <div key={item.label} className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm text-content-muted">{item.label}</span>
                <span className="text-sm font-medium text-content">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
