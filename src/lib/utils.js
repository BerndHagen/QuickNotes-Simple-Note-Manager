import { v4 as uuidv4 } from 'uuid'

export const generateId = () => uuidv4()

const timeTranslations = {
  en: {
    justNow: 'Just now',
    minuteAgo: '1 minute ago',
    minutesAgo: '{n} minutes ago',
    hourAgo: '1 hour ago',
    hoursAgo: '{n} hours ago',
    dayAgo: '1 day ago',
    daysAgo: '{n} days ago',
    neverSynced: 'Never synced',
    minAgo: '{n} min ago',
    hrsAgo: '{n} hrs ago',
  },
  de: {
    justNow: 'Gerade eben',
    minuteAgo: 'Vor 1 Minute',
    minutesAgo: 'Vor {n} Minuten',
    hourAgo: 'Vor 1 Stunde',
    hoursAgo: 'Vor {n} Stunden',
    dayAgo: 'Vor 1 Tag',
    daysAgo: 'Vor {n} Tagen',
    neverSynced: 'Nie synchronisiert',
    minAgo: 'Vor {n} Min.',
    hrsAgo: 'Vor {n} Std.',
  },
  es: {
    justNow: 'Ahora mismo',
    minuteAgo: 'Hace 1 minuto',
    minutesAgo: 'Hace {n} minutos',
    hourAgo: 'Hace 1 hora',
    hoursAgo: 'Hace {n} horas',
    dayAgo: 'Hace 1 día',
    daysAgo: 'Hace {n} días',
    neverSynced: 'Nunca sincronizado',
    minAgo: 'Hace {n} min',
    hrsAgo: 'Hace {n} h',
  },
  fr: {
    justNow: 'À l\'instant',
    minuteAgo: 'Il y a 1 minute',
    minutesAgo: 'Il y a {n} minutes',
    hourAgo: 'Il y a 1 heure',
    hoursAgo: 'Il y a {n} heures',
    dayAgo: 'Il y a 1 jour',
    daysAgo: 'Il y a {n} jours',
    neverSynced: 'Jamais synchronisé',
    minAgo: 'Il y a {n} min',
    hrsAgo: 'Il y a {n} h',
  },
  pt: {
    justNow: 'Agora mesmo',
    minuteAgo: 'Há 1 minuto',
    minutesAgo: 'Há {n} minutos',
    hourAgo: 'Há 1 hora',
    hoursAgo: 'Há {n} horas',
    dayAgo: 'Há 1 dia',
    daysAgo: 'Há {n} dias',
    neverSynced: 'Nunca sincronizado',
    minAgo: 'Há {n} min',
    hrsAgo: 'Há {n} h',
  },
  zh: {
    justNow: '\u521A\u521A',
    minuteAgo: '1\u5206\u949F\u524D',
    minutesAgo: '{n}\u5206\u949F\u524D',
    hourAgo: '1\u5C0F\u65F6\u524D',
    hoursAgo: '{n}\u5C0F\u65F6\u524D',
    dayAgo: '1\u5929\u524D',
    daysAgo: '{n}\u5929\u524D',
    neverSynced: '\u4ECE\u672A\u540C\u6B65',
    minAgo: '{n}\u5206\u949F\u524D',
    hrsAgo: '{n}\u5C0F\u65F6\u524D',
  },
  hi: {
    justNow: '\u0905\u092D\u0940',
    minuteAgo: '1 \u092E\u093F\u0928\u091F \u092A\u0939\u0932\u0947',
    minutesAgo: '{n} \u092E\u093F\u0928\u091F \u092A\u0939\u0932\u0947',
    hourAgo: '1 \u0918\u0902\u091F\u093E \u092A\u0939\u0932\u0947',
    hoursAgo: '{n} \u0918\u0902\u091F\u0947 \u092A\u0939\u0932\u0947',
    dayAgo: '1 \u0926\u093F\u0928 \u092A\u0939\u0932\u0947',
    daysAgo: '{n} \u0926\u093F\u0928 \u092A\u0939\u0932\u0947',
    neverSynced: '\u0915\u092D\u0940 \u0938\u093F\u0902\u0915 \u0928\u0939\u0940\u0902 \u0939\u0941\u0906',
    minAgo: '{n} \u092E\u093F\u0928\u091F \u092A\u0939\u0932\u0947',
    hrsAgo: '{n} \u0918\u0902\u091F\u0947 \u092A\u0939\u0932\u0947',
  },
  ar: {
    justNow: '\u0627\u0644\u0622\u0646',
    minuteAgo: '\u0645\u0646\u0630 \u062F\u0642\u064A\u0642\u0629',
    minutesAgo: '\u0645\u0646\u0630 {n} \u062F\u0642\u0627\u0626\u0642',
    hourAgo: '\u0645\u0646\u0630 \u0633\u0627\u0639\u0629',
    hoursAgo: '\u0645\u0646\u0630 {n} \u0633\u0627\u0639\u0627\u062A',
    dayAgo: '\u0645\u0646\u0630 \u064A\u0648\u0645',
    daysAgo: '\u0645\u0646\u0630 {n} \u0623\u064A\u0627\u0645',
    neverSynced: '\u0644\u0645 \u062A\u062A\u0645 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629',
    minAgo: '\u0645\u0646\u0630 {n} \u062F',
    hrsAgo: '\u0645\u0646\u0630 {n} \u0633',
  },
  ru: {
    justNow: '\u0422\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E',
    minuteAgo: '1 \u043C\u0438\u043D\u0443\u0442\u0443 \u043D\u0430\u0437\u0430\u0434',
    minutesAgo: '{n} \u043C\u0438\u043D\u0443\u0442 \u043D\u0430\u0437\u0430\u0434',
    hourAgo: '1 \u0447\u0430\u0441 \u043D\u0430\u0437\u0430\u0434',
    hoursAgo: '{n} \u0447\u0430\u0441\u043E\u0432 \u043D\u0430\u0437\u0430\u0434',
    dayAgo: '1 \u0434\u0435\u043D\u044C \u043D\u0430\u0437\u0430\u0434',
    daysAgo: '{n} \u0434\u043D\u0435\u0439 \u043D\u0430\u0437\u0430\u0434',
    neverSynced: '\u041D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043B\u0441\u044F',
    minAgo: '{n} \u043C\u0438\u043D \u043D\u0430\u0437\u0430\u0434',
    hrsAgo: '{n} \u0447 \u043D\u0430\u0437\u0430\u0434',
  },
}


