const dateKey = (date = new Date()) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  return [
    safeDate.getFullYear(),
    String(safeDate.getMonth() + 1).padStart(2, '0'),
    String(safeDate.getDate()).padStart(2, '0'),
  ].join('-')
}

export const findDailyNote = (notes, date = new Date()) => {
  const target = dateKey(date)
  return (Array.isArray(notes) ? notes : []).find((note) =>
    note?.noteType === 'journal' &&
    note.noteData?.date === target &&
    !note.deleted &&
    !note.archived
  ) || null
}

export const createDailyNoteInput = (date = new Date(), defaultData = {}, locale) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(safeDate)
  return {
    title: formatted,
    noteType: 'journal',
    // Daily notes are a workspace-level stream. Creating one while the user is
    // browsing a folder must not silently bury it in that folder.
    folderId: null,
    noteData: {
      ...defaultData,
      date: dateKey(safeDate),
      dailyNote: true,
    },
  }
}

export const getDailyNoteDateKey = dateKey
