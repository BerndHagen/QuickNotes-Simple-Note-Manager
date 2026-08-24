import { useEffect, useMemo, useRef, useState } from 'react'
import { Filter, Plus, Trash2 } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { Button, Input, Modal } from './ui'
import { filterNotes } from '../lib/filterNotes'
import {
  createSmartViewRule,
  filterBySmartView,
  normalizeSmartViewCriteria,
  SMART_VIEW_FIELDS,
  SMART_VIEW_MAX_RULES,
} from '../lib/smartViews'
import { NOTE_TYPE_CONFIG } from './editors'
import { ConfirmDialog } from './FolderDialogs'
import toast from 'react-hot-toast'

const FIELD_OPTIONS = [
  { value: SMART_VIEW_FIELDS.TAG, label: 'Tag' },
  { value: SMART_VIEW_FIELDS.FOLDER, label: 'Folder' },
  { value: SMART_VIEW_FIELDS.NOTE_TYPE, label: 'Workspace type' },
  { value: SMART_VIEW_FIELDS.TITLE, label: 'Title' },
  { value: SMART_VIEW_FIELDS.TEXT, label: 'Title, body or fields' },
  { value: SMART_VIEW_FIELDS.STARRED, label: 'Favourite' },
  { value: SMART_VIEW_FIELDS.PINNED, label: 'Pinned' },
  { value: SMART_VIEW_FIELDS.TASKS, label: 'Tasks' },
  { value: SMART_VIEW_FIELDS.REMINDER, label: 'Reminder' },
  { value: SMART_VIEW_FIELDS.CREATED, label: 'Created date' },
  { value: SMART_VIEW_FIELDS.UPDATED, label: 'Edited date' },
]

const OPERATOR_OPTIONS = {
  tag: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  folder: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  noteType: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  title: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'is', label: 'equals' },
    { value: 'is_not', label: 'does not equal' },
  ],
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  starred: [{ value: 'is', label: 'is' }],
  pinned: [{ value: 'is', label: 'is' }],
  tasks: [
    { value: 'has_open', label: 'has open tasks' },
    { value: 'has_overdue', label: 'has overdue tasks' },
    { value: 'has_any', label: 'has any tasks' },
    { value: 'has_none', label: 'has no tasks' },
  ],
  reminder: [
    { value: 'is_set', label: 'is set' },
    { value: 'is_not_set', label: 'is not set' },
    { value: 'is_overdue', label: 'is overdue' },
    { value: 'is_upcoming', label: 'is upcoming' },
  ],
  createdAt: [
    { value: 'within_days', label: 'is within the last' },
    { value: 'before', label: 'is before' },
    { value: 'after', label: 'is on or after' },
  ],
  updatedAt: [
    { value: 'within_days', label: 'is within the last' },
    { value: 'before', label: 'is before' },
    { value: 'after', label: 'is on or after' },
  ],
}

const NO_VALUE_OPERATORS = new Set([
  'is_empty', 'is_not_empty', 'has_open', 'has_overdue', 'has_any', 'has_none',
  'is_set', 'is_not_set', 'is_overdue', 'is_upcoming',
])

const selectClass = 'qn-input min-h-9 w-full rounded-control border border-subtle bg-input px-2.5 text-ui-md text-content outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus'

