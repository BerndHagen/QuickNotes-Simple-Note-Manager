import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { collectErrors, expectNoHorizontalOverflow, signIn } from './helpers'

const violationsText = (violations) => violations.map((violation) => `${violation.id}: ${violation.nodes.length}`).join('\n')

async function createMeeting(page, title) {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: /^Meeting Workspace/i })
    .click()
  await dialog.getByText('Blank meeting', { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create meeting/i }).click()
  await expect(page.locator('.qn-type-meeting')).toBeVisible()
}

async function seedExistingTranscript(page, title) {
  await page.evaluate(async ({ meetingTitle }) => {
    const request = indexedDB.open('QuickNotesDB')
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const read = database.transaction(['notes', 'resources'], 'readonly')
    const requestValue = (value) => new Promise((resolve, reject) => {
      value.onsuccess = () => resolve(value.result)
      value.onerror = () => reject(value.error)
    })
    const [notes, resources] = await Promise.all([
      requestValue(read.objectStore('notes').getAll()),
      requestValue(read.objectStore('resources').getAll()),
    ])
    const note = notes.find((row) => row.title === meetingTitle)
    const resource = resources.find((row) => row.kind === 'audio' && row.fileName === 'meeting-audio.wav')
    if (!note || !resource) throw new Error('The test meeting source was not persisted.')
    const now = new Date().toISOString()
    const write = database.transaction('recognizedContent', 'readwrite')
    write.objectStore('recognizedContent').put({
      id: 'existing-meeting-transcript-segment',
      ownerId: resource.ownerId,
      noteId: note.id,
      schemaVersion: 1,
      sourceKind: 'audio',
      sourceResourceId: resource.id,
      sourceObjectIds: [],
      sourcePageId: null,
      sourcePageNumber: null,
      sourceRegion: null,
      sourceTimeRange: { startMs: 4_000, endMs: 9_000 },
      type: 'transcript',
      machineText: 'Send the reviewed summary to Alex.',
      text: 'Send the reviewed summary to Alex.',
      confidence: 0.96,
      providerId: 'imported-existing-transcript',
      modelId: 'existing-source',
      modelVersion: '1',
      processingLocation: 'local',
      language: 'en',
      sourceFingerprint: resource.checksum,
      status: 'current',
      userEdited: false,
      editedAt: null,
      createdAt: now,
      generatedAt: now,
      updatedAt: now,
    })
    await new Promise((resolve, reject) => {
      write.oncomplete = resolve
      write.onerror = () => reject(write.error)
      write.onabort = () => reject(write.error)
    })
    database.close()
  }, { meetingTitle: title })
}

test('Meeting capture turns reviewed transcript text into source-linked actions, decisions, and reminders', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  const title = `Task 4 meeting ${Date.now()}`
  await createMeeting(page, title)

  const editor = page.locator('.qn-type-meeting')
  await editor.getByRole('tab', { name: /^Capture/i }).click()
  await expect(editor.getByText('Meeting capture', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Record or attach' }).click()
  let resources = page.getByRole('dialog', { name: 'Attachments and recordings' })
  await resources.locator('input[type="file"]').setInputFiles({
    name: 'meeting-audio.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF0000WAVEfmt data'),
  })
  await expect(resources.getByRole('heading', { name: 'meeting-audio.wav' })).toBeVisible()
  await seedExistingTranscript(page, title)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('#qn-main')).toBeVisible()
  const meetingRow = page.getByRole('button', { name: new RegExp(title) }).first()
  if (await meetingRow.isVisible().catch(() => false)) await meetingRow.click()
  await expect(page.locator('.qn-type-meeting')).toBeVisible()
  await page.locator('.qn-type-meeting').getByRole('tab', { name: /^Capture/i }).click()
  await page.locator('.qn-type-meeting').getByRole('button', { name: 'Open recordings' }).click()
  resources = page.getByRole('dialog', { name: 'Attachments and recordings' })
  await expect(resources.getByLabel('Selected transcript segment')).toHaveValue('Send the reviewed summary to Alex.')

  await resources.getByRole('button', { name: 'Add action item' }).click()
  const task = page.getByRole('dialog', { name: 'Create task from recognized text' })
  await expect(task.getByLabel('Destination')).toHaveValue('__meeting_actions__')
  await task.getByRole('button', { name: 'Add action item' }).click()
  await resources.getByRole('button', { name: 'Add decision' }).click()
  await resources.getByRole('button', { name: 'Close', exact: true }).click()

  await editor.getByRole('tab', { name: /^Action Items/i }).click()
  await expect(editor.getByText('Send the reviewed summary to Alex.', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Set reminder for Send the reviewed summary to Alex.' }).click()
  const reminders = page.getByRole('dialog', { name: 'Reminders' })
  await reminders.getByLabel('Date').fill('2099-03-04')
  await reminders.getByLabel('Time').fill('09:30')
  await reminders.getByRole('button', { name: 'Add Reminder' }).click()
  await expect(reminders.getByText('Send the reviewed summary to Alex.', { exact: true }).first()).toBeVisible()
  await page.keyboard.press('Escape')

  await editor.getByRole('tab', { name: /^Decisions/i }).click()
  await expect(editor.getByText('Send the reviewed summary to Alex.', { exact: true })).toBeVisible()
  await expect(editor.getByRole('button', { name: /open transcript source for decision/i })).toBeVisible()
  await expect(page.getByText('Meeting action item added with its capture source', { exact: true })).toBeHidden({ timeout: 7_000 })
  await expect(page.getByText('Meeting decision added with its transcript source', { exact: true })).toBeHidden({ timeout: 7_000 })
  await page.screenshot({ path: testInfo.outputPath('meeting-workflow-light.png'), fullPage: true })

  const { violations } = await new AxeBuilder({ page }).include('.qn-type-meeting').withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(violationsText(violations)).toBe('')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: new RegExp(title) }).first().click()
  await editor.getByRole('tab', { name: /^Capture/i }).click()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('meeting-workflow-compact.png'), fullPage: true })

  await page.evaluate(() => localStorage.setItem('quicknotes-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 })))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: new RegExp(title) }).first().click()
  await page.locator('.qn-type-meeting').getByRole('tab', { name: /^Capture/i }).click()
  await page.screenshot({ path: testInfo.outputPath('meeting-workflow-dark.png'), fullPage: true })

  expect(errors).toEqual([])
})
