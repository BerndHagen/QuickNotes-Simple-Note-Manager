const VARIABLE_PATTERN = /\{\{(title|date|time)\}\}/g

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatTime = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

export const applyTemplateVariables = (value, { title = '', now = new Date() } = {}) => {
  if (typeof value !== 'string') return value
  return value.replace(VARIABLE_PATTERN, (_, variable) => {
    if (variable === 'title') return title
    if (variable === 'date') return formatDate(now)
    return formatTime(now)
  })
}

const transformJsonStrings = (value, variables) => {
  if (typeof value === 'string') return applyTemplateVariables(value, variables)
  if (Array.isArray(value)) return value.map((item) => transformJsonStrings(item, variables))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, transformJsonStrings(child, variables)])
  )
}

export const createNoteInputFromTemplate = (template, title, now = new Date()) => {
  const requestedTitle = title?.trim() || ''
  const titlePattern = template?.titleTemplate || template?.name || 'Untitled note'
  const resolvedTitle = requestedTitle && !titlePattern.includes('{{title}}')
    ? requestedTitle
    : applyTemplateVariables(titlePattern, {
        title: requestedTitle || template?.name || 'Untitled note',
        now,
      })
  const variables = { title: resolvedTitle, now }
  return {
    title: resolvedTitle,
    content: applyTemplateVariables(template?.content || '', variables),
    noteType: template?.noteType || 'standard',
    noteData: transformJsonStrings(template?.noteData ?? null, variables),
    tags: Array.isArray(template?.tags) ? [...template.tags] : [],
  }
}
