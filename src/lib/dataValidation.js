/**
 * Field limits and normalization shared by the UI and the sync layer.
 *
 * The lengths mirror the CHECK constraints in `supabase/migrations`, so a value
 * accepted here cannot be rejected by the database on upload.
 */

export const MAX_NOTE_TITLE_LENGTH = 500
export const MAX_FOLDER_NAME_LENGTH = 60
export const MAX_TAG_NAME_LENGTH = 60

export const limitNoteTitle = (value, fallback = 'New Note') => {
  const title = typeof value === 'string' ? value : ''
  return (title || fallback).slice(0, MAX_NOTE_TITLE_LENGTH)
}

export const validateFolderName = (value, folders = [], currentId = null) => {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new Error('Folder name is required')
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    throw new Error(`Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer`)
  }
  if (
    folders.some(
      (folder) =>
        folder.id !== currentId &&
        folder.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error('A folder with this name already exists')
  }
  return name
}

export const normalizeTagName = (value) => {
  const name = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!name) throw new Error('Tag name is required')
  if (name.length > MAX_TAG_NAME_LENGTH) {
    throw new Error(`Tag name must be ${MAX_TAG_NAME_LENGTH} characters or fewer`)
  }
  return name
}
