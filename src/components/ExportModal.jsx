import { useState } from 'react'
import { X, FileText, FileCode, File, Download, Check } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { hasSpecializedEditor } from './editors'
import toast from 'react-hot-toast'
import LegacyDialog from './ui/LegacyDialog'
import { escapeHtml, sanitizeNoteHtml } from '../lib/sanitizeHtml'
import { htmlToMarkdown, htmlToPlainText } from '../lib/noteTransfer'

const noteDataToHtml = (noteType, noteData, noteTitle) => {
  if (!noteData) return '<p>No content</p>'

  switch (noteType) {
    case 'todo': {
      const tasks = noteData.tasks || []
      if (tasks.length === 0) return '<p>No tasks</p>'
      const done = tasks.filter(t => t.completed).length
      let html = `<p><strong>Progress:</strong> ${done}/${tasks.length} completed</p>`
      html += '<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr>'
      html += '<th style="border:1px solid #e5e7eb;padding:8px;text-align:left;background:#f3f4f6">Status</th>'
      html += '<th style="border:1px solid #e5e7eb;padding:8px;text-align:left;background:#f3f4f6">Task</th>'
      html += '<th style="border:1px solid #e5e7eb;padding:8px;text-align:left;background:#f3f4f6">Priority</th>'
      html += '<th style="border:1px solid #e5e7eb;padding:8px;text-align:left;background:#f3f4f6">Due Date</th>'
      html += '</tr></thead><tbody>'
      tasks.forEach(task => {
        const status = task.completed ? '✅' : '⬜'
        const priority = {
          high: '🔴 High',
          medium: '🟡 Medium',
          low: '🟢 Low',
          none: 'No priority',
        }[task.priority] || 'No priority'
        const due = task.dueDate || '-'
        html += `<tr><td style="border:1px solid #e5e7eb;padding:8px">${status}</td>`
        html += `<td style="border:1px solid #e5e7eb;padding:8px">${task.text || task.title || ''}</td>`
        html += `<td style="border:1px solid #e5e7eb;padding:8px">${priority}</td>`
        html += `<td style="border:1px solid #e5e7eb;padding:8px">${due}</td></tr>`
        if (task.subtasks?.length) {
          html += `<tr><td></td><td colspan="3" style="border:1px solid #e5e7eb;padding:8px"><strong>Subtasks:</strong><ul>`
          task.subtasks.forEach(subtask => {
            html += `<li>${subtask.completed ? '✅' : '⬜'} ${subtask.text || ''}</li>`
          })
          html += '</ul></td></tr>'
        }
        if (task.notes) {
          html += `<tr><td></td><td colspan="3" style="border:1px solid #e5e7eb;padding:8px"><strong>Notes:</strong> ${task.notes}</td></tr>`
        }
      })
      html += '</tbody></table>'
      return html
    }

    case 'shopping': {
      const items = noteData.items || []
      const budget = noteData.budget
      const currency = noteData.currency || 'USD'
      if (items.length === 0) return '<p>No items</p>'
      const checked = items.filter(i => i.checked).length
      let html = `<p><strong>${checked}/${items.length} items checked</strong></p>`
      if (budget) html += `<p><strong>Budget:</strong> ${currency} ${budget}</p>`
      const categories = {}
      items.forEach(item => {
        const cat = item.category || 'other'
        if (!categories[cat]) categories[cat] = []
        categories[cat].push(item)
      })
      Object.entries(categories).forEach(([cat, catItems]) => {
        const categoryName = noteData.categories?.find(category => category.id === cat)?.name
          || cat.charAt(0).toUpperCase() + cat.slice(1)
        html += `<h3>${categoryName}</h3>`
        html += '<table style="width:100%;border-collapse:collapse;margin:8px 0"><thead><tr>'
        html += '<th style="border:1px solid #e5e7eb;padding:6px;background:#f3f4f6">✓</th>'
        html += '<th style="border:1px solid #e5e7eb;padding:6px;background:#f3f4f6">Item</th>'
        html += '<th style="border:1px solid #e5e7eb;padding:6px;background:#f3f4f6">Qty</th>'
        html += '<th style="border:1px solid #e5e7eb;padding:6px;background:#f3f4f6">Price</th>'
        html += '</tr></thead><tbody>'
        catItems.forEach(item => {
          html += `<tr><td style="border:1px solid #e5e7eb;padding:6px">${item.checked ? '✅' : '⬜'}</td>`
          html += `<td style="border:1px solid #e5e7eb;padding:6px">${item.name || ''}</td>`
          html += `<td style="border:1px solid #e5e7eb;padding:6px">${item.quantity || 1} ${item.unit || 'pcs'}</td>`
          html += `<td style="border:1px solid #e5e7eb;padding:6px">${item.price ? `${currency} ${item.price}` : '-'}</td></tr>`
          if (item.note) {
            html += `<tr><td></td><td colspan="3" style="border:1px solid #e5e7eb;padding:6px"><em>${item.note}</em></td></tr>`
          }
        })
        html += '</tbody></table>'
      })
      const total = items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0)
      if (total > 0) html += `<p><strong>Total: ${currency} ${total.toFixed(2)}</strong></p>`
      return html
    }

    case 'meeting': {
      let html = ''
      if (noteTitle || noteData.title) html += `<h2>${noteTitle || noteData.title}</h2>`
      if (noteData.date) html += `<p><strong>Date:</strong> ${noteData.date}</p>`
      if (noteData.startTime || noteData.endTime) {
        html += `<p><strong>Time:</strong> ${noteData.startTime || '—'}${noteData.endTime ? `–${noteData.endTime}` : ''}</p>`
      }
      if (noteData.location) html += `<p><strong>Location:</strong> ${noteData.location}</p>`
      const attendees = noteData.attendees || []
      if (attendees.length > 0) {
        html += `<h3>Attendees (${attendees.length})</h3><ul>`
        attendees.forEach(a => {
          const name = typeof a === 'string' ? a : (a.name || a.email || '')
          const role = typeof a === 'object' && a.role ? ` — ${a.role}` : ''
          const attendance = typeof a === 'object' && a.present === false ? ' (absent)' : ''
          html += `<li>${name}${role}${attendance}</li>`
        })
        html += '</ul>'
      }
      const agenda = noteData.agenda || []
      if (agenda.length > 0) {
        html += '<h3>Agenda</h3><ol>'
        agenda.forEach(item => {
          if (typeof item === 'string') {
            html += `<li>${item}</li>`
            return
          }
          const meta = [
            item.duration ? `${item.duration} min` : '',
            item.presenter || '',
          ].filter(Boolean).join(' · ')
          html += `<li>${item.completed ? '✅ ' : ''}${item.topic || item.text || item.title || ''}${meta ? ` <em>(${meta})</em>` : ''}${item.notes ? `<p>${item.notes}</p>` : ''}</li>`
        })
        html += '</ol>'
      }
      if (noteData.notes) html += `<h3>Notes</h3><div>${noteData.notes}</div>`
      const actions = noteData.actionItems || []
      if (actions.length > 0) {
        html += '<h3>Action Items</h3><ul>'
        actions.forEach(a => {
          const text = typeof a === 'string' ? a : (a.task || a.text || a.title || '')
          const assignee = a.owner || a.assignee ? ` — ${a.owner || a.assignee}` : ''
          const dueDate = a.dueDate ? ` · due ${a.dueDate}` : ''
          const done = a.completed ? '✅ ' : '⬜ '
          html += `<li>${done}${text}${assignee}${dueDate}</li>`
        })
        html += '</ul>'
      }
      const decisions = noteData.decisions || []
      if (decisions.length > 0) {
        html += '<h3>Decisions</h3><ul>'
        decisions.forEach(d => { html += `<li>${typeof d === 'string' ? d : (d.text || '')}</li>` })
        html += '</ul>'
      }
      return html || '<p>No meeting data</p>'
    }

    case 'journal': {
      let html = ''
      if (noteData.date) html += `<p><strong>Date:</strong> ${noteData.date}</p>`
      if (noteData.mood) html += `<p><strong>Mood:</strong> ${noteData.mood}/5</p>`
      if (noteData.energy) html += `<p><strong>Energy:</strong> ${noteData.energy}/5</p>`
      if (noteData.weather) html += `<p><strong>Weather:</strong> ${noteData.weather}</p>`
      const goals = noteData.goals || []
      if (goals.length > 0) {
        html += '<h3>Daily goals</h3><ul>'
        goals.forEach(goal => {
          html += `<li>${goal.completed ? '✅' : '⬜'} ${goal.text || goal}</li>`
        })
        html += '</ul>'
      }
      const gratitude = (noteData.gratitude || []).filter(g => g)
      if (gratitude.length > 0) {
        html += '<h3>Gratitude</h3><ul>'
        gratitude.forEach(g => { html += `<li>${g}</li>` })
        html += '</ul>'
      }
      const highlights = noteData.highlights || []
      if (highlights.length > 0) {
        html += '<h3>Highlights</h3><ul>'
        highlights.forEach(h => { html += `<li>${typeof h === 'string' ? h : (h.text || '')}</li>` })
        html += '</ul>'
      }
      if (noteData.challenges) html += `<h3>Challenges</h3><p>${noteData.challenges}</p>`
      if (noteData.lessons) html += `<h3>Lessons</h3><p>${noteData.lessons}</p>`
      if (noteData.freeWrite) html += `<h3>Free Write</h3><p>${noteData.freeWrite}</p>`
      if (noteData.tags?.length) html += `<p><strong>Tags:</strong> ${noteData.tags.map(tag => `#${tag}`).join(' ')}</p>`
      return html || '<p>No journal entry</p>'
    }

    case 'brainstorm': {
      let html = ''
      if (noteData.topic) html += `<p><strong>Topic:</strong> ${noteData.topic}</p>`
      if (noteData.question) html += `<p><strong>Question:</strong> ${noteData.question}</p>`
      const ideas = noteData.ideas || []
      if (ideas.length > 0) {
        html += `<h3>Ideas (${ideas.length})</h3>`
        ideas.forEach((idea, i) => {
          const title = typeof idea === 'string' ? idea : (idea.title || idea.text || `Idea ${i + 1}`)
          const category = typeof idea === 'object'
            ? noteData.categories?.find(item => item.id === idea.category)?.name
            : ''
          html += `<h4>${i + 1}. ${idea.starred ? '★ ' : ''}${title}</h4>`
          if (category) html += `<p><em>Category: ${category}</em></p>`
          if (idea.description) html += `<p>${idea.description}</p>`
          if (idea.notes) html += `<p>${idea.notes}</p>`
          if (typeof idea === 'object') html += `<p><em>Score: ${idea.votes || 0}</em></p>`
        })
      }
      return html || '<p>No ideas yet</p>'
    }

    case 'project': {
      let html = ''
      const columns = noteData.columns || []
      columns.forEach(col => {
        html += `<h3>${col.name} (${(col.tasks || []).length})</h3>`
        if (col.tasks && col.tasks.length > 0) {
          html += '<ul>'
          col.tasks.forEach(task => {
            const text = typeof task === 'string' ? task : (task.title || task.text || '')
            const assigneeName = noteData.team?.find(member => member.id === task.assignee)?.name
            const assignee = task.assignee ? ` [${assigneeName || task.assignee}]` : ''
            html += `<li>${text}${assignee}</li>`
          })
          html += '</ul>'
        } else {
          html += '<p><em>No tasks</em></p>'
        }
      })
      const milestones = noteData.milestones || []
      if (milestones.length > 0) {
        html += '<h3>Milestones</h3><ul>'
        milestones.forEach(m => {
          const text = typeof m === 'string' ? m : (m.name || m.title || m.text || '')
          const date = m.date || m.dueDate ? ` (${m.date || m.dueDate})` : ''
          const done = m.completed ? '✅ ' : '⬜ '
          html += `<li>${done}${text}${date}</li>`
        })
        html += '</ul>'
      }
      return html || '<p>No project data</p>'
    }

    case 'weekly': {
      let html = ''
      if (noteData.weekStart) html += `<p><strong>Week starting:</strong> ${noteData.weekStart}</p>`
      const goals = noteData.weeklyGoals || noteData.goals || []
      if (goals.length > 0) {
        html += '<h3>Weekly Goals</h3><ul>'
        goals.forEach(g => {
          const text = typeof g === 'string' ? g : (g.text || g.title || '')
          const done = g.completed ? '✅ ' : '⬜ '
          html += `<li>${done}${text}</li>`
        })
        html += '</ul>'
      }
      const days = noteData.days || {}
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      dayNames.forEach(dayName => {
        const day = days[dayName]
        if (!day) return
        const hasTasks = day.tasks && day.tasks.length > 0
        const hasEvents = day.events && day.events.length > 0
        if (!hasTasks && !hasEvents) return
        html += `<h3>${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</h3>`
        if (hasEvents) {
          html += '<p><strong>Events:</strong></p><ul>'
          day.events.forEach(e => {
            const text = typeof e === 'string' ? e : (e.title || e.text || '')
            const time = e.time ? `${e.time} - ` : ''
            html += `<li>${time}${text}</li>`
          })
          html += '</ul>'
        }
        if (hasTasks) {
          html += '<p><strong>Tasks:</strong></p><ul>'
          day.tasks.forEach(t => {
            const text = typeof t === 'string' ? t : (t.text || t.title || '')
            const done = t.completed ? '✅ ' : '⬜ '
            html += `<li>${done}${text}</li>`
          })
          html += '</ul>'
        }
        if (day.note) html += `<p><strong>Notes:</strong> ${day.note}</p>`
        if (day.rating) html += `<p><strong>Day rating:</strong> ${day.rating}/5</p>`
      })
      const review = noteData.review
      if (review) {
        if (review.accomplishments) html += `<h3>Accomplishments</h3><p>${review.accomplishments}</p>`
        if (review.challenges) html += `<h3>Challenges</h3><p>${review.challenges}</p>`
        if (review.lessons) html += `<h3>Lessons</h3><p>${review.lessons}</p>`
        if (review.nextWeekFocus) html += `<h3>Next week’s focus</h3><p>${review.nextWeekFocus}</p>`
        if (review.highlight) html += `<h3>Weekly Highlight</h3><p>${review.highlight}</p>`
        if (review.wins && review.wins.length > 0) {
          html += '<h3>Wins</h3><ul>'
          review.wins.forEach(w => { html += `<li>${typeof w === 'string' ? w : (w.text || '')}</li>` })
          html += '</ul>'
        }
        if (review.improvements && review.improvements.length > 0) {
          html += '<h3>Improvements</h3><ul>'
          review.improvements.forEach(imp => { html += `<li>${typeof imp === 'string' ? imp : (imp.text || '')}</li>` })
          html += '</ul>'
        }
      }
      return html || '<p>No weekly plan data</p>'
    }

    default:
      return '<p>No content</p>'
  }
}