const getTimeTranslation = (lang, key, n = 0) => {
  const translations = timeTranslations[lang] || timeTranslations.en
  const text = translations[key] || timeTranslations.en[key]
  return text.replace('{n}', n.toString())
}

const getLocale = (lang) => {
  const localeMap = {
    en: 'en-US',
    de: 'de-DE',
    es: 'es-ES',
    fr: 'fr-FR',
    pt: 'pt-BR',
    zh: 'zh-CN',
    hi: 'hi-IN',
    ar: 'ar-SA',
    ru: 'ru-RU',
  }
  return localeMap[lang] || 'en-US'
}

export const formatDate = (date, lang = 'en') => {
  const d = new Date(date)
  const now = new Date()
  const diff = now - d

  if (diff < 60000) {
    return getTimeTranslation(lang, 'justNow')
  }

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return minutes === 1 
      ? getTimeTranslation(lang, 'minuteAgo')
      : getTimeTranslation(lang, 'minutesAgo', minutes)
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return hours === 1
      ? getTimeTranslation(lang, 'hourAgo')
      : getTimeTranslation(lang, 'hoursAgo', hours)
  }

  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return days === 1
      ? getTimeTranslation(lang, 'dayAgo')
      : getTimeTranslation(lang, 'daysAgo', days)
  }

  return d.toLocaleDateString(getLocale(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatSyncTime = (date, lang = 'en') => {
  if (!date) return getTimeTranslation(lang, 'neverSynced')
  
  const d = new Date(date)
  const now = new Date()
  const diff = now - d

  if (diff < 60000) return getTimeTranslation(lang, 'justNow')
  if (diff < 3600000) return getTimeTranslation(lang, 'minAgo', Math.floor(diff / 60000))
  if (diff < 86400000) return getTimeTranslation(lang, 'hrsAgo', Math.floor(diff / 3600000))
  
  return d.toLocaleDateString(getLocale(lang), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const truncateText = (text, maxLength = 100) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

export const htmlToPlainText = (html) => {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

/**
 * Generate a meaningful preview string for specialized note types.
 * Returns null if no special preview is available (fallback to content-based preview).
 */
export const getNoteTypePreview = (note, maxLength = 100) => {
  const data = note.noteData
  if (!data || !note.noteType || note.noteType === 'standard') return null

  switch (note.noteType) {
    case 'todo': {
      const tasks = data.tasks || []
      if (tasks.length === 0) return 'Empty task list'
      const done = tasks.filter(t => t.completed).length
      const firstItems = tasks.slice(0, 3).map(t => `${t.completed ? '\u2713' : '\u25CB'} ${t.text}`).join('  ')
      return truncateText(`${done}/${tasks.length} done \u2022 ${firstItems}`, maxLength)
    }
    case 'shopping': {
      const items = data.items || []
      if (items.length === 0) return 'Empty shopping list'
      const checked = items.filter(i => i.checked).length
      const total = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0)
      const firstItems = items.slice(0, 3).map(i => i.name).join(', ')
      const priceStr = total > 0 ? ` \u2022 $${total.toFixed(2)}` : ''
      return truncateText(`${checked}/${items.length} checked${priceStr} \u2022 ${firstItems}`, maxLength)
    }
    case 'project': {
      const columns = data.columns || []
      const totalTasks = columns.reduce((s, c) => s + (c.tasks?.length || 0), 0)
      if (totalTasks === 0) return 'Empty project board'
      const doneTasks = (columns.find(c => c.id === 'done')?.tasks?.length) || 0
      const pct = Math.round((doneTasks / totalTasks) * 100)
      const columnSummary = columns.filter(c => c.tasks?.length > 0).map(c => `${c.name}: ${c.tasks.length}`).join(', ')
      return truncateText(`${pct}% complete (${doneTasks}/${totalTasks}) \u2022 ${columnSummary}`, maxLength)
    }
    case 'meeting': {
      const parts = []
      if (data.date) parts.push(data.date)
      if (data.startTime) parts.push(data.startTime)
      const attendees = data.attendees || []
      if (attendees.length > 0) parts.push(`${attendees.length} attendees`)
      const agenda = data.agenda || []
      if (agenda.length > 0) parts.push(`${agenda.length} agenda items`)
      const actions = data.actionItems || []
      if (actions.length > 0) parts.push(`${actions.length} actions`)
      return parts.length > 0 ? truncateText(parts.join(' \u2022 '), maxLength) : 'Empty meeting notes'
    }
    case 'journal': {
      const moodEmojis = { 1: '\uD83D\uDE22', 2: '\uD83D\uDE14', 3: '\uD83D\uDE10', 4: '\uD83D\uDE42', 5: '\uD83D\uDE04' }
      const parts = []
      if (data.mood) parts.push(moodEmojis[data.mood] || `Mood: ${data.mood}`)
      const gratitude = (data.gratitude || []).filter(g => g && g.trim())
      if (gratitude.length > 0) parts.push(`${gratitude.length} gratitudes`)
      const highlights = data.highlights || []
      if (highlights.length > 0) parts.push(`${highlights.length} highlights`)
      if (data.freeWrite) parts.push(truncateText(data.freeWrite, 60))
      return parts.length > 0 ? truncateText(parts.join(' \u2022 '), maxLength) : 'Empty journal entry'
    }
    case 'brainstorm': {
      const ideas = data.ideas || []
      if (ideas.length === 0) return 'No ideas yet'
      const firstIdeas = ideas.slice(0, 3).map(i => i.text || i).join(', ')
      return truncateText(`${ideas.length} ideas \u2022 ${firstIdeas}`, maxLength)
    }
    case 'weekly': {
      const days = data.days || {}
      const totalTasks = Object.values(days).reduce((s, d) => s + (d.tasks?.length || 0), 0)
      const doneTasks = Object.values(days).reduce((s, d) => s + (d.tasks?.filter(t => t.completed)?.length || 0), 0)
      const goals = data.weeklyGoals || []
      const parts = []
      if (totalTasks > 0) parts.push(`${doneTasks}/${totalTasks} tasks`)
      if (goals.length > 0) parts.push(`${goals.length} goals`)
      return parts.length > 0 ? truncateText(parts.join(' \u2022 '), maxLength) : 'Empty weekly plan'
    }
    default:
      return null
  }
}

export const generateTagColor = () => {
  const colors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#84cc16',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#a855f7',
    '#ec4899',
    '#f43f5e',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export const onConnectionChange = (callback) => {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

export const createShortcutHandler = (shortcuts) => {
  return (event) => {
    const key = event.key.toLowerCase()
    const ctrl = event.ctrlKey || event.metaKey
    const shift = event.shiftKey
    const alt = event.altKey

    for (const [combo, handler] of Object.entries(shortcuts)) {
      const parts = combo.toLowerCase().split('+')
      const requiresCtrl = parts.includes('ctrl') || parts.includes('cmd')
      const requiresShift = parts.includes('shift')
      const requiresAlt = parts.includes('alt')
      const targetKey = parts[parts.length - 1]

      if (
        ctrl === requiresCtrl &&
        shift === requiresShift &&
        alt === requiresAlt &&
        key === targetKey
      ) {
        event.preventDefault()
        handler(event)
        return
      }
    }
  }
}

/**
 * Detect and repair mojibake (double/triple-encoded UTF-8 text).
 * Common pattern: UTF-8 bytes misinterpreted as Windows-1252, then re-encoded as UTF-8.
 * E.g., \u{1F389} (party popper) becomes "\u00C3\u00B0\u00C5\u00B8\u00C5\u00A1\u00E2\u0082\u00AC" etc.
 */
export const repairMojibake = (text) => {
  if (!text || typeof text !== 'string') return text
  
  // Detect mojibake: look for sequences of C3/C2/C5/E2 Latin characters that form
  // patterns typical of double-encoded UTF-8
  const mojibakePattern = /[\u00C0-\u00C3][\u0080-\u00BF](?:[\u00C0-\u00C5][\u0080-\u00BF]){1,3}/
  if (!mojibakePattern.test(text)) return text
  
  try {
    // Try to repair by converting string chars to bytes and re-decoding as UTF-8
    const bytes = new Uint8Array(text.length)
    let allInRange = true
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (code > 255) {
        allInRange = false
        break
      }
      bytes[i] = code
    }
    
    if (!allInRange) {
      // Text has characters outside Latin-1 range, try partial repair
      return repairMojibakePartial(text)
    }
    
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const repaired = decoder.decode(bytes)
    
    // Verify the repair produced valid-looking text (fewer high-byte sequences)
    const originalHighBytes = (text.match(/[\u0080-\u00FF]/g) || []).length
    const repairedHighBytes = (repaired.match(/[\u0080-\u00FF]/g) || []).length
    
    if (repairedHighBytes < originalHighBytes) {
      // Check if result still has mojibake (triple-encoded) and repair again
      const secondPass = repairMojibake(repaired)
      return secondPass
    }
    
    return text
  } catch {
    return repairMojibakePartial(text)
  }
}

const repairMojibakePartial = (text) => {
  // Common double-encoded sequences mapped to their correct characters
  const replacements = [
    // Common emoji that get double-encoded
    ['\u00C3\u00B0\u00C5\u00B8\u00C5\u00A1\u00E2\u0082\u00AC', '\u{1F680}'],  // \u{1F680}
    ['\u00C3\u00A2\u00C5\u0093\u00C2\u00A8', '\u2728'],  // \u2728
    ['\u00C3\u00A2\u00C5\u0093\u00E2\u0080\u00B0', '\u2728'],  // \u2728 variant
    ['\u00C3\u00B0\u00C5\u00B8\u00C5\u0093\u00E2\u0080\u00B0', '\u{1F389}'],  // \u{1F389}
    ['\u00C3\u00B0\u00C5\u00B8\u00E2\u0080\u0098\u00C5\u00BD', '\u{1F4DD}'],  // \u{1F4DD}
  ]
  
  let result = text
  for (const [broken, correct] of replacements) {
    result = result.split(broken).join(correct)
  }
  return result
}
