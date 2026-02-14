import React, { useMemo } from 'react'
import {
  FileText,
  Clock,
  Type,
  Hash,
  Calendar
} from 'lucide-react'

const calculateReadingTime = (wordCount) => {
  const minutes = Math.ceil(wordCount / 200)
  if (minutes < 1) return 'Less than 1 min'
  if (minutes === 1) return '1 min read'
  return `${minutes} min read`
}

export default function NoteStatistics({ note }) {
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

  return (
    <div className="flex-shrink-0 px-6 py-2.5 border-t border-[#cbd1db] dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5" title="Words">
            <Type className="w-3.5 h-3.5" />
            {stats.words.toLocaleString()} words
          </span>
          <span className="flex items-center gap-1.5" title="Characters">
            <Hash className="w-3.5 h-3.5" />
            {stats.characters.toLocaleString()} chars
          </span>
          <span className="flex items-center gap-1.5" title="Reading time">
            <Clock className="w-3.5 h-3.5" />
            {stats.readingTime}
          </span>
          {stats.checklistTotal > 0 && (
            <span className="flex items-center gap-1.5" title="Checklist progress">
              <FileText className="w-3.5 h-3.5" />
              {stats.checklistDone}/{stats.checklistTotal} tasks
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5" title="Last edited">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(stats.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>
    </div>
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
        { label: 'Words', value: stats.words.toLocaleString() },
        { label: 'Characters', value: stats.characters.toLocaleString() },
        { label: 'Characters (with spaces)', value: stats.charactersWithSpaces.toLocaleString() },
        { label: 'Sentences', value: stats.sentences.toLocaleString() },
        { label: 'Paragraphs', value: stats.paragraphs.toLocaleString() },
        { label: 'Lines', value: stats.lines.toLocaleString() },
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
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            {group.title}
          </h4>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
            {group.items.map((item) => (
              <div key={item.label} className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
