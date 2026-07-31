import { useState, useRef } from 'react'
import {
  X,
  Upload,
  FileCode,
  File,
  Check,
  AlertCircle
} from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { sanitizeNoteHtml } from '../lib/sanitizeHtml'
import { MAX_NOTE_TITLE_LENGTH, MAX_TAG_NAME_LENGTH } from '../lib/dataValidation'
import LegacyDialog from './ui/LegacyDialog'

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024
const MAX_IMPORT_FILES = 100
const SUPPORTED_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'html', 'htm'])

const normalizeTags = (tags) => Array.from(
  new Set(
    tags
      .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
      .filter((tag) => tag && tag.length <= MAX_TAG_NAME_LENGTH)
  )
)

const markdownToHtml = (markdown) => {
  if (!markdown) return ''
  
  let html = markdown
  
  html = html.replace(/&/g, '&amp;')
  html = html.replace(/</g, '&lt;')
  html = html.replace(/>/g, '&gt;')
  
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`
  })
  
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>')
  
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  
  html = html.replace(/^---$/gm, '<hr />')
  html = html.replace(/^\*\*\*$/gm, '<hr />')
  
  html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">$1</li></ul>')
  html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false">$1</li></ul>')
  
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`
  })
  
  const lines = html.split('\n')
  html = lines.map(line => {
    line = line.trim()
    if (!line) return ''
    if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') || 
        line.startsWith('<li') || line.startsWith('<pre') || line.startsWith('<blockquote') ||
        line.startsWith('<hr') || line.startsWith('<img')) {
      return line
    }
    return `<p>${line}</p>`
  }).join('\n')
  
  html = html.replace(/<p><\/p>/g, '')
  
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br />')
  
  return html
}

const parseFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      // Strip UTF-8 BOM if present
      let content = e.target.result
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1)
      }
      const extension = file.name.split('.').pop().toLowerCase()
      
      let title = file.name.replace(/\.[^/.]+$/, '')
      let htmlContent = ''
      let tags = []
      
      switch (extension) {
        case 'md':
        case 'markdown': {
          const titleMatch = content.match(/^# (.+)$/m)
          if (titleMatch) {
            title = titleMatch[1]
          }
          
          const tagsMatch = content.match(/^Tags?:\s*(.+)$/m)
          if (tagsMatch) {
            tags = tagsMatch[1].match(/#(\w+)/g)?.map(t => t.slice(1)) || []
          }
          
          let cleanContent = content
            .replace(/^# .+\n*/m, '')
            .replace(/^Tags?:\s*.+\n*/m, '')
            .replace(/^---\n*/m, '')
            .trim()
          
          htmlContent = markdownToHtml(cleanContent)
          break
        }

        case 'txt': {
          const lines = content.split('\n')
          if (lines[0]) {
            title = lines[0].replace(/^[=\-#\s]+/, '').trim()
          }
          
          const txtTagsMatch = content.match(/^Tags?:\s*(.+)$/m)
          if (txtTagsMatch) {
            tags = txtTagsMatch[1].split(',').map(t => t.trim().replace('#', ''))
          }
          
          htmlContent = lines.slice(1)
            .join('\n')
            .replace(/^Tags?:\s*.+\n*/m, '')
            .split('\n\n')
            .filter(p => p.trim())
            .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
            .join('')
          break
        }

        case 'html':
        case 'htm': {
          const htmlTitleMatch = content.match(/<title>([^<]+)<\/title>/i) || 
                                 content.match(/<h1[^>]*>([^<]+)<\/h1>/i)
          if (htmlTitleMatch) {
            title = htmlTitleMatch[1]
          }
          
          const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i)
          if (bodyMatch) {
            htmlContent = bodyMatch[1]
          } else {
            htmlContent = content
              .replace(/<!DOCTYPE[^>]*>/gi, '')
              .replace(/<html[^>]*>/gi, '')
              .replace(/<\/html>/gi, '')
              .replace(/<head>[\s\S]*<\/head>/gi, '')
              .replace(/<body[^>]*>/gi, '')
              .replace(/<\/body>/gi, '')
          }
          
          const tagsAttrMatch = content.match(/data-tags="([^"]+)"/i)
          if (tagsAttrMatch) {
            tags = tagsAttrMatch[1].split(',').map(t => t.trim())
          }
          break
        }
          
        default:
          reject(new Error(`Unsupported file format: ${extension}`))
          return
      }
      
      resolve({
        title: (title.trim() || 'Untitled Note').substring(0, MAX_NOTE_TITLE_LENGTH),
        content: sanitizeNoteHtml(htmlContent),
        tags: normalizeTags(tags),
        originalFilename: file.name,
      })
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file, 'UTF-8')
  })
}

