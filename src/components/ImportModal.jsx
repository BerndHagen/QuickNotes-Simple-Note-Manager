import React, { useState, useRef } from 'react'
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
  
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
  
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
        case 'markdown':
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
          
        case 'txt':
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
          
        case 'html':
        case 'htm':
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
              .replace(/<\!DOCTYPE[^>]*>/gi, '')
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
          
        default:
          reject(new Error(`Unsupported file format: ${extension}`))
          return
      }
      
      resolve({
        title: title.substring(0, 100),
        content: htmlContent,
        tags,
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

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      return ['md', 'markdown', 'txt', 'html', 'htm'].includes(ext)
    })
    
    setFiles(prev => [...prev, ...droppedFiles])
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selectedFiles])
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
    
    setResults(importResults)
    setImporting(false)
    setFiles([])
  }

  const handleClose = () => {
    setImportModalOpen(false)
    setFiles([])
    setResults([])
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
        return <File className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center modal-backdrop-animate" onClick={handleClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 max-w-lg w-full mx-4 modal-animate overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('importModal.importComplete')}</p>
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
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {result.success ? `${t('importModal.importedAs')} "${result.title}"` : result.error}
                  </p>
                </div>
              </div>
            ))}
            <button
              onClick={handleClose}
              className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium transition-colors"
            >
              {t('importModal.done')}
            </button>
          </div>
        ) : (
          <>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-[#cbd1db] dark:border-gray-600 hover:border-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-3 ${
                dragActive ? 'text-emerald-600' : 'text-gray-400'
              }`} />
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                {t('importModal.dropFiles')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {files.length} {files.length > 1 ? t('importModal.files') : t('importModal.file')} {t('importModal.filesSelected')}
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {files.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
                    >
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <X className="w-4 h-4 text-gray-500" />
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
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
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
    </div>
  )
}
