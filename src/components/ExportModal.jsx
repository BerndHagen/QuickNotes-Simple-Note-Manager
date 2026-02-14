import React, { useState } from 'react'
import { X, FileText, FileCode, File, Download, Check } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { hasSpecializedEditor } from './editors'

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
        const priority = task.priority === 'high' ? '🔴 High' : task.priority === 'medium' ? '🟡 Medium' : '🟢 Low'
        const due = task.dueDate || '-'
        html += `<tr><td style="border:1px solid #e5e7eb;padding:8px">${status}</td>`
        html += `<td style="border:1px solid #e5e7eb;padding:8px">${task.text || task.title || ''}</td>`
        html += `<td style="border:1px solid #e5e7eb;padding:8px">${priority}</td>`
        html += `<td style="border:1px solid #e5e7eb;padding:8px">${due}</td></tr>`
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
        html += `<h3>${cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>`
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
        })
        html += '</tbody></table>'
      })
      const total = items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0)
      if (total > 0) html += `<p><strong>Total: ${currency} ${total.toFixed(2)}</strong></p>`
      return html
    }

    case 'meeting': {
      let html = ''
      if (noteData.date) html += `<p><strong>Date:</strong> ${noteData.date}${noteData.time ? ` at ${noteData.time}` : ''}</p>`
      if (noteData.location) html += `<p><strong>Location:</strong> ${noteData.location}</p>`
      const attendees = noteData.attendees || []
      if (attendees.length > 0) {
        html += `<h3>Attendees (${attendees.length})</h3><ul>`
        attendees.forEach(a => { html += `<li>${typeof a === 'string' ? a : (a.name || a.email || '')}</li>` })
        html += '</ul>'
      }
      const agenda = noteData.agenda || []
      if (agenda.length > 0) {
        html += '<h3>Agenda</h3><ol>'
        agenda.forEach(item => { html += `<li>${typeof item === 'string' ? item : (item.text || item.title || '')}</li>` })
        html += '</ol>'
      }
      if (noteData.notes) html += `<h3>Notes</h3><div>${noteData.notes}</div>`
      const actions = noteData.actionItems || []
      if (actions.length > 0) {
        html += '<h3>Action Items</h3><ul>'
        actions.forEach(a => {
          const text = typeof a === 'string' ? a : (a.text || a.title || '')
          const assignee = a.assignee ? ` (${a.assignee})` : ''
          const done = a.completed ? '✅ ' : '⬜ '
          html += `<li>${done}${text}${assignee}</li>`
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
          html += `<h4>${i + 1}. ${title}</h4>`
          if (idea.description) html += `<p>${idea.description}</p>`
          if (idea.votes) html += `<p><em>Votes: ${idea.votes}</em></p>`
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
            const assignee = task.assignee ? ` [${task.assignee}]` : ''
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
          const text = typeof m === 'string' ? m : (m.title || m.text || '')
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
      const goals = noteData.goals || []
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
      })
      const review = noteData.review
      if (review) {
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

const getExportableContent = (noteItem) => {
  if (!noteItem) return ''
  if (hasSpecializedEditor(noteItem.noteType)) {
    return noteDataToHtml(noteItem.noteType, noteItem.noteData, noteItem.title)
  }
  return noteItem.content || ''
}
const htmlToMarkdown = (html) => {
  if (!html) return ''
  
  let markdown = html
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
  markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_')
  markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
  markdown = markdown.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n```\n$1\n```\n')
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
  markdown = markdown.replace(/<ul[^>]*>/gi, '\n')
  markdown = markdown.replace(/<\/ul>/gi, '\n')
  markdown = markdown.replace(/<ol[^>]*>/gi, '\n')
  markdown = markdown.replace(/<\/ol>/gi, '\n')
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  markdown = markdown.replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gi, '- [x] $1\n')
  markdown = markdown.replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gi, '- [ ] $1\n')
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n\n')
  markdown = markdown.replace(/<hr[^>]*\/?>/gi, '\n---\n\n')
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
  markdown = markdown.replace(/<br[^>]*\/?>/gi, '\n')
  markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
  markdown = markdown.replace(/<[^>]+>/g, '')
  markdown = markdown.replace(/&nbsp;/g, ' ')
  markdown = markdown.replace(/&amp;/g, '&')
  markdown = markdown.replace(/&lt;/g, '<')
  markdown = markdown.replace(/&gt;/g, '>')
  markdown = markdown.replace(/&quot;/g, '"')
  markdown = markdown.replace(/&#39;/g, "'")
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  
  return markdown.trim()
}
const htmlToPlainText = (html) => {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}
const generatePDF = async (note) => {
  const printWindow = window.open('', '_blank')
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${note.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
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
      color: #059669;
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
      color: #059669;
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
  <h1>${note.title}</h1>
  <div class="meta">
    Created: ${new Date(note.createdAt).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    })} | 
    Last modified: ${new Date(note.updatedAt).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    })}
  </div>
  ${note.tags && note.tags.length > 0 ? `
  <div class="tags">
    ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
  </div>
  ` : ''}
  <div class="content">
    ${note.content || '<p>No content</p>'}
  </div>
