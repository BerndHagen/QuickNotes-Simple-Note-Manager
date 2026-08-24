import { getSearchableText } from './filterNotes'
import { collectWorkspaceTasks } from './workspaceTasks'

export const SMART_VIEW_MAX_RULES = 12
export const SMART_VIEW_FIELDS = Object.freeze({
  TEXT: 'text',
  TITLE: 'title',
  TAG: 'tag',
  FOLDER: 'folder',
  NOTE_TYPE: 'noteType',
  STARRED: 'starred',
  PINNED: 'pinned',
  TASKS: 'tasks',
  REMINDER: 'reminder',
  CREATED: 'createdAt',
  UPDATED: 'updatedAt',
})

const VALID_FIELDS = new Set(Object.values(SMART_VIEW_FIELDS))
const VALID_MATCH_MODES = new Set(['all', 'any'])
const VALID_SCOPES = new Set(['active', 'archive', 'trash', 'all'])
const VALID_SORTS = new Set([
  'updated-desc',
  'updated-asc',
  'created-desc',
  'created-asc',
  'title-asc',
  'title-desc',
  'manual',
])

const OPERATORS = Object.freeze({
  text: new Set(['contains', 'not_contains']),
  title: new Set(['contains', 'not_contains', 'is', 'is_not']),
  tag: new Set(['contains', 'not_contains']),
  folder: new Set(['is', 'is_not', 'is_empty', 'is_not_empty']),
  noteType: new Set(['is', 'is_not']),
  starred: new Set(['is']),
  pinned: new Set(['is']),
  tasks: new Set(['has_open', 'has_overdue', 'has_any', 'has_none']),
  reminder: new Set(['is_set', 'is_not_set', 'is_overdue', 'is_upcoming']),
  createdAt: new Set(['within_days', 'before', 'after']),
  updatedAt: new Set(['within_days', 'before', 'after']),
})

export const createSmartViewRule = (field = SMART_VIEW_FIELDS.TAG) => ({
  id: crypto.randomUUID(),
  field,
  operator: field === SMART_VIEW_FIELDS.TAG ? 'contains' : 'is',
  value: '',
})

const normalizeRule = (rule, index) => {
  const field = VALID_FIELDS.has(rule?.field) ? rule.field : SMART_VIEW_FIELDS.TAG
  const validOperators = OPERATORS[field]
  const operator = validOperators.has(rule?.operator)
    ? rule.operator
    : validOperators.values().next().value
  return {
    id: typeof rule?.id === 'string' && rule.id ? rule.id : `rule-${index}`,
    field,
    operator,
    value:
      typeof rule?.value === 'boolean' || typeof rule?.value === 'number'
        ? rule.value
        : String(rule?.value ?? '').slice(0, 500),
  }
}

export const normalizeSmartViewCriteria = (criteria) => {
  const sourceRules = Array.isArray(criteria?.rules) ? criteria.rules : []
  const rules = sourceRules.slice(0, SMART_VIEW_MAX_RULES).map(normalizeRule)
  if (rules.length === 0) rules.push(createSmartViewRule())

  return {
    match: VALID_MATCH_MODES.has(criteria?.match) ? criteria.match : 'all',
    scope: VALID_SCOPES.has(criteria?.scope) ? criteria.scope : 'active',
    sort: VALID_SORTS.has(criteria?.sort) ? criteria.sort : 'updated-desc',
    rules,
  }
}

const lower = (value) => String(value ?? '').trim().toLocaleLowerCase()
const validTime = (value) => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const noteReminderTimes = (note) => {
  const times = []
  const legacyTime = validTime(note.reminder)
  if (legacyTime != null) times.push(legacyTime)
  for (const reminder of Array.isArray(note.reminders) ? note.reminders : []) {
    if (reminder?.notified) continue
    const time = validTime(reminder?.datetime)
    if (time != null) times.push(time)
  }
  return [...new Set(times)]
}

const noteTaskState = (note, now) => {
  const tasks = collectWorkspaceTasks([note], new Date(now))
  return {
    any: tasks.length > 0,
    open: tasks.some((task) => !task.completed),
    overdue: tasks.some((task) => !task.completed && task.isOverdue),
  }
}