function RuleValue({ rule, folders, tags, onChange, label }) {
  if (NO_VALUE_OPERATORS.has(rule.operator)) return <span aria-hidden="true" />
  if (rule.field === SMART_VIEW_FIELDS.TAG) {
    return (
      <select aria-label={label} className={selectClass} value={rule.value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a tag</option>
        {tags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
      </select>
    )
  }
  if (rule.field === SMART_VIEW_FIELDS.FOLDER) {
    return (
      <select aria-label={label} className={selectClass} value={rule.value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a folder</option>
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
    )
  }
  if (rule.field === SMART_VIEW_FIELDS.NOTE_TYPE) {
    return (
      <select aria-label={label} className={selectClass} value={rule.value} onChange={(event) => onChange(event.target.value)}>
        {Object.values(NOTE_TYPE_CONFIG).map((type) => (
          <option key={type.id} value={type.id}>{type.name}</option>
        ))}
      </select>
    )
  }
  if (rule.field === SMART_VIEW_FIELDS.STARRED || rule.field === SMART_VIEW_FIELDS.PINNED) {
    return (
      <select aria-label={label} className={selectClass} value={String(rule.value)} onChange={(event) => onChange(event.target.value === 'true')}>
        <option value="true">yes</option>
        <option value="false">no</option>
      </select>
    )
  }
  if (
    (rule.field === SMART_VIEW_FIELDS.CREATED || rule.field === SMART_VIEW_FIELDS.UPDATED) &&
    rule.operator !== 'within_days'
  ) {
    return <Input aria-label={label} type="date" value={rule.value} onChange={(event) => onChange(event.target.value)} />
  }
  if (rule.operator === 'within_days') {
    return (
      <div className="flex items-center gap-2">
        <Input aria-label={label} type="number" min="1" max="3650" value={rule.value || 7} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="shrink-0 text-ui-sm text-content-muted">days</span>
      </div>
    )
  }
  return <Input aria-label={label} value={rule.value} maxLength={500} onChange={(event) => onChange(event.target.value)} placeholder="Value" />
}

export default function SmartViewModal() {
  const { smartViewModalOpen, smartViewEditingId, setSmartViewModalOpen } = useUIStore()
  const { notes, folders, tags, savedViews, createSavedView, updateSavedView, deleteSavedView } = useNotesStore()
  const editing = savedViews.find((view) => view.id === smartViewEditingId)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#0f766e')
  const [criteria, setCriteria] = useState(() => normalizeSmartViewCriteria())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!smartViewModalOpen) return
    setName(editing?.name || '')
    setColor(editing?.color || '#0f766e')
    setCriteria(normalizeSmartViewCriteria(editing?.criteria))
  }, [editing, smartViewModalOpen])

  const previewCount = useMemo(() => {
    const scoped = filterNotes(notes, { scope: criteria.scope })
    return filterBySmartView(scoped, { criteria }).length
  }, [criteria, notes])

  const updateRule = (id, patch) => {
    setCriteria((current) => ({
      ...current,
      rules: current.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule),
    }))
  }

  const changeField = (rule, field) => {
    const operator = OPERATOR_OPTIONS[field][0].value
    let value = ''
    if (field === SMART_VIEW_FIELDS.NOTE_TYPE) value = 'standard'
    if (field === SMART_VIEW_FIELDS.STARRED || field === SMART_VIEW_FIELDS.PINNED) value = true
    if (operator === 'within_days') value = 7
    updateRule(rule.id, { field, operator, value })
  }

  const close = () => setSmartViewModalOpen(false)
  const submit = () => {
    try {
      const input = { name, color, icon: 'ListFilter', criteria: normalizeSmartViewCriteria(criteria) }
      if (editing) updateSavedView(editing.id, input)
      else createSavedView(input)
      toast.success(editing ? 'Smart view updated' : 'Smart view created')
      close()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <Modal
      open={smartViewModalOpen}
      onClose={close}
      title={editing ? 'Edit smart view' : 'New smart view'}
      description="Build a live collection. Notes stay in their original folders."
      icon={Filter}
      size="2xl"
      initialFocusRef={nameRef}
      footer={
        <>
          {editing && (
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <span className="mr-auto text-ui-sm text-content-muted" aria-live="polite">
            {previewCount} matching {previewCount === 1 ? 'note' : 'notes'}
          </span>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{editing ? 'Save changes' : 'Create view'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_96px]">
          <label className="block">
            <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Name</span>
            <Input ref={nameRef} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Recent project notes" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Colour</span>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-full cursor-pointer rounded-control border border-subtle bg-input p-1" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Include notes from</span>
            <select className={selectClass} value={criteria.scope} onChange={(event) => setCriteria((current) => ({ ...current, scope: event.target.value }))}>
              <option value="active">Active notes</option>
              <option value="archive">Archive</option>
              <option value="trash">Trash</option>
              <option value="all">Everywhere</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Match</span>
            <select className={selectClass} value={criteria.match} onChange={(event) => setCriteria((current) => ({ ...current, match: event.target.value }))}>
              <option value="all">All rules</option>
              <option value="any">Any rule</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-ui-sm font-medium text-content-muted">Sort by</span>
            <select className={selectClass} value={criteria.sort} onChange={(event) => setCriteria((current) => ({ ...current, sort: event.target.value }))}>
              <option value="updated-desc">Recently edited</option>
              <option value="updated-asc">Least recently edited</option>
              <option value="created-desc">Newest created</option>
              <option value="created-asc">Oldest created</option>
              <option value="title-asc">Title A–Z</option>
              <option value="title-desc">Title Z–A</option>
              <option value="manual">Manual order</option>
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="text-ui-lg font-semibold text-content">Rules</legend>
          <div className="mt-2 space-y-2">
            {criteria.rules.map((rule, index) => (
              <div key={rule.id} className="grid items-center gap-2 rounded-card border border-subtle bg-surface-sunken p-2.5 sm:grid-cols-[42px_1fr_1fr_1.25fr_36px]">
                <span className="text-center text-ui-xs font-semibold uppercase text-content-subtle">{index + 1}</span>
                <select className={selectClass} aria-label={`Rule ${index + 1} field`} value={rule.field} onChange={(event) => changeField(rule, event.target.value)}>
                  {FIELD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select className={selectClass} aria-label={`Rule ${index + 1} operator`} value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value })}>
                  {OPERATOR_OPTIONS[rule.field].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <RuleValue label={`Rule ${index + 1} value`} rule={rule} folders={folders} tags={tags} onChange={(value) => updateRule(rule.id, { value })} />
                <button type="button" aria-label={`Remove rule ${index + 1}`} disabled={criteria.rules.length === 1} onClick={() => setCriteria((current) => ({ ...current, rules: current.rules.filter((candidate) => candidate.id !== rule.id) }))} className="qn-square-control inline-flex h-9 w-9 items-center justify-center rounded-control text-content-subtle hover:bg-danger-soft hover:text-danger-text disabled:opacity-30">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <Button
            className="mt-3"
            variant="secondary"
            size="sm"
            icon={Plus}
            disabled={criteria.rules.length >= SMART_VIEW_MAX_RULES}
            onClick={() => setCriteria((current) => ({ ...current, rules: [...current.rules, createSmartViewRule()] }))}
          >
            Add rule
          </Button>
        </fieldset>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteSavedView(editing.id)
          setConfirmDelete(false)
          close()
        }}
        icon={Trash2}
        title="Delete smart view?"
        description="The live collection will be removed. Its notes stay in their original folders."
        confirmLabel="Delete view"
      />
    </Modal>
  )
}
