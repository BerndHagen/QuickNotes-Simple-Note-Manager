import { expect, test } from '@playwright/test'
import { CREDENTIALS, collectErrors, createNote, signIn } from './helpers'

const writeNoteFromOtherTab = (page, currentTitle, nextTitle) => page.evaluate(
  async ({ currentTitle: title, nextTitle: incomingTitle }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('QuickNotesDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const note = await new Promise((resolve, reject) => {
      const transaction = database.transaction('notes', 'readonly')
      const request = transaction.objectStore('notes').getAll()
      request.onsuccess = () => resolve(request.result.find((candidate) => candidate.title === title))
      request.onerror = () => reject(request.error)
    })
    if (!note) throw new Error(`Could not find ${title}`)
    const incoming = {
      ...note,
      title: incomingTitle,
      updatedAt: new Date(Date.now() + 5_000).toISOString(),
      syncStatus: 'pending',
    }
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('notes', 'readwrite')
      transaction.objectStore('notes').put(incoming)
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()

    const channel = new BroadcastChannel('quicknotes-workspace-v1')
    channel.postMessage({
      version: 1,
      eventId: crypto.randomUUID(),
      sourceId: 'task5-e2e-other-tab',
      ownerId: 'local',
      noteId: note.id,
      record: incoming,
      timestamp: new Date().toISOString(),
    })
    channel.close()
    return note.id
  },
  { currentTitle, nextTitle }
)

test('propagates cross-tab notes and requires review before replacing a stale draft', async ({ page, context }) => {
  const firstErrors = collectErrors(page)
  await signIn(page)
  const second = await context.newPage()
  const secondErrors = collectErrors(second)
  await signIn(second)

  const originalTitle = `Multi-tab source ${Date.now()}`
  await createNote(page, originalTitle)
  await expect(second.getByText(originalTitle, { exact: true }).first()).toBeVisible()
  await second.getByText(originalTitle, { exact: true }).first().click()
  await expect(second.getByLabel('Note title')).toHaveValue(originalTitle)

  const localDraft = 'Unsaved title in second tab'
  await second.getByLabel('Note title').fill(localDraft)
  const incomingTitle = 'Committed title from first tab'
  const noteId = await writeNoteFromOtherTab(page, originalTitle, incomingTitle)

  const conflict = second.getByRole('alert').filter({ hasText: 'changed in another tab' })
  await expect(conflict).toBeVisible()
  await expect(second.getByLabel('Note title')).toHaveValue(localDraft)
  await expect(second.getByLabel('Note title')).toHaveAttribute('readonly', '')

  await conflict.getByRole('button', { name: 'Use incoming' }).click()
  await expect(second.getByLabel('Note title')).toHaveValue(incomingTitle)
  await expect(conflict).toBeHidden()

  const recoveryTitles = await second.evaluate(async (id) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('QuickNotesDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const versions = await new Promise((resolve, reject) => {
      const transaction = database.transaction('noteVersions', 'readonly')
      const request = transaction.objectStore('noteVersions').getAll()
      request.onsuccess = () => resolve(request.result.filter((version) => version.noteId === id))
      request.onerror = () => reject(request.error)
    })
    database.close()
    return versions.map((version) => version.title)
  }, noteId)
  expect(recoveryTitles).toContain(localDraft)
  expect(firstErrors).toEqual([])
  expect(secondErrors).toEqual([])
})

test('closes an outdated database connection and requires reload before further editing', async ({ page }) => {
  await signIn(page)
  const lifecycleEvent = await page.evaluate(async () => {
    let observed = null
    window.addEventListener('quicknotes:database-lifecycle', (event) => {
      observed = event.detail
    }, { once: true })
    const databases = await indexedDB.databases()
    const currentVersion = databases.find((database) => database.name === 'QuickNotesDB')?.version
    if (!currentVersion) throw new Error('QuickNotesDB is not open for the upgrade probe.')
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('QuickNotesDB', currentVersion + 1)
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('The QuickNotes connection did not close for the upgrade.'))
    })
    await new Promise((resolve) => setTimeout(resolve, 100))
    return observed
  })

  expect(lifecycleEvent).toEqual(expect.objectContaining({ type: 'versionchange' }))
  await expect(page.getByRole('heading', { name: 'Reload QuickNotes to continue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload application' })).toBeVisible()
  await expect(page.getByText(/stopped editing so it cannot save through an outdated schema/i)).toBeVisible()
})

test('local workspace sign-out reaches peer tabs without losing their draft', async ({ page, context }) => {
  test.skip(Boolean(CREDENTIALS.email && CREDENTIALS.password), 'This case exercises the browser-only session.')

  const firstErrors = collectErrors(page)
  await signIn(page)
  const second = await context.newPage()
  const secondErrors = collectErrors(second)
  await signIn(second)

  const initialTitle = `Peer sign-out ${Date.now()}`
  await createNote(second, initialTitle)
  const draftTitle = `${initialTitle} retained draft`
  await second.getByLabel('Note title').fill(draftTitle)

  await page.getByRole('button', { name: /saved on this device/i }).click()
  await page.getByRole('menuitem', { name: 'Close workspace' }).click()

  await expect(page.locator('#qn-main')).toBeHidden()
  await expect(second.locator('#qn-main')).toBeHidden()
  await expect(second.getByRole('button', { name: /use a private local workspace/i })).toBeVisible()

  await signIn(second)
  await expect(second.getByText(draftTitle, { exact: true }).first()).toBeVisible()
  expect(firstErrors).toEqual([])
  expect(secondErrors).toEqual([])
})