export default function ImportModal() {
  const { importModalOpen, setImportModalOpen } = useUIStore()
  const { createNote, selectedFolderId } = useNotesStore()
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState([])
  const [selectionErrors, setSelectionErrors] = useState([])
  const fileInputRef = useRef(null)
  const { t } = useTranslation()

  if (!importModalOpen) return null

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const addFiles = (incomingFiles) => {
    const accepted = []
    const rejected = []

    for (const file of incomingFiles) {
      const extension = file.name.split('.').pop().toLowerCase()
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        rejected.push({ filename: file.name, success: false, error: 'Unsupported file format' })
      } else if (file.size > MAX_IMPORT_FILE_SIZE) {
        rejected.push({ filename: file.name, success: false, error: 'File exceeds the 10 MB limit' })
      } else {
        accepted.push(file)
      }
    }

    setFiles((current) => {
      const available = Math.max(0, MAX_IMPORT_FILES - current.length)
      const next = accepted.slice(0, available)
      if (accepted.length > available) {
        rejected.push({
          filename: `${accepted.length - available} additional file(s)`,
          success: false,
          error: `A maximum of ${MAX_IMPORT_FILES} files can be imported at once`,
        })
      }
      return [...current, ...next]
    })
    if (rejected.length > 0) setSelectionErrors((current) => [...current, ...rejected])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleFileSelect = (e) => {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleImport = async () => {
    setImporting(true)
    const importResults = []
    
    for (const file of files) {
      try {
        const parsed = await parseFile(file)
        
        createNote({
          title: parsed.title,
          content: parsed.content,
          tags: parsed.tags,
          folderId: selectedFolderId,
        })
        
        importResults.push({
          filename: file.name,
          success: true,
          title: parsed.title,
        })
      } catch (error) {
        importResults.push({
          filename: file.name,
          success: false,
          error: error.message,
        })
      }
    }
    
    setResults((current) => [...current, ...importResults])
    setImporting(false)
    setFiles([])
  }

  const handleClose = () => {
    setImportModalOpen(false)
    setFiles([])
    setResults([])
    setSelectionErrors([])
  }

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    switch (ext) {
      case 'md':
      case 'markdown':
        return <FileCode className="w-5 h-5 text-blue-500" />
      case 'html':
      case 'htm':
        return <FileCode className="w-5 h-5 text-orange-500" />
      default:
        return <File className="w-5 h-5 text-content-muted" />
    }
  }

  return (
    <LegacyDialog label="Import notes" onClose={() => setImportModalOpen(false)} align="center">
      <div 
        className="bg-surface-raised rounded-2xl shadow-2xl border border-subtle max-w-lg w-full mx-4 modal-animate overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 qn-banner-surface text-white">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('importModal.title')}</h2>
              <p className="text-sm text-white/70">{t('importModal.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
        {results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-content-muted mb-4">{t('importModal.importComplete')}</p>
            {results.map((result, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg flex items-center gap-3 ${
 result.success 
 ? 'bg-green-50 dark:bg-green-900/20' 
                    : 'bg-red-50 dark:bg-red-900/20'
                }`}
              >
                {result.success ? (
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
 result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
 }`}>
                    {result.filename}
                  </p>
                  <p className="text-xs text-content-muted truncate">
                    {result.success ? `${t('importModal.importedAs')} "${result.title}"` : result.error}
                  </p>
                </div>
              </div>
            ))}
            <button
              onClick={handleClose}
              className="w-full mt-4 py-3 qn-banner-surface hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium transition-colors"
            >
              {t('importModal.done')}
            </button>
          </div>
        ) : (
          <>
            {selectionErrors.length > 0 && (
              <div className="mb-4 space-y-2" role="alert">
                {selectionErrors.map((result, index) => (
                  <div
                    key={`${result.filename}-${index}`}
                    className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong>{result.filename}:</strong> {result.error}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
 dragActive
 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-subtle  hover:border-emerald-400 hover:bg-surface-hover'
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-3 ${
 dragActive ? 'text-emerald-600' : 'text-content-subtle'
 }`} />
              <p className="text-content-muted font-medium mb-1">
                {t('importModal.dropFiles')}
              </p>
              <p className="text-sm text-content-muted">
                {t('importModal.supports')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.markdown,.txt,.html,.htm"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-content-muted">
                  {files.length} {files.length > 1 ? t('importModal.files') : t('importModal.file')} {t('importModal.filesSelected')}
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {files.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-2 bg-surface-sunken rounded-lg"
                    >
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-content truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-content-muted">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-surface-sunken dark:hover:bg-surface-sunken rounded"
                      >
                        <X className="w-4 h-4 text-content-muted" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={files.length === 0 || importing}
              className={`w-full mt-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
 files.length === 0 || importing
 ? 'bg-surface-active dark:bg-surface-active text-content-muted cursor-not-allowed'
                  : 'qn-banner-surface hover:from-emerald-700 hover:to-teal-700 text-white'
              }`}
            >
              {importing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('importModal.importing')}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  {t('importModal.importFiles')} {files.length > 0 ? `${files.length} ${files.length > 1 ? t('importModal.files') : t('importModal.file')}` : ''}
                </>
              )}
            </button>
          </>
        )}
        </div>
      </div>
    </LegacyDialog>
  )
}
