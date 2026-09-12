import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutTemplate,
  BookOpenText,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { useUIStore, useNotesStore } from '../store'
import {
  NOTE_TYPES,
  NOTE_TYPE_CONFIG,
  NOTE_TYPE_STARTERS,
  CATEGORIES,
  getStarterContent,
  getStarterData,
} from './editors/noteTypes'
import { Button, Input, Modal } from './ui'
import { MAX_NOTE_TITLE_LENGTH } from '../lib/dataValidation'
import { applyTemplateVariables } from '../lib/noteTemplates'
import { ConfirmDialog } from './FolderDialogs'

const types = Object.values(NOTE_TYPE_CONFIG)

export default function NoteTypesModal({ onCreated }) {
  const { noteTypesModalOpen, setNoteTypesModalOpen } = useUIStore()
  const {
    createNote,
    noteTemplates,
    createNoteFromTemplate,
    updateNoteTemplate,
    deleteNoteTemplate,
  } = useNotesStore()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState(NOTE_TYPES.STANDARD)
  const [selectedStarter, setSelectedStarter] = useState(
    NOTE_TYPE_STARTERS[NOTE_TYPES.STANDARD][0].id
  )
  const [title, setTitle] = useState(NOTE_TYPE_STARTERS[NOTE_TYPES.STANDARD][0].title)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [confirmTemplateDelete, setConfirmTemplateDelete] = useState(false)
  const [mobileStep, setMobileStep] = useState('choose')
  const searchRef = useRef(null)

  useEffect(() => {
    if (noteTypesModalOpen) setMobileStep('choose')
  }, [noteTypesModalOpen])

  const selectedTemplate = noteTemplates.find((template) => template.id === selectedTemplateId)
  const baseConfig = NOTE_TYPE_CONFIG[selectedType]
  const config = selectedTemplate
    ? {
        ...baseConfig,
        name: selectedTemplate.name,
        shortName: 'template',
        category: 'my template',
        description: selectedTemplate.description || `Reusable ${baseConfig.shortName.toLowerCase()} structure`,
        bestFor: selectedTemplate.description || 'A reusable workspace saved from one of your own notes.',
        features: [baseConfig.name, `${selectedTemplate.tags?.length || 0} inherited tags`, 'Synced across devices'],
        icon: LayoutTemplate,
      }
    : baseConfig
  const starters = selectedTemplate
    ? [{ id: 'custom-template', name: selectedTemplate.name, description: selectedTemplate.description || 'Your saved content and structure' }]
    : NOTE_TYPE_STARTERS[selectedType] || []
  const activeStarter =
    starters.find((starter) => starter.id === selectedStarter) || starters[0]

  const filteredTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const customTypes = noteTemplates.map((template) => ({
      id: `template:${template.id}`,
      templateId: template.id,
      name: template.name,
      shortName: 'template',
      description: template.description || `Reusable ${NOTE_TYPE_CONFIG[template.noteType]?.shortName.toLowerCase() || 'note'} structure`,
      bestFor: template.description || '',
      category: 'mine',
      features: [NOTE_TYPE_CONFIG[template.noteType]?.name || 'Document', ...(template.tags || [])],
      keywords: ['custom', 'template'],
      icon: LayoutTemplate,
      color: NOTE_TYPE_CONFIG[template.noteType]?.color || '#2a697a',
      favorite: template.favorite,
    })).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name))

    const availableTypes = [...customTypes, ...types]

    return availableTypes.filter((type) => {
      const matchesCategory =
        selectedCategory === 'all' || type.category === selectedCategory
      const haystack = [
        type.name,
        type.description,
        type.bestFor,
        type.category,
        ...(type.features || []),
        ...(type.keywords || []),
      ].join(' ').toLowerCase()

      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery))
    })
  }, [noteTemplates, query, selectedCategory])

  const selectType = (typeId) => {
    if (typeId.startsWith('template:')) {
      const template = noteTemplates.find((candidate) => `template:${candidate.id}` === typeId)
      if (!template) return
      setSelectedTemplateId(template.id)
      setSelectedType(template.noteType || NOTE_TYPES.STANDARD)
      setSelectedStarter('custom-template')
      setTitle(
        template.titleTemplate?.includes('{{title}}')
          ? template.name
          : applyTemplateVariables(template.titleTemplate || template.name, { title: template.name })
      )
      setMobileStep('configure')
      return
    }
    setSelectedTemplateId(null)
    const starter = NOTE_TYPE_STARTERS[typeId]?.[0]
    setSelectedType(typeId)
    setSelectedStarter(starter?.id || 'blank')
    setTitle(starter?.title || NOTE_TYPE_CONFIG[typeId]?.name || 'New note')
    setMobileStep('configure')
  }

  const selectStarter = (starter) => {
    setSelectedStarter(starter.id)
    setTitle(starter.title)
  }

  const close = () => setNoteTypesModalOpen(false)

  const createSelectedNote = () => {
    const cleanTitle = title.trim() || activeStarter?.title || config.name
    if (selectedTemplate) {
      createNoteFromTemplate(selectedTemplate.id, cleanTitle)
    } else {
      createNote({
        title: cleanTitle,
        content: getStarterContent(selectedType, selectedStarter),
        noteType: selectedType,
        noteData: getStarterData(selectedType, selectedStarter),
      })
    }
    close()
    onCreated?.()
  }

  return (
    <Modal
      open={noteTypesModalOpen}
      onClose={close}
      title="New workspace"
      description="Choose a purpose-built workspace, then decide how you want to begin."
      icon={BookOpenText}
      size="3xl"
      initialFocusRef={searchRef}
      bodyPadding="none"
      bodyClassName="lg:overflow-hidden"
      contentClassName="sm:h-[min(820px,88dvh)]"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            iconRight={ArrowRight}
            onClick={createSelectedNote}
            className={mobileStep === 'configure' ? '' : 'qn-workspace-picker-create'}
          >
            Create {config.shortName.toLowerCase()}
          </Button>
        </>
      }
    >
      <div
        className="qn-workspace-picker grid min-h-0 lg:h-full lg:grid-cols-[minmax(300px,0.88fr)_minmax(380px,1.12fr)]"
        data-mobile-step={mobileStep}
      >
        <section
          aria-label="Workspace types"
          className="qn-workspace-picker-choose min-h-0 border-b border-subtle bg-surface-raised lg:flex lg:flex-col lg:border-b-0 lg:border-r"
        >
          <div className="shrink-0 border-b border-subtle bg-surface-raised p-4 sm:p-5">
            <p className="mb-3 text-ui-xs font-semibold uppercase tracking-[0.14em] text-content-subtle">
              1 · Choose a workspace
            </p>
            <label htmlFor="qn-type-search" className="qn-sr-only">
              Search workspace types
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
                aria-hidden="true"
              />
              <Input
                id="qn-type-search"
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by goal or feature…"
                className="pl-9"
              />
            </div>

            <div
              className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
              aria-label="Filter note types"
            >
              {[{ id: 'all', name: 'All' }, ...(noteTemplates.length ? [{ id: 'mine', name: 'My templates' }] : []), ...CATEGORIES.filter((category) => category.id !== 'all')].map((category) => {
                const active = selectedCategory === category.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(category.id)}
                    className={[
                      'shrink-0 rounded-full border px-3 py-1.5 text-ui-sm font-medium transition-colors',
                      active
                        ? 'border-[var(--qn-text)] bg-[var(--qn-text)] text-white'
                        : 'border-subtle bg-surface-raised text-content-muted hover:border-strong hover:text-content',
                    ].join(' ')}
                  >
                    {category.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="qn-workspace-picker-types flex gap-2 overflow-x-auto p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:block lg:space-y-2 lg:overflow-x-hidden lg:overflow-y-auto">
            {filteredTypes.length === 0 ? (
              <div className="rounded-card border border-dashed border-strong bg-surface-raised px-5 py-10 text-center">
                  <p className="text-ui-lg font-medium text-content">No matching workspace</p>
                <p className="mt-1 text-ui-md text-content-muted">
                  Try a broader goal or choose another category.
                </p>
              </div>
            ) : (
              filteredTypes.map((type) => {
                const Icon = type.icon
                const active = type.templateId
                  ? selectedTemplateId === type.templateId
                  : !selectedTemplateId && selectedType === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectType(type.id)}
                    className={[
                      'qn-workspace-picker-type group relative flex w-[min(82vw,20rem)] shrink-0 items-start gap-3 rounded-card border p-3.5 text-left transition-[background-color,border-color,box-shadow] duration-fast lg:w-full',
                      active
                        ? 'border-strong bg-surface-raised shadow-sm'
                        : 'border-transparent bg-transparent hover:border-subtle hover:bg-surface-hover',
                    ].join(' ')}
                  >
                    {active && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden="true" />}
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ backgroundColor: `${type.color}18`, color: type.color }}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-ui-lg font-semibold text-content">
                          {type.name}
                        </span>
                        <span className="text-ui-xs font-medium uppercase tracking-wide text-content-subtle">
                          {type.category}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-ui-md leading-relaxed text-content-muted">
                        {type.description}
                      </span>
                    </span>
                    {type.favorite && (
                      <Star className="mt-1 h-3.5 w-3.5 shrink-0 fill-current text-amber-500" aria-label="Favourite template" />
                    )}
                    {active && (
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-accent-text"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section aria-label={`${config.name} setup`} className="qn-workspace-picker-configure min-h-0 bg-surface-raised lg:overflow-y-auto">
            <div className="border-b border-subtle px-5 py-5 sm:px-7 sm:py-6">
              <button
                type="button"
                className="qn-workspace-picker-back mb-3 items-center gap-1.5 text-ui-sm font-medium text-content-muted hover:text-content"
                onClick={() => setMobileStep('choose')}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Workspace types
              </button>
              <p className="mb-3 text-ui-xs font-semibold uppercase tracking-[0.14em] text-content-subtle">
                2 · Configure the workspace
              </p>
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card border shadow-xs"
                  style={{ backgroundColor: `${config.color}12`, borderColor: `${config.color}35`, color: config.color }}
                >
                  <config.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ui-xs font-semibold uppercase tracking-[0.14em] text-content-subtle">
                    {config.category}
                  </p>
                  <h3 className="mt-1 text-title-md font-semibold text-content">{config.name}</h3>
                  <p className="mt-1 max-w-xl text-ui-md leading-relaxed text-content-muted">{config.bestFor}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-subtle pt-4">
                {config.features.map((feature) => (
                  <span key={feature} className="inline-flex items-center gap-1.5 text-ui-sm text-content-muted">
                    <Check className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
                    {feature}
                  </span>
                ))}
              </div>
              {selectedTemplate && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-subtle pt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Star}
                    onClick={() => updateNoteTemplate(selectedTemplate.id, { favorite: !selectedTemplate.favorite })}
                  >
                    {selectedTemplate.favorite ? 'Unpin template' : 'Pin template'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger-ghost"
                    icon={Trash2}
                    onClick={() => setConfirmTemplateDelete(true)}
                  >
                    Delete template
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <label
                  htmlFor="qn-new-note-title"
                  className="mb-1.5 block text-ui-sm font-medium text-content-muted"
                >
                  Note title
                </label>
                <Input
                  id="qn-new-note-title"
                  maxLength={MAX_NOTE_TITLE_LENGTH}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      createSelectedNote()
                    }
                  }}
                  placeholder={config.name}
                />
              </div>

              <fieldset>
                <legend className="text-ui-lg font-semibold text-content">
                  Choose a starting point
                </legend>
                <p className="mt-1 text-ui-md text-content-muted">
                  Every option stays fully editable. Starters provide useful structure, not sample clutter.
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {starters.map((starter) => {
                    const active = starter.id === selectedStarter
                    return (
                      <label
                        key={starter.id}
                        className={[
                          'relative cursor-pointer rounded-card border p-3.5 transition-[background-color,border-color,box-shadow] duration-fast',
                          active
                            ? 'border-strong bg-surface-raised shadow-sm ring-1 ring-[var(--qn-border-strong)]'
                            : 'border-subtle bg-surface-raised hover:border-strong hover:bg-surface-hover',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="note-starter"
                          value={starter.id}
                          checked={active}
                          onChange={() => selectStarter(starter)}
                          className="qn-sr-only"
                        />
                        <span className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={[
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                              active
                                ? 'border-accent bg-accent text-accent-on'
                                : 'border-strong bg-surface-raised',
                            ].join(' ')}
                          >
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                          </span>
                          <span>
                            <span className="block text-ui-md font-semibold text-content">
                              {starter.name}
                            </span>
                            <span className="mt-0.5 block text-ui-sm leading-relaxed text-content-muted">
                              {starter.description}
                            </span>
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <div className="rounded-card border border-subtle bg-surface-raised p-4 shadow-xs">
                <div className="flex items-center gap-2 text-ui-md font-semibold text-content">
                  <BookOpenText className="h-4 w-4 text-accent-text" aria-hidden="true" />
                  Built as a real workspace
                </div>
                <p className="mt-1.5 text-ui-sm leading-relaxed text-content-muted">
                  {selectedTemplate
                    ? 'Creates a fresh note from your saved content, structured fields, tags, and title variables.'
                    : selectedType === NOTE_TYPES.STANDARD
                    ? 'Uses the complete document editor with formatting, tables, tasks, links, media, and focus tools.'
                    : `Uses a dedicated ${config.shortName.toLowerCase()} editor with structured data, meaningful progress, and export support.`}
                </p>
              </div>
            </div>
        </section>
      </div>
      <ConfirmDialog
        open={confirmTemplateDelete}
        onClose={() => setConfirmTemplateDelete(false)}
        onConfirm={() => {
          deleteNoteTemplate(selectedTemplate.id)
          setConfirmTemplateDelete(false)
          selectType(NOTE_TYPES.STANDARD)
        }}
        icon={Trash2}
        title="Delete template?"
        description="Existing notes created from this template are not affected."
        confirmLabel="Delete template"
      />
    </Modal>
  )
}
