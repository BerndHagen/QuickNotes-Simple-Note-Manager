import React, { useState } from 'react'
import { X, FileText, FileCode, File, Download, Check } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
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

  const note = getSelectedNote()

  if (!exportModalOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const notesToExport = exportAll ? notes : [note]
      
      for (const noteItem of notesToExport) {
        if (!noteItem) continue
        
        const safeTitle = noteItem.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)
        
        switch (selectedFormat) {
          case 'pdf':
            await generatePDF(noteItem)
            break
            
          case 'markdown':
            const markdown = `# ${noteItem.title}\n\n${noteItem.tags?.length ? `Tags: ${noteItem.tags.map(t => `#${t}`).join(' ')}\n\n---\n\n` : ''}${htmlToMarkdown(noteItem.content)}`
            downloadFile(markdown, `${safeTitle}.md`, 'text/markdown')
            break
            
          case 'txt':
            const plainText = `${noteItem.title}\n${'='.repeat(noteItem.title.length)}\n\n${noteItem.tags?.length ? `Tags: ${noteItem.tags.join(', ')}\n\n` : ''}${htmlToPlainText(noteItem.content)}`
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
  </style>
</head>
<body>
  <h1>${noteItem.title}</h1>
  ${noteItem.tags?.length ? `<div class="tags">${noteItem.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</div>` : ''}
  <div class="content">${noteItem.content || ''}</div>
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
              <h2 className="text-lg font-bold">Export Note</h2>
              <p className="text-sm text-white/70">Save your notes to a file</p>
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
              {note.content ? htmlToPlainText(note.content).substring(0, 60) + '...' : 'Empty note'}
            </p>
          </div>
        )}
        <label className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <input
            type="checkbox"
            checked={exportAll}
            onChange={(e) => setExportAll(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Export all notes</p>
            <p className="text-xs text-gray-500">{notes.filter(n => !n.deleted).length} notes will be exported</p>
          </div>
        </label>
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select format:</p>
          {exportFormats.map((format) => (
            <button
              key={format.id}
              onClick={() => setSelectedFormat(format.id)}
              className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                selectedFormat === format.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
              Exported!
            </>
          ) : isExporting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Export {exportAll ? 'All Notes' : 'Note'}
            </>
          )}
        </button>
        </div>
      </div>
    </div>
  )
}
