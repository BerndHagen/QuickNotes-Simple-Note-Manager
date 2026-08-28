import { test, expect } from '@playwright/test'
import { jsPDF } from 'jspdf'
import { collectErrors, createNote, expectNoHorizontalOverflow, signIn } from './helpers'

const createTextPdf = () => {
  const document = new jsPDF()
  document.setFontSize(18)
  document.text('QuickNotes contract 7391', 20, 30)
  document.setFontSize(12)
  document.text('Deployment approval is scheduled for Friday.', 20, 48)
  document.addPage()
  document.text('Second page reference 8820', 20, 30)
  return Buffer.from(document.output('arraybuffer'))
}

async function openResources(page) {
  const direct = page.getByRole('button', { name: 'Attachments and recordings' }).first()
  if (await direct.isVisible().catch(() => false)) await direct.click()
  else {
    await page.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Attachments and recordings' }).click()
  }
  const dialog = page.getByRole('dialog', { name: /attachments and recordings/i })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('Task 4 PDF capture', () => {
  test('extracts native PDF text locally, indexes it, and returns to the source page', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    const title = `PDF source ${Date.now()}`
    await createNote(page, title)

    let dialog = await openResources(page)
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'deployment-contract.pdf',
      mimeType: 'application/pdf',
      buffer: createTextPdf(),
    })
    await expect(dialog.getByText('deployment-contract.pdf')).toBeVisible()
    await expect(dialog.getByLabel('PDF page 1')).toBeVisible({ timeout: 30_000 })
    await expect(dialog.getByText('Processing: Local')).toBeVisible()
    await dialog.getByRole('button', { name: 'Extract searchable text' }).click()
    const pageText = dialog.getByLabel('Recognized text for PDF page 1')
    await expect(pageText).toHaveValue(/QuickNotes contract 7391/i, { timeout: 60_000 })
    await page.screenshot({ path: testInfo.outputPath('pdf-capture-desktop-light.png'), fullPage: true })

    await pageText.selectText()
    await dialog.getByRole('button', { name: 'Create task' }).click()
    const taskDialog = page.getByRole('dialog', { name: /create task from recognized text/i })
    await expect(taskDialog.getByText('Source: PDF page 1')).toBeVisible()
    await taskDialog.getByRole('textbox', { name: 'Task', exact: true }).fill('Approve deployment contract')
    await taskDialog.getByLabel('Destination').selectOption('__new__')
    await expect(taskDialog.getByRole('button', { name: 'Create task', exact: true })).toBeEnabled()
    await expect(page.getByText('PDF attached', { exact: true })).toBeHidden({ timeout: 6_000 })
    await page.screenshot({ path: testInfo.outputPath('recognized-task-review.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(taskDialog).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('recognized-task-review-mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await taskDialog.getByRole('button', { name: 'Create task', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Task workspace' })).toHaveValue('Captured tasks')

    await page.getByRole('button', { name: /My Tasks/ }).click()
    const tasks = page.getByRole('dialog', { name: 'My Tasks' })
    await expect(tasks.getByText('Approve deployment contract', { exact: true })).toBeVisible()
    await tasks.getByRole('button', { name: 'Open original capture for Approve deployment contract' }).click()
    dialog = page.getByRole('dialog', { name: /attachments and recordings/i })
    await expect(dialog.getByLabel('Recognized text for PDF page 1')).toHaveValue(/contract 7391/i)
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('heading', { name: title, exact: true }).click()
    await expect(page.getByLabel('Note title')).toHaveValue(title)
    dialog = await openResources(page)
    await expect(dialog.getByText('deployment-contract.pdf')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('pdf-capture-mobile-light.png'), fullPage: true })
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'Search all notes' }).click()
    const search = page.getByRole('dialog', { name: /global search/i })
    await search.getByRole('combobox').fill('contract 7391')
    const result = search.getByRole('option', { name: new RegExp(title, 'i') })
    await expect(result).toBeVisible({ timeout: 15_000 })
    await expect(result).toContainText('Recognized text')
    await result.click()

    dialog = page.getByRole('dialog', { name: /attachments and recordings/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Recognized text for PDF page 1')).toHaveValue(/contract 7391/i)
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()

    await page.getByRole('button', { name: /^settings$/i }).first().click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await settings.getByRole('button', { name: 'Dark', exact: true }).click()
    await settings.getByRole('button', { name: /close settings/i }).click()
    await expect(page.getByRole('status', { name: 'Loading your workspace' })).toBeHidden({ timeout: 30_000 })
    dialog = await openResources(page)
    await expect(dialog.getByText('deployment-contract.pdf')).toBeVisible()
    await dialog.getByRole('button', { name: 'Create task' }).click()
    const darkTaskDialog = page.getByRole('dialog', { name: /create task from recognized text/i })
    await expect(darkTaskDialog).toBeVisible()
    await expect(page.getByRole('status', { name: 'Loading your workspace' })).toBeHidden({ timeout: 30_000 })
    await page.screenshot({ path: testInfo.outputPath('recognized-task-review-dark.png'), fullPage: true })
    await darkTaskDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.screenshot({ path: testInfo.outputPath('pdf-capture-desktop-dark.png'), fullPage: true })

    expect(errors).toEqual([])
  })
})
