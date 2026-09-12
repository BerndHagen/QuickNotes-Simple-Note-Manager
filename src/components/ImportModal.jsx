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
import { escapeHtml, sanitizeNoteHtml } from '../lib/sanitizeHtml'
import { MAX_NOTE_TITLE_LENGTH, MAX_TAG_NAME_LENGTH } from '../lib/dataValidation'
import { markdownToHtml } from '../lib/noteTransfer'
import {
  parseWorkspaceArchive,
  parseWorkspaceBackup,
  WORKSPACE_ARCHIVE_EXTENSION,
} from '../lib/workspaceBackup'
import LegacyDialog from './ui/LegacyDialog'
import DialogHeader from './ui/DialogHeader'
import Button from './ui/Button'

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024
const MAX_TOTAL_IMPORT_SIZE = 25 * 1024 * 1024
const MAX_ARCHIVE_FILE_SIZE = 1100 * 1024 * 1024
const MAX_IMPORT_FILES = 100
const SUPPORTED_EXTENSIONS = new Set([WORKSPACE_ARCHIVE_EXTENSION, 'json', 'md', 'markdown', 'txt', 'html', 'htm'])

const describeWorkspaceImport = (counts) => {
  const quantity = (count, singular, plural = `${singular}s`) => (
    `${count} ${count === 1 ? singular : plural}`
  )
  const parts = [
    quantity(counts.notes, 'note'),
    quantity(counts.folders, 'folder'),
    quantity(counts.tags, 'tag'),
  ]
  if (counts.savedViews > 0) parts.push(quantity(counts.savedViews, 'smart view'))
  if (counts.noteTemplates > 0) parts.push(quantity(counts.noteTemplates, 'template'))
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

const decodeTextEntities = (value) => String(value || '').replace(
  /&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|#39));/gi,
  (match, decimal, hex, name) => {
    if (decimal) return String.fromCodePoint(Number(decimal))
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16))
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }[name.toLowerCase()] || match
  }
)

export const normalizeTags = (tags) => Array.from(
  new Set(
    tags
      .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
      .filter((tag) => tag && tag.length <= MAX_TAG_NAME_LENGTH)
  )
)

