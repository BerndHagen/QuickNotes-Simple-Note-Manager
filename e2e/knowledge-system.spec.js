import { test, expect } from '@playwright/test'
import { collectErrors, createNote, expectNoHorizontalOverflow, signIn } from './helpers'

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

async function openSearch(page) {
  await page.getByRole('button', { name: 'Search all notes' }).click()
  const dialog = page.getByRole('dialog', { name: /global search/i })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('connected knowledge system', () => {
  test('finds Unicode Document text and typed Canvas objects in one offline search', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const documentTitle = `Knowledge document ${Date.now()}`
    await createNote(page, documentTitle)
    const editor = page.locator('.ProseMirror').first()
    await editor.fill('Zürich façade planning includes the ferrovia milestone.')
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 })

    let search = await openSearch(page)
    await search.getByRole('combobox').fill('zurich facade')
    const documentResult = search.getByRole('option', { name: new RegExp(documentTitle, 'i') })
    await expect(documentResult).toBeVisible({ timeout: 15_000 })
    await expect(documentResult).toContainText('Content')
    await expect(search.getByText('1 result', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('knowledge-search-document-light.png'), fullPage: true })
    await page.keyboard.press('Escape')

    const canvasTitle = `Knowledge canvas ${Date.now()}`
    await createCanvasNote(page, canvasTitle)
    const canvas = page.getByRole('application', { name: /infinite canvas/i })
    const box = await canvas.boundingBox()
    await page.getByRole('button', { name: 'Sticky note' }).click()
    await page.mouse.click(box.x + 180, box.y + 180)
    const sticky = page.getByLabel('Sticky note text')
    await sticky.fill('Harbor telemetry spatial roadmap')
    await sticky.press('Control+Enter')
    await expect(page.getByLabel('Canvas editor').getByText('Saved on this device')).toBeVisible({ timeout: 15_000 })

    search = await openSearch(page)
    await search.getByRole('button', { name: 'Canvas', exact: true }).click()
    await search.getByRole('combobox').fill('harbor telemetry')
    const canvasResult = search.getByRole('option', { name: new RegExp(canvasTitle, 'i') })
    await expect(canvasResult).toBeVisible({ timeout: 15_000 })
    await expect(canvasResult).toContainText('Spatial object')
    await expect(search.getByText('1 result', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('knowledge-search-canvas-light.png'), fullPage: true })

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(search).toBeVisible()
    await expect.poll(() => search.evaluate((element) => element.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(0)
    await expect.poll(() => search.evaluate((element) => element.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(845)
    await expect(canvasResult).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('knowledge-search-mobile.png'), fullPage: true })
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: /^settings$/i }).first().click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await settings.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await settings.getByRole('button', { name: /close settings/i }).click()
    search = await openSearch(page)
    await search.getByRole('combobox').fill('harbor telemetry')
    await expect(search.getByRole('option', { name: new RegExp(canvasTitle, 'i') })).toBeVisible({ timeout: 15_000 })
    await expect(search.getByText('1 result', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('knowledge-search-desktop-dark.png'), fullPage: true })

    expect(errors).toEqual([])
  })

  test('keeps heading identities stable and derives forward links, backlinks, and history', async ({ page }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const targetTitle = `Linked target ${Date.now()}`
    const headingText = `Stable section ${Date.now()}`
    await createNote(page, targetTitle)
    const targetEditor = page.locator('.ProseMirror').first()
    await targetEditor.click()
    await targetEditor.press('Control+Alt+1')
    await targetEditor.pressSequentially(headingText)
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 })
    const heading = targetEditor.locator('h1', { hasText: headingText })
    await expect(heading).toHaveAttribute('data-anchor-id', /.+/)
    const anchorId = await heading.getAttribute('data-anchor-id')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('.ProseMirror h1', { hasText: headingText })).toHaveAttribute('data-anchor-id', anchorId)

    const sourceTitle = `Linked source ${Date.now()}`
    await createNote(page, sourceTitle)
    await page.getByRole('button', { name: /^more actions$/i }).click()
    await page.getByRole('menuitem', { name: /insert note link/i }).click()
    const linkSearch = page.getByRole('combobox', { name: /search notes/i })
    await linkSearch.fill(headingText)
    const headingOption = page.getByRole('option').filter({ hasText: `› ${headingText}` })
    await expect(headingOption).toBeVisible({ timeout: 15_000 })
    await headingOption.click()

    const internalLink = page.locator('.ProseMirror a.note-link', { hasText: headingText })
    await expect(internalLink).toHaveAttribute('data-note-anchor-id', anchorId)
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Show inspector' }).click()
    const inspector = page.getByLabel('Inspector')
    await inspector.getByRole('tab', { name: 'Links' }).click()
    await expect(inspector.getByRole('button', { name: new RegExp(targetTitle, 'i') })).toBeVisible({ timeout: 15_000 })

    await internalLink.click()
    await expect(page.getByLabel('Note title')).toHaveValue(targetTitle)
    await expect(page.getByRole('button', { name: 'Previous note' })).toBeEnabled()
    await expect(inspector.getByRole('button', { name: new RegExp(sourceTitle, 'i') })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Previous note' }).click()
    await expect(page.getByLabel('Note title')).toHaveValue(sourceTitle)
    await expect(page.getByRole('button', { name: 'Next note' })).toBeEnabled()
    expect(errors).toEqual([])
  })
})
