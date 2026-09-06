import { test, expect } from '@playwright/test'
import { collectErrors, signIn } from './helpers'

async function createCanvasNote(page, title) {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: /^Canvas/i })
    .click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await expect(page.getByRole('application', { name: /infinite canvas/i })).toBeVisible()
}

test.describe('Task 4 local image recognition', () => {
  test('runs real local OCR, preserves a correction, indexes it, and navigates to the image', async ({ page }, testInfo) => {
    test.setTimeout(150_000)
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    const title = `OCR canvas ${Date.now()}`
    await createCanvasNote(page, title)

    await page.evaluate(() => {
      const sample = document.createElement('div')
      sample.id = 'ocr-source-sample'
      sample.textContent = 'QUICKNOTES INVOICE 4287'
      Object.assign(sample.style, {
        position: 'fixed',
        inset: '40px auto auto 40px',
        zIndex: '99999',
        width: '900px',
        padding: '80px 40px',
        color: '#000',
        background: '#fff',
        font: '700 72px Arial, sans-serif',
        letterSpacing: '2px',
      })
      document.body.appendChild(sample)
    })
    const image = await page.locator('#ocr-source-sample').screenshot()
    await page.locator('#ocr-source-sample').evaluate((element) => element.remove())
    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
      name: 'invoice.png',
      mimeType: 'image/png',
      buffer: image,
    })

    const ocrButton = page.getByRole('button', { name: 'OCR', exact: true })
    await expect(ocrButton).toBeVisible()
    await ocrButton.click()
    const dialog = page.getByRole('dialog', { name: /recognize image text/i })
    await expect(dialog.getByText('Processing: Local')).toBeVisible()
    await expect(dialog.getByText(/handwriting is not supported/i)).toBeVisible()
    await dialog.getByRole('button', { name: 'Recognize text' }).click()
    const recognized = dialog.getByLabel('Recognized text')
    await expect(recognized).toHaveValue(/QUICKNOTES/i, { timeout: 120_000 })

    await recognized.fill('QuickNotes invoice 4287 — verified')
    await dialog.getByRole('button', { name: 'Save correction' }).click()
    await expect(dialog.getByText('User corrected')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('local-image-ocr-review.png'), fullPage: true })

    await dialog.getByRole('button', { name: 'Create task' }).click()
    const taskDialog = page.getByRole('dialog', { name: /create task from recognized text/i })
    await taskDialog.getByRole('textbox', { name: 'Task', exact: true }).fill('Review invoice 4287')
    await taskDialog.getByLabel('Destination').selectOption('__new__')
    await taskDialog.getByRole('button', { name: 'Create task', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Task workspace' })).toHaveValue('Captured tasks')
    await page.getByRole('button', { name: /My Tasks/ }).click()
    const tasks = page.getByRole('dialog', { name: 'My Tasks' })
    await tasks.getByRole('button', { name: 'Open original capture for Review invoice 4287' }).click()
    await expect(page.getByRole('button', { name: 'Resize selected object' })).toBeVisible()

    await page.keyboard.press('Control+k')
    const search = page.getByRole('dialog', { name: /global search/i })
    await search.getByRole('combobox').fill('invoice 4287 verified')
    const result = search.getByRole('option', { name: new RegExp(title, 'i') })
    await expect(result).toBeVisible({ timeout: 15_000 })
    await expect(result).toContainText('Recognized text')
    await result.click()
    await expect(page.getByRole('button', { name: 'Resize selected object' })).toBeVisible()

    expect(errors).toEqual([])
  })
})