export const getExportableContent = (noteItem) => {
  if (!noteItem) return ''
  const rawContent = hasSpecializedEditor(noteItem.noteType)
    ? noteDataToHtml(noteItem.noteType, noteItem.noteData, noteItem.title)
    : noteItem.content || ''
  return sanitizeNoteHtml(rawContent)
}

export const getLiveNotes = (notes) => notes.filter((note) => !note.deleted)

const safeMarkdownText = (value) => escapeHtml(String(value || ''))

export const buildMarkdownExport = (noteItem, exportContent) =>
  `# ${safeMarkdownText(noteItem.title)}\n\n${noteItem.tags?.length ? `Tags: ${noteItem.tags.map((tag) => `#${safeMarkdownText(tag)}`).join(' ')}\n\n---\n\n` : ''}${htmlToMarkdown(exportContent)}`

export const buildPlainTextExport = (noteItem, exportContent) =>
  `${noteItem.title}\n${'='.repeat(noteItem.title.length)}\n\n${noteItem.tags?.length ? `Tags: ${noteItem.tags.join(', ')}\n\n` : ''}${htmlToPlainText(exportContent)}`

export const buildHtmlExportDocument = (noteItem, exportContent) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline'">
  <title>${escapeHtml(noteItem.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
    h1 { border-bottom: 2px solid #10b981; padding-bottom: 12px; }
    .tags { margin-bottom: 20px; }
    .tag { background: #ecfdf5; color: #059669; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 4px; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    blockquote { border-left: 4px solid #10b981; margin: 16px 0; padding: 8px 16px; background: #f9fafb; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
  </style>
</head>
<body${noteItem.tags?.length ? ` data-tags="${escapeHtml(noteItem.tags.join(','))}"` : ''}>
  <h1>${escapeHtml(noteItem.title)}</h1>
  ${noteItem.tags?.length ? `<div class="tags">${noteItem.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join(' ')}</div>` : ''}
  <div class="content">${sanitizeNoteHtml(exportContent)}</div>
</body>
</html>`
const formatExportDate = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Unknown'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const buildPrintExportDocument = (noteItems) => {
  const notes = Array.isArray(noteItems) ? noteItems : [noteItems]
  const documentTitle = notes.length === 1 ? notes[0].title : 'QuickNotes export'
  const articles = notes.map((note) => `
  <article class="note">
    <h1>${escapeHtml(note.title)}</h1>
    <div class="meta">
      Created: ${escapeHtml(formatExportDate(note.createdAt))} ·
      Last modified: ${escapeHtml(formatExportDate(note.updatedAt))}
    </div>
    ${note.tags?.length ? `
    <div class="tags">
      ${note.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
    </div>` : ''}
    <div class="content">${sanitizeNoteHtml(note.content) || '<p>No content</p>'}</div>
  </article>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline'">
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    .note + .note {
      break-before: page;
      page-break-before: always;
    }
    
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
      border-bottom: 2px solid #10b981;
      padding-bottom: 12px;
    }
    
    .meta {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 24px;
    }
    
    .tags {
      margin-bottom: 24px;
    }
    
    .tag {
      display: inline-block;
      background: #ecfdf5;
      color: #047857;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
      margin-right: 6px;
    }
    
    .content {
      font-size: 14px;
    }
    
    .content h2 { font-size: 22px; margin-top: 24px; }
    .content h3 { font-size: 18px; margin-top: 20px; }
    .content h4 { font-size: 16px; margin-top: 16px; }
    
    .content p { margin-bottom: 12px; }
    
    .content ul, .content ol {
      margin-bottom: 12px;
      padding-left: 24px;
    }
    
    .content li { margin-bottom: 4px; }
    
    .content pre {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
    }
    
    .content code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .content blockquote {
      border-left: 4px solid #10b981;
      margin: 16px 0;
      padding: 8px 16px;
      background: #f9fafb;
      font-style: italic;
    }
    
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    
    .content th, .content td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      text-align: left;
    }
    
    .content th {
      background: #f3f4f6;
      font-weight: 600;
    }
    
    .content hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }
    
    .content a {
      color: #047857;
      text-decoration: underline;
    }
    
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  ${articles}
</body>
</html>
`
}

const generatePDF = async (notes) => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('The print window was blocked. Allow pop-ups and try again.')
  }

  printWindow.opener = null
  const htmlContent = buildPrintExportDocument(notes)
  printWindow.addEventListener('load', () => {
    setTimeout(() => printWindow.print(), 250)
  }, { once: true })
  
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}
const downloadFile = (content, filename, mimeType) => {
  // Add UTF-8 BOM to ensure proper encoding when opening in external apps
  const bom = '\uFEFF'
  const blob = new Blob([bom + content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const exportFormats = [
  {
    id: 'pdf',
    name: 'PDF',
    description: 'Portable Document Format - best for printing and sharing',
    icon: FileText,
    extension: '.pdf',
    color: '#ef4444',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Markdown format - compatible with most editors',
    icon: FileCode,
    extension: '.md',
    color: '#3b82f6',
  },
  {
    id: 'txt',
    name: 'Plain Text',
    description: 'Simple text format - universal compatibility',
    icon: File,
    extension: '.txt',
    color: '#6b7280',
  },
  {
    id: 'html',
    name: 'HTML',
    description: 'Web format - preserves all formatting',
    icon: FileCode,
    extension: '.html',
    color: '#f97316',
  },
]

export default function ExportModal() {
  const { exportModalOpen, setExportModalOpen } = useUIStore()
  const { getSelectedNote, notes } = useNotesStore()
  const [selectedFormat, setSelectedFormat] = useState('pdf')
  const [exportAll, setExportAll] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const { t } = useTranslation()

  const note = getSelectedNote()
  const liveNotes = getLiveNotes(notes)

  const localizedFormats = exportFormats.map(f => ({
    ...f,
    description: f.id === 'pdf' ? t('exportModal.pdfDesc') :
                 f.id === 'markdown' ? t('exportModal.markdownDesc') :
                 f.id === 'txt' ? t('exportModal.plainTextDesc') :
                 f.id === 'html' ? t('exportModal.htmlDesc') : f.description,
    name: f.id === 'txt' ? t('exportModal.plainText') : f.name,
  }))

  if (!exportModalOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const notesToExport = exportAll ? liveNotes : note && !note.deleted ? [note] : []
      if (notesToExport.length === 0) throw new Error('There are no notes available to export.')

      if (selectedFormat === 'pdf') {
        await generatePDF(
          notesToExport.map((noteItem) => ({
            ...noteItem,
            content: getExportableContent(noteItem),
          }))
        )
      }
      
      for (const noteItem of selectedFormat === 'pdf' ? [] : notesToExport) {
        const safeTitle = noteItem.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50) || 'QuickNotes_note'
        const exportContent = getExportableContent(noteItem)
        
        switch (selectedFormat) {
          case 'markdown': {
            const markdown = buildMarkdownExport(noteItem, exportContent)
            downloadFile(markdown, `${safeTitle}.md`, 'text/markdown')
            break
          }

          case 'txt': {
            const plainText = buildPlainTextExport(noteItem, exportContent)
            downloadFile(plainText, `${safeTitle}.txt`, 'text/plain')
            break
          }

          case 'html': {
            const html = buildHtmlExportDocument(noteItem, exportContent)
            downloadFile(html, `${safeTitle}.html`, 'text/html')
            break
          }
        }
        if (exportAll && notesToExport.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
      
      setExportSuccess(true)
      setTimeout(() => {
        setExportSuccess(false)
        if (!exportAll) {
          setExportModalOpen(false)
        }
      }, 1500)
    } catch (error) {
      toast.error(`Export failed: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <LegacyDialog label="Export notes" onClose={() => setExportModalOpen(false)} align="center">
      <div 
        className="w-full min-w-0 max-w-md overflow-hidden rounded-2xl border border-subtle bg-surface-raised shadow-2xl modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 text-white qn-banner-surface sm:p-5">
          <div className="flex items-center gap-3">
            <Download className="h-6 w-6" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold">{t('exportModal.title')}</h2>
              <p className="text-sm text-white">{t('exportModal.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('common.close', 'Close export')}
            onClick={() => setExportModalOpen(false)}
            className="qn-square-control rounded-full p-2 transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-w-0 p-4 sm:p-6">
        {note && (
          <div className="mb-4 p-3 bg-surface-sunken rounded-lg">
            <p className="text-sm font-medium text-content truncate">{note.title}</p>
            <p className="text-xs text-content">
              {(() => {
                const content = getExportableContent(note)
                return content ? htmlToPlainText(content).substring(0, 60) + '...' : t('exportModal.emptyNote')
              })()}
            </p>
          </div>
        )}
        <label className="flex items-center gap-3 mb-4 p-3 bg-surface-sunken rounded-lg cursor-pointer hover:bg-surface-hover transition-colors">
          <input
            type="checkbox"
            checked={exportAll}
            onChange={(e) => setExportAll(e.target.checked)}
            className="w-4 h-4 rounded border-subtle text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <p className="text-sm font-medium text-content">{t('exportModal.exportAll')}</p>
            <p className="text-xs text-content">{liveNotes.length} {t('exportModal.notesWillBeExported')}</p>
          </div>
        </label>
        <div className="mb-6 space-y-2" role="group" aria-label={t('exportModal.selectFormat')}>
          <p className="text-sm font-medium text-content-muted mb-2">{t('exportModal.selectFormat')}</p>
          {localizedFormats.map((format) => (
            <button
              key={format.id}
              type="button"
              aria-pressed={selectedFormat === format.id}
              onClick={() => setSelectedFormat(format.id)}
              className={`flex w-full min-w-0 items-center gap-3 rounded-lg border-2 p-3 transition-all ${
 selectedFormat === format.id
 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-subtle hover:border-subtle dark:hover:border-subtle'
              }`}
            >
              <div 
                className="shrink-0 rounded-lg p-2"
                style={{ backgroundColor: `${format.color}20` }}
              >
                <format.icon className="h-5 w-5" style={{ color: format.color }} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="font-medium text-content">{format.name}</p>
                <p className="text-xs text-content">{format.description}</p>
              </div>
              {selectedFormat === format.id && (
                <Check className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || (exportAll ? liveNotes.length === 0 : !note || note.deleted)}
          className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
 exportSuccess
              ? 'bg-accent text-accent-on'
              : isExporting
              ? 'bg-gray-400 text-white cursor-wait'
              : 'qn-banner-surface hover:from-emerald-700 hover:to-teal-700 text-white'
          }`}
        >
          {exportSuccess ? (
            <>
              <Check className="h-5 w-5" aria-hidden="true" />
              {t('exportModal.exported')}
            </>
          ) : isExporting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
              {t('exportModal.exporting')}
            </>
          ) : (
            <>
              <Download className="h-5 w-5" aria-hidden="true" />
              {exportAll ? t('exportModal.exportAllNotes') : t('exportModal.exportNote')}
            </>
          )}
        </button>
        </div>
      </div>
    </LegacyDialog>
  )
}
