import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  Search,
  Sparkles,
} from 'lucide-react'
import { useUIStore, useNotesStore } from '../store'
import {
  NOTE_TYPES,
  NOTE_TYPE_CONFIG,
  NOTE_TYPE_STARTERS,
  CATEGORIES,
  getStarterContent,
  getStarterData,
} from './editors'
import { Button, Input, Modal } from './ui'
import { MAX_NOTE_TITLE_LENGTH } from '../lib/dataValidation'

const types = Object.values(NOTE_TYPE_CONFIG)

export default function NoteTypesModal({ onCreated }) {
  const { noteTypesModalOpen, setNoteTypesModalOpen } = useUIStore()
  const { createNote } = useNotesStore()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState(NOTE_TYPES.STANDARD)
  const [selectedStarter, setSelectedStarter] = useState(
    NOTE_TYPE_STARTERS[NOTE_TYPES.STANDARD][0].id
  )
  const [title, setTitle] = useState(NOTE_TYPE_STARTERS[NOTE_TYPES.STANDARD][0].title)
  const searchRef = useRef(null)

  const config = NOTE_TYPE_CONFIG[selectedType]
  const starters = NOTE_TYPE_STARTERS[selectedType] || []
  const activeStarter =
    starters.find((starter) => starter.id === selectedStarter) || starters[0]

  const filteredTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return types.filter((type) => {
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
  }, [query, selectedCategory])

  const selectType = (typeId) => {
    const starter = NOTE_TYPE_STARTERS[typeId]?.[0]
    setSelectedType(typeId)
    setSelectedStarter(starter?.id || 'blank')
    setTitle(starter?.title || NOTE_TYPE_CONFIG[typeId]?.name || 'New note')
  }

  const selectStarter = (starter) => {
    setSelectedStarter(starter.id)
    setTitle(starter.title)
  }

  const close = () => setNoteTypesModalOpen(false)

  const createSelectedNote = () => {
    const cleanTitle = title.trim() || activeStarter?.title || config.name
    createNote({
      title: cleanTitle,
      content: getStarterContent(selectedType, selectedStarter),
      noteType: selectedType,
      noteData: getStarterData(selectedType, selectedStarter),
    })
    close()
    onCreated?.()
  }

  return (
    <Modal
      open={noteTypesModalOpen}
      onClose={close}
      title="New workspace"
      description="Choose a purpose-built workspace, then decide how you want to begin."
      icon={Sparkles}
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
          >
            Create {config.shortName.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 lg:h-full lg:grid-cols-[minmax(300px,0.88fr)_minmax(380px,1.12fr)]">
        <section
          aria-label="Workspace types"
          className="min-h-0 border-b border-subtle bg-surface-raised lg:flex lg:flex-col lg:border-b-0 lg:border-r"
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
              {CATEGORIES.map((category) => {
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

          <div className="flex gap-2 overflow-x-auto p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:block lg:space-y-2 lg:overflow-x-hidden lg:overflow-y-auto">
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
                const active = selectedType === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectType(type.id)}
                    className={[
                      'group relative flex w-[min(82vw,20rem)] shrink-0 items-start gap-3 rounded-card border p-3.5 text-left transition-[background-color,border-color,box-shadow] duration-fast lg:w-full',
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

        <section aria-label={`${config.name} setup`} className="min-h-0 bg-surface-raised lg:overflow-y-auto">
            <div className="border-b border-subtle px-5 py-5 sm:px-7 sm:py-6">
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
                  <Sparkles className="h-4 w-4 text-accent-text" aria-hidden="true" />
                  Built as a real workspace
                </div>
                <p className="mt-1.5 text-ui-sm leading-relaxed text-content-muted">
                  {selectedType === NOTE_TYPES.STANDARD
                    ? 'Uses the complete document editor with formatting, tables, tasks, links, media, and focus tools.'
                    : `Uses a dedicated ${config.shortName.toLowerCase()} editor with structured data, meaningful progress, and export support.`}
                </p>
              </div>
            </div>
        </section>
      </div>
    </Modal>
  )
}