export const parseFile = async (file) => {
  const fileExtension = file.name.split('.').pop().toLowerCase()
  if (fileExtension === WORKSPACE_ARCHIVE_EXTENSION) {
    return {
      kind: 'workspace',
      backup: await parseWorkspaceArchive(file),
      originalFilename: file.name,
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        let content = String(e.target.result || '')
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
        const extension = file.name.split('.').pop().toLowerCase()

        let title = file.name.replace(/\.[^/.]+$/, '')
        let htmlContent = ''
        let tags = []

        switch (extension) {
          case 'json':
            resolve({
              kind: 'workspace',
              backup: parseWorkspaceBackup(content),
              originalFilename: file.name,
            })
            return

          case 'md':
          case 'markdown': {
            const titleMatch = content.match(/^# (.+)$/m)
            if (titleMatch) {
              title = decodeTextEntities(titleMatch[1])
            }

            const tagsMatch = content.match(/^Tags?:\s*(.+)$/m)
            if (tagsMatch) {
              tags = tagsMatch[1]
                .split(/\s+/)
                .filter((tag) => tag.startsWith('#'))
                .map((tag) => tag.slice(1))
            }

            const cleanContent = content
              .replace(/^# .+\n*/m, '')
              .replace(/^Tags?:\s*.+\n*/m, '')
              .replace(/^---\n*/m, '')
              .trim()

            htmlContent = markdownToHtml(cleanContent)
            break
          }

          case 'txt': {
            const lines = content.split('\n')
            if (lines[0]) title = lines[0].replace(/^[=\-#\s]+/, '').trim()

            const txtTagsMatch = content.match(/^Tags?:\s*(.+)$/m)
            if (txtTagsMatch) {
              tags = txtTagsMatch[1].split(',').map((tag) => tag.trim().replace(/^#+/, ''))
            }

            htmlContent = lines.slice(1)
              .join('\n')
              .replace(/^Tags?:\s*.+\n*/m, '')
              .split('\n\n')
              .filter((paragraph) => paragraph.trim())
              .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
              .join('')
            break
          }

          case 'html':
          case 'htm': {
            const documentNode = new DOMParser().parseFromString(content, 'text/html')
            title = documentNode.title || documentNode.querySelector('h1')?.textContent || title
            const exportedContent = documentNode.querySelector('body > .content')
            htmlContent = exportedContent?.innerHTML || documentNode.body.innerHTML
            const serializedTags = documentNode.body.dataset.tags
            if (serializedTags) tags = serializedTags.split(',')
            break
          }

          default:
            reject(new Error(`Unsupported file format: ${extension}`))
            return
        }

        resolve({
          title: (String(title).trim() || 'Untitled Note').substring(0, MAX_NOTE_TITLE_LENGTH),
          content: sanitizeNoteHtml(htmlContent),
          tags: normalizeTags(tags),
          originalFilename: file.name,
        })
      } catch (error) {
        reject(new Error(`Could not parse ${file.name}: ${error?.message || 'invalid file'}`))
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file, 'UTF-8')
  })
}

export default function ImportModal() {
  const { importModalOpen, setImportModalOpen } = useUIStore()
  const { createNote, importWorkspaceBackup, selectedFolderId } = useNotesStore()
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
    const available = Math.max(0, MAX_IMPORT_FILES - files.length)
    let totalSize = files.reduce((sum, file) => sum + file.size, 0)

    for (const file of incomingFiles) {
      const extension = file.name.split('.').pop().toLowerCase()
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        rejected.push({ filename: file.name, success: false, error: 'Unsupported file format' })
      } else if (extension === WORKSPACE_ARCHIVE_EXTENSION && file.size > MAX_ARCHIVE_FILE_SIZE) {
        rejected.push({ filename: file.name, success: false, error: 'QuickNotes archive exceeds the 1.1 GB limit' })
      } else if (
        extension === WORKSPACE_ARCHIVE_EXTENSION &&
        (files.length > 0 || accepted.length > 0)
      ) {
        rejected.push({ filename: file.name, success: false, error: 'Import one QuickNotes archive at a time' })
      } else if (
        extension !== WORKSPACE_ARCHIVE_EXTENSION &&
        [...files, ...accepted].some((candidate) => candidate.name.toLowerCase().endsWith(`.${WORKSPACE_ARCHIVE_EXTENSION}`))
      ) {
        rejected.push({ filename: file.name, success: false, error: 'Import other files separately from a QuickNotes archive' })
      } else if (extension !== WORKSPACE_ARCHIVE_EXTENSION && file.size > MAX_IMPORT_FILE_SIZE) {
        rejected.push({ filename: file.name, success: false, error: 'File exceeds the 10 MB limit' })
      } else if (accepted.length >= available) {
        rejected.push({
          filename: file.name,
          success: false,
          error: `A maximum of ${MAX_IMPORT_FILES} files can be imported at once`,
        })
      } else if (extension !== WORKSPACE_ARCHIVE_EXTENSION && totalSize + file.size > MAX_TOTAL_IMPORT_SIZE) {
        rejected.push({
          filename: file.name,
          success: false,
          error: 'The selected files exceed the 25 MB combined limit',
        })
      } else {
        accepted.push(file)
        if (extension !== WORKSPACE_ARCHIVE_EXTENSION) totalSize += file.size
      }
    }

    setFiles((current) => [...current, ...accepted])
    if (rejected.length > 0) setSelectionErrors((current) => [...current, ...rejected])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    addFiles(Array.from(e.dataTransfer.files))
  }

  const openFilePicker = () => fileInputRef.current?.click()

  const handleDropzoneKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFilePicker()
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
    const importResults = [...selectionErrors]
    setSelectionErrors([])
    
    for (const file of files) {
      try {
        const parsed = await parseFile(file)
        
        let description
        if (parsed.kind === 'workspace') {
          const counts = await importWorkspaceBackup(parsed.backup)
          description = describeWorkspaceImport(counts)
        } else {
          createNote({
            title: parsed.title,
            content: parsed.content,
            tags: parsed.tags,
            folderId: selectedFolderId,
          })
          description = `Imported as “${parsed.title}”`
        }

        importResults.push({
          filename: file.name,
          success: true,
          description,
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
      case 'json':
        return <FileCode className="h-5 w-5 text-accent-text" />
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
    <LegacyDialog label="Import notes" onClose={handleClose} align="center">
      <div 
        className="flex max-h-full w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-dialog border border-subtle bg-surface-raised shadow-dialog modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          title={t('importModal.title')}
          description={t('importModal.subtitle')}
          icon={Upload}
          onClose={handleClose}
          closeLabel={t('common.close', 'Close import')}
        />
        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
        {results.length > 0 ? (
          <div className="space-y-3">
            <p className="mb-4 text-sm text-content" role="status">{t('importModal.importComplete')}</p>
            {results.map((result, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg flex items-center gap-3 ${
 result.success 
                        ? 'bg-success-soft'
                    : 'bg-danger-soft'
                }`}
              >
                {result.success ? (
                  <Check className="h-5 w-5 flex-shrink-0 text-success-text" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-danger-text" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
 result.success ? 'text-success-text' : 'text-danger-text'
 }`}>
                    {result.filename}
                  </p>
                  <p className="truncate text-xs text-content">
                    {result.success ? result.description : result.error}
                  </p>
                </div>
              </div>
            ))}
            <Button
              variant="primary"
              fullWidth
              onClick={handleClose}
              className="mt-4"
            >
              {t('importModal.done')}
            </Button>
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
              role="button"
              tabIndex={0}
              aria-label={t('importModal.chooseFiles', 'Choose note files to import')}
              aria-describedby="qn-import-file-support"
              aria-controls="qn-import-file-input"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={openFilePicker}
              onKeyDown={handleDropzoneKeyDown}
              className={`cursor-pointer rounded-card border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
 dragActive
 ? 'border-accent bg-accent-soft'
                  : 'border-subtle hover:border-accent hover:bg-surface-hover'
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-3 ${
 dragActive ? 'text-accent-text' : 'text-content-subtle'
 }`} aria-hidden="true" />
              <p className="mb-1 font-medium text-content">
                {t('importModal.dropFiles')}
              </p>
              <p id="qn-import-file-support" className="text-sm text-content-muted">
                {t('importModal.supports')} · QuickNotes archives and legacy JSON backups
              </p>
            </div>
            <input
              id="qn-import-file-input"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".qnotes,.json,.md,.markdown,.txt,.html,.htm"
              onChange={handleFileSelect}
              className="hidden"
              tabIndex={-1}
            />
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-content-muted">
                  {files.length} {files.length > 1 ? t('importModal.files') : t('importModal.file')} {t('importModal.filesSelected')}
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto" tabIndex={0} aria-label={t('importModal.selectedFiles', 'Selected files')}>
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
                        <p className="text-xs text-content">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`${t('common.remove', 'Remove')} ${file.name}`}
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-surface-sunken dark:hover:bg-surface-sunken rounded"
                      >
                        <X className="h-4 w-4 text-content-muted" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={handleImport}
              disabled={files.length === 0 || importing}
              loading={importing}
              variant="primary"
              size="lg"
              fullWidth
              icon={Upload}
              className="mt-6"
            >
              {importing
                ? t('importModal.importing')
                : `${t('importModal.importFiles')} ${files.length > 0 ? `${files.length} ${files.length > 1 ? t('importModal.files') : t('importModal.file')}` : ''}`}
            </Button>
          </>
        )}
        </div>
      </div>
    </LegacyDialog>
  )
}
