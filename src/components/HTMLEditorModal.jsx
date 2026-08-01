import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Code, Copy, Download, Eye, EyeOff, Upload } from 'lucide-react'
import { useUIStore } from '../store'
import { sanitizeNoteHtml } from '../lib/sanitizeHtml'
import { Button, Modal, Textarea } from './ui'
import { ConfirmDialog } from './FolderDialogs'

export const MAX_HTML_IMPORT_BYTES = 2 * 1024 * 1024

export function readHtmlFile(file) {
  if (!file) return Promise.reject(new Error('Choose an HTML file to import.'))

  const supportedExtension = /\.(?:html?|xhtml)$/i.test(file.name)
  const supportedType = ['', 'text/html', 'application/xhtml+xml'].includes(file.type)
  if (!supportedExtension || !supportedType) {
    return Promise.reject(new Error('Choose an .html or .htm file.'))
  }
  if (file.size > MAX_HTML_IMPORT_BYTES) {
    return Promise.reject(new Error('HTML files must be 2 MB or smaller.'))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The HTML file could not be read as text.'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(reader.error || new Error('The HTML file could not be read.'))
    reader.onabort = () => reject(new Error('Import was cancelled.'))
    reader.readAsText(file)
  })
}

export default function HTMLEditorModal({ editor }) {
  const { htmlEditorOpen, setHTMLEditorOpen } = useUIStore()
  const [htmlContent, setHtmlContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const copyTimerRef = useRef(null)

  useEffect(() => {
    if (!htmlEditorOpen || !editor) return
    setHtmlContent(editor.getHTML() || '')
    setHasUnsavedChanges(false)
    setShowPreview(false)
    setCopied(false)
    setOperationError('')
    setIsImporting(false)
  }, [htmlEditorOpen, editor])

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    },
    []
  )

  const handleApply = () => {
    if (!editor) {
      setOperationError('The editor is not available. Reopen the note and try again.')
      return
    }
    editor.commands.setContent(sanitizeNoteHtml(htmlContent))
    setHasUnsavedChanges(false)
    setHTMLEditorOpen(false)
  }

  const handleCopy = async () => {
    setOperationError('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(htmlContent)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setOperationError('Clipboard access was blocked. Select the HTML source and copy it manually.')
      textareaRef.current?.focus()
    }
  }

  const handleExport = () => {
    setOperationError('')
    let objectUrl = ''
    try {
      const safeHtml = sanitizeNoteHtml(htmlContent)
      const blob = new Blob([safeHtml], { type: 'text/html;charset=utf-8' })
      objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = 'note-content.html'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setOperationError('QuickNotes could not create the HTML download. Try again.')
    }
  }

  const handleImport = async (file) => {
    if (!file || isImporting) return
    setOperationError('')
    setIsImporting(true)
    try {
      const imported = await readHtmlFile(file)
      setHtmlContent(sanitizeNoteHtml(imported))
      setHasUnsavedChanges(true)
    } catch (error) {
      setOperationError(error.message || 'The HTML file could not be imported.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setDiscardConfirmOpen(true)
      return
    }
    setHTMLEditorOpen(false)
  }

  const footer = (
    <>
      <span className="mr-auto self-center text-ui-sm text-content-subtle" aria-live="polite">
        {htmlContent.length.toLocaleString()} characters
      </span>
      <Button variant="ghost" onClick={handleClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleApply} disabled={!hasUnsavedChanges}>
        Apply changes
      </Button>
    </>
  )

  return (
    <>
      <Modal
        open={htmlEditorOpen}
        onClose={handleClose}
        title="HTML editor"
        description="Review or edit the note's underlying HTML."
        icon={Code}
        size="3xl"
        initialFocusRef={textareaRef}
        footer={footer}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-card border border-warning-border bg-warning-soft p-3 text-ui-md text-warning-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Unsupported or unsafe markup is removed when you import, preview, export, or apply
              changes. Invalid structure can still change the note&apos;s formatting.
            </p>
          </div>

          {operationError && (
            <p
              role="alert"
              className="rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-ui-md text-danger-text"
            >
              {operationError}
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.xhtml,text/html,application/xhtml+xml"
            aria-label="Import HTML file"
            className="sr-only"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />

          <section className="overflow-hidden rounded-card border border-subtle bg-surface-raised">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-subtle bg-surface-sunken px-3 py-2">
              <h3 className="mr-auto text-ui-sm font-medium text-content-muted">HTML source</h3>
              <Button
                size="sm"
                variant={showPreview ? 'subtle' : 'ghost'}
                icon={showPreview ? EyeOff : Eye}
                aria-pressed={showPreview}
                onClick={() => setShowPreview((visible) => !visible)}
              >
                {showPreview ? 'Hide preview' : 'Show preview'}
              </Button>
              <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={Upload}
                loading={isImporting}
                onClick={() => fileInputRef.current?.click()}
              >
                Import
              </Button>
              <Button size="sm" variant="ghost" icon={Download} onClick={handleExport}>
                Export
              </Button>
            </div>

            <div className={showPreview ? 'grid min-w-0 md:grid-cols-2' : 'grid min-w-0'}>
              <div className="min-w-0">
                <Textarea
                  ref={textareaRef}
                  aria-label="HTML source"
                  value={htmlContent}
                  onChange={(event) => {
                    setHtmlContent(event.target.value)
                    setHasUnsavedChanges(true)
                    setOperationError('')
                  }}
                  className="h-[42dvh] min-h-64 rounded-none border-0 font-mono text-ui-sm focus:ring-2 md:h-[50dvh]"
                  spellCheck={false}
                  placeholder="Enter supported note HTML"
                />
              </div>

              {showPreview && (
                <div className="min-w-0 border-t border-subtle md:border-l md:border-t-0">
                  <div className="flex h-control-sm items-center gap-1.5 border-b border-subtle bg-surface-sunken px-3 text-ui-sm font-medium text-content-muted">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Sanitized preview
                  </div>
                  <div
                    aria-label="HTML preview"
                    className="prose prose-sm h-[42dvh] min-h-64 max-w-none overflow-auto p-4 dark:prose-invert md:h-[calc(50dvh-32px)]"
                    dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(htmlContent) }}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        onConfirm={() => {
          setDiscardConfirmOpen(false)
          setHasUnsavedChanges(false)
          setHTMLEditorOpen(false)
        }}
        title="Discard HTML changes?"
        description="Your edits to the HTML source have not been applied."
        confirmLabel="Discard changes"
        icon={AlertTriangle}
      />
    </>
  )
}
