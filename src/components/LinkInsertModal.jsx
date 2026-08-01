import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Link as LinkIcon, Unlink } from 'lucide-react'
import { useUIStore } from '../store'
import { normalizeWebUrl } from '../lib/webUrls'
import { Button, Field, Input, Modal } from './ui'

export function createLinkedTextContent(text, href) {
  return {
    type: 'text',
    text: text.trim() || href,
    marks: [{ type: 'link', attrs: { href } }],
  }
}

export default function LinkInsertModal({ editor }) {
  const { linkModalOpen, setLinkModalOpen } = useUIStore()
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [initialText, setInitialText] = useState('')
  const [selectionWasEmpty, setSelectionWasEmpty] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [urlError, setUrlError] = useState('')
  const urlInputRef = useRef(null)

  useEffect(() => {
    if (!linkModalOpen || !editor) return

    const { from, to, empty } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '')
    const linkHref = editor.getAttributes('link').href || ''

    setUrl(linkHref)
    setText(selectedText)
    setInitialText(selectedText)
    setSelectionWasEmpty(empty)
    setIsEditing(Boolean(linkHref))
    setUrlError('')
  }, [linkModalOpen, editor])

  const normalizedPreview = useMemo(() => normalizeWebUrl(url), [url])

  const handleClose = () => {
    setLinkModalOpen(false)
    setUrl('')
    setText('')
    setInitialText('')
    setSelectionWasEmpty(true)
    setIsEditing(false)
    setUrlError('')
  }

  const handleInsert = (event) => {
    event?.preventDefault()
    const normalized = normalizeWebUrl(url)
    if (!normalized.value) {
      setUrlError(normalized.error)
      urlInputRef.current?.focus()
      return
    }
    if (!editor) return

    const chain = editor.chain().focus()
    if (!selectionWasEmpty && text === initialText) {
      chain.setLink({ href: normalized.value }).run()
    } else if (!selectionWasEmpty) {
      chain.insertContent(createLinkedTextContent(text, normalized.value)).run()
    } else if (isEditing) {
      chain.extendMarkRange('link').setLink({ href: normalized.value }).run()
    } else {
      chain.insertContent(createLinkedTextContent(text, normalized.value)).run()
    }

    handleClose()
  }

  const handleRemoveLink = () => {
    if (editor) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    handleClose()
  }

  const formId = 'qn-link-form'

  return (
    <Modal
      open={linkModalOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit link' : 'Insert link'}
      description={
        isEditing ? 'Update the selected link destination.' : 'Link text in this note to a web page.'
      }
      icon={LinkIcon}
      size="md"
      initialFocusRef={urlInputRef}
      footer={
        <>
          {isEditing && (
            <Button
              variant="danger-ghost"
              icon={Unlink}
              onClick={handleRemoveLink}
              className="sm:mr-auto"
            >
              Remove link
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={!url.trim()}>
            {isEditing ? 'Update link' : 'Insert link'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleInsert} className="space-y-4" noValidate>
        <Field
          label="Web address"
          error={urlError}
          hint="HTTPS is added automatically when no protocol is entered."
          required
        >
          {(fieldProps) => (
            <div className="relative">
              <ExternalLink
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
                aria-hidden="true"
              />
              <Input
                {...fieldProps}
                ref={urlInputRef}
                type="text"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  setUrlError('')
                }}
                onBlur={() => {
                  if (url.trim() && !normalizedPreview.value) setUrlError(normalizedPreview.error)
                }}
                placeholder="https://example.com"
                className="pl-9"
              />
            </div>
          )}
        </Field>

        {(!isEditing || !selectionWasEmpty) && (
          <Field
            label="Text to display"
            hint={selectionWasEmpty ? 'Leave blank to display the web address.' : undefined}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="text"
                value={text}
                maxLength={2000}
                onChange={(event) => setText(event.target.value)}
                placeholder={selectionWasEmpty ? 'Optional label' : 'Link text'}
              />
            )}
          </Field>
        )}

        {normalizedPreview.value && (
          <div className="rounded-control border border-subtle bg-surface-sunken px-3 py-2">
            <p className="text-ui-xs font-medium uppercase tracking-wide text-content-subtle">
              Preview
            </p>
            <p className="mt-1 break-all text-ui-md text-accent-text">
              {text.trim() || normalizedPreview.value}
            </p>
            <p className="mt-0.5 break-all text-ui-xs text-content-subtle">
              {normalizedPreview.value}
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}