</body>
</html>
`
  
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
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
      const notesToExport = exportAll ? notes : [note]
      
      for (const noteItem of notesToExport) {
        if (!noteItem) continue
        
        const safeTitle = noteItem.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)
        const exportContent = getExportableContent(noteItem)
        
        switch (selectedFormat) {
          case 'pdf':
            await generatePDF({ ...noteItem, content: exportContent })
            break
            
          case 'markdown':
            const markdown = `# ${noteItem.title}\n\n${noteItem.tags?.length ? `Tags: ${noteItem.tags.map(t => `#${t}`).join(' ')}\n\n---\n\n` : ''}${htmlToMarkdown(exportContent)}`
            downloadFile(markdown, `${safeTitle}.md`, 'text/markdown')
            break
            
          case 'txt':
            const plainText = `${noteItem.title}\n${'='.repeat(noteItem.title.length)}\n\n${noteItem.tags?.length ? `Tags: ${noteItem.tags.join(', ')}\n\n` : ''}${htmlToPlainText(exportContent)}`
            downloadFile(plainText, `${safeTitle}.txt`, 'text/plain')
            break
            
          case 'html':
            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${noteItem.title}</title>
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
<body>
  <h1>${noteItem.title}</h1>
  ${noteItem.tags?.length ? `<div class="tags">${noteItem.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</div>` : ''}
  <div class="content">${exportContent}</div>
</body>
</html>`
            downloadFile(html, `${safeTitle}.html`, 'text/html')
            break
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
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center modal-backdrop-animate" onClick={() => setExportModalOpen(false)}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 max-w-md w-full mx-4 modal-animate overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('exportModal.title')}</h2>
              <p className="text-sm text-white/70">{t('exportModal.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setExportModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
        {note && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{note.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(() => {
                const content = getExportableContent(note)
                return content ? htmlToPlainText(content).substring(0, 60) + '...' : t('exportModal.emptyNote')
              })()}
            </p>
          </div>
        )}
        <label className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <input
            type="checkbox"
            checked={exportAll}
            onChange={(e) => setExportAll(e.target.checked)}
            className="w-4 h-4 rounded border-[#cbd1db] text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('exportModal.exportAll')}</p>
            <p className="text-xs text-gray-500">{notes.filter(n => !n.deleted).length} {t('exportModal.notesWillBeExported')}</p>
          </div>
        </label>
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('exportModal.selectFormat')}</p>
          {localizedFormats.map((format) => (
            <button
              key={format.id}
              onClick={() => setSelectedFormat(format.id)}
              className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                selectedFormat === format.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-[#cbd1db] dark:border-gray-700 hover:border-[#cbd1db] dark:hover:border-gray-600'
              }`}
            >
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${format.color}20` }}
              >
                <format.icon className="w-5 h-5" style={{ color: format.color }} />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{format.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{format.description}</p>
              </div>
              {selectedFormat === format.id && (
                <Check className="w-5 h-5 text-emerald-600" />
              )}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting || (!note && !exportAll)}
          className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            exportSuccess
              ? 'bg-green-600 text-white'
              : isExporting
              ? 'bg-gray-400 text-white cursor-wait'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
          }`}
        >
          {exportSuccess ? (
            <>
              <Check className="w-5 h-5" />
              {t('exportModal.exported')}
            </>
          ) : isExporting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('exportModal.exporting')}
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              {exportAll ? t('exportModal.exportAllNotes') : t('exportModal.exportNote')}
            </>
          )}
        </button>
        </div>
      </div>
    </div>
  )
}
