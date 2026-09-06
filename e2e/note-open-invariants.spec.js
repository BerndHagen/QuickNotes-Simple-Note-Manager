import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

const readNote = (page, title) => page.evaluate(async (noteTitle) => {
  const request = indexedDB.open('QuickNotesDB')
  const database = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const transaction = database.transaction('notes', 'readonly')
  const query = transaction.objectStore('notes').getAll()
  const notes = await new Promise((resolve, reject) => {
    query.onsuccess = () => resolve(query.result)
    query.onerror = () => reject(query.error)
  })
  database.close()
  const note = notes.find((candidate) => candidate.title === noteTitle)
  return note ? {
    id: note.id,
    updatedAt: note.updatedAt,
    syncStatus: note.syncStatus,
    content: note.content,
    title: note.title,
    noteType: note.noteType,
  } : null
}, title)

test('opening an existing note does not turn navigation into a content edit', async ({ page }) => {
  await signIn(page)
  const title = 'Welcome to QuickNotes'
  const before = await readNote(page, title)
  expect(before).toBeTruthy()

  await page.locator('.note-card', { hasText: title }).click()
  await expect(page.getByLabel('Note title')).toHaveValue(title)
  await page.waitForTimeout(900)

  expect(await readNote(page, title)).toEqual(before)
})