export const matchesSmartViewRule = (note, rule, context = {}) => {
  const now = context.now instanceof Date ? context.now.getTime() : context.now || Date.now()
  const value = lower(rule.value)

  switch (rule.field) {
    case SMART_VIEW_FIELDS.TEXT: {
      const haystack = lower(`${note.title || ''} ${(note.tags || []).join(' ')} ${getSearchableText(note)}`)
      const matched = haystack.includes(value)
      return rule.operator === 'not_contains' ? !matched : matched
    }
    case SMART_VIEW_FIELDS.TITLE: {
      const title = lower(note.title)
      if (rule.operator === 'is') return title === value
      if (rule.operator === 'is_not') return title !== value
      const matched = title.includes(value)
      return rule.operator === 'not_contains' ? !matched : matched
    }
    case SMART_VIEW_FIELDS.TAG: {
      const matched = (note.tags || []).some((tag) => lower(tag) === value)
      return rule.operator === 'not_contains' ? !matched : matched
    }
    case SMART_VIEW_FIELDS.FOLDER:
      if (rule.operator === 'is_empty') return !note.folderId
      if (rule.operator === 'is_not_empty') return Boolean(note.folderId)
      return rule.operator === 'is_not' ? note.folderId !== rule.value : note.folderId === rule.value
    case SMART_VIEW_FIELDS.NOTE_TYPE: {
      const matched = (note.noteType || 'standard') === rule.value
      return rule.operator === 'is_not' ? !matched : matched
    }
    case SMART_VIEW_FIELDS.STARRED:
      return Boolean(note.starred) === (rule.value === true || rule.value === 'true')
    case SMART_VIEW_FIELDS.PINNED:
      return Boolean(note.pinned) === (rule.value === true || rule.value === 'true')
    case SMART_VIEW_FIELDS.TASKS: {
      const state = noteTaskState(note, now)
      if (rule.operator === 'has_open') return state.open
      if (rule.operator === 'has_overdue') return state.overdue
      if (rule.operator === 'has_none') return !state.any
      return state.any
    }
    case SMART_VIEW_FIELDS.REMINDER: {
      const reminderTimes = noteReminderTimes(note)
      if (rule.operator === 'is_not_set') return reminderTimes.length === 0
      if (rule.operator === 'is_set') return reminderTimes.length > 0
      return rule.operator === 'is_overdue'
        ? reminderTimes.some((time) => time < now)
        : reminderTimes.some((time) => time >= now)
    }
    case SMART_VIEW_FIELDS.CREATED:
    case SMART_VIEW_FIELDS.UPDATED: {
      const noteTime = validTime(note[rule.field])
      if (noteTime == null) return false
      if (rule.operator === 'within_days') {
        const days = Math.max(1, Math.min(3650, Number(rule.value) || 1))
        return noteTime >= now - days * 24 * 60 * 60 * 1000 && noteTime <= now
      }
      const boundary = validTime(rule.value)
      if (boundary == null) return false
      return rule.operator === 'before' ? noteTime < boundary : noteTime >= boundary
    }
    default:
      return false
  }
}

export const getSmartViewScope = (view) => normalizeSmartViewCriteria(view?.criteria).scope
export const getSmartViewSort = (view) => normalizeSmartViewCriteria(view?.criteria).sort

export const matchesSmartView = (note, view, context) => {
  const criteria = normalizeSmartViewCriteria(view?.criteria)
  const outcomes = criteria.rules.map((rule) => matchesSmartViewRule(note, rule, context))
  return criteria.match === 'any' ? outcomes.some(Boolean) : outcomes.every(Boolean)
}

export const filterBySmartView = (notes, view, context) =>
  view ? notes.filter((note) => matchesSmartView(note, view, context)) : notes

export const deriveNoteDefaultsFromSmartView = (view) => {
  const criteria = normalizeSmartViewCriteria(view?.criteria)
  if (criteria.match !== 'all') return {}
  const defaults = {}
  const tags = []

  for (const rule of criteria.rules) {
    if (rule.operator !== 'is' && rule.operator !== 'contains') continue
    if (rule.field === SMART_VIEW_FIELDS.FOLDER && rule.operator === 'is') {
      defaults.folderId = rule.value || null
    } else if (rule.field === SMART_VIEW_FIELDS.NOTE_TYPE && rule.operator === 'is') {
      defaults.noteType = rule.value || 'standard'
    } else if (rule.field === SMART_VIEW_FIELDS.TAG && rule.operator === 'contains' && rule.value) {
      tags.push(lower(rule.value))
    } else if (rule.field === SMART_VIEW_FIELDS.STARRED && rule.operator === 'is') {
      defaults.starred = rule.value === true || rule.value === 'true'
    } else if (rule.field === SMART_VIEW_FIELDS.PINNED && rule.operator === 'is') {
      defaults.pinned = rule.value === true || rule.value === 'true'
    }
  }
  if (tags.length > 0) defaults.tags = [...new Set(tags)]
  return defaults
}
