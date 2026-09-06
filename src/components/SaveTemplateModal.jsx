import { useEffect, useRef, useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { Button, Checkbox, Input, Modal } from './ui'
import toast from 'react-hot-toast'

export default function SaveTemplateModal() {
  const { templateSaveOpen, setTemplateSaveOpen } = useUIStore()
  const { getSelectedNote, createNoteTemplate } = useNotesStore()
  const note = getSelectedNote()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [titleTemplate, setTitleTemplate] = useState('')
  const [includeTags, setIncludeTags] = useState(true)
  const [favorite, setFavorite] = useState(true)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!templateSaveOpen || !note) return
    setName(`${note.title || 'Untitled note'} template`)
    setDescription('')
    setTitleTemplate(note.title || '{{date}} · Untitled note')
    setIncludeTags(true)
    setFavorite(true)
  }, [note, templateSaveOpen])

  const close = () => setTemplateSaveOpen(false)
  const save = () => {
    if (!note) return
    try {
      createNoteTemplate({
        name,
        description,
        titleTemplate,
        noteType: note.noteType || 'standard',
        content: note.content || '',
        noteData: note.noteData ?? null,
        tags: includeTags ? note.tags || [] : [],
        favorite,
      })
      toast.success('Template saved')
      close()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <Modal
      open={templateSaveOpen}
      onClose={close}
      title="Save as template"
      description="Reuse this note’s structure without changing the original."
      icon={LayoutTemplate}
      size="md"
      initialFocusRef={nameRef}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save template</Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Template name</span>
          <Input ref={nameRef} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Description</span>
          <Input value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="When should this template be used?" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Default note title</span>
          <Input value={titleTemplate} maxLength={500} onChange={(event) => setTitleTemplate(event.target.value)} />
          <span className="mt-1 block text-ui-xs text-content-subtle">
            Variables: {'{{date}}'}, {'{{time}}'}, and {'{{title}}'}
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-card border border-subtle bg-surface-sunken p-3">
          <Checkbox checked={includeTags} onChange={(event) => setIncludeTags(event.target.checked)} className="mt-0.5" />
          <span>
            <span className="block text-ui-md font-medium text-content">Include tags</span>
            <span className="block text-ui-sm text-content-muted">New notes inherit this note’s tags.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-card border border-subtle bg-surface-sunken p-3">
          <Checkbox checked={favorite} onChange={(event) => setFavorite(event.target.checked)} className="mt-0.5" />
          <span>
            <span className="block text-ui-md font-medium text-content">Pin in My templates</span>
            <span className="block text-ui-sm text-content-muted">Favourite templates appear first on every device.</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}
