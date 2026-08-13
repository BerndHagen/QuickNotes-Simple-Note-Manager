import { expect, test } from '@playwright/test'
import { createNote, signIn } from './helpers'

const capture = async (page, testInfo, name) => {
  await page.screenshot({
    path: testInfo.outputPath(name),
    fullPage: true,
  })
}

test.describe('production-critical UX contracts', () => {
  test('registration uses one exact username and rejects case-insensitive duplicates before account creation', async ({ page }, testInfo) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    const registerTab = page.getByRole('button', { name: 'Create account', exact: true }).first()
    test.skip(!(await registerTab.isVisible().catch(() => false)), 'Cloud registration is not configured.')

    await registerTab.click()
    const username = page.getByLabel('Username')
    await username.fill('vAMPYRUSnOCTIS')
    await page.getByLabel('Email address').fill('username-contract@example.invalid')
    await page.getByLabel('Password', { exact: true }).fill('A-professional-test-passphrase-2026!')
    await page.getByLabel('Confirm password').fill('A-professional-test-passphrase-2026!')
    await page.getByLabel(/I agree to the/i).check()
    await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

    await expect(page.getByText('That username is already in use')).toBeVisible()
    await expect(username).toBeFocused()
    await expect(page.getByLabel('First name')).toHaveCount(0)
    await expect(page.getByLabel('Last name')).toHaveCount(0)
    await capture(page, testInfo, 'single-username-registration.png')
  })

  test('an inserted note link selects its exact immutable target without changing the URL', async ({ page, context }, testInfo) => {
    await signIn(page)
    await createNote(page, 'Medio')
    await createNote(page, 'Sonaris')

    await page.getByRole('button', { name: /^more actions$/i }).click()
    await page.getByRole('menuitem', { name: /insert note link/i }).click()
    await page.getByRole('combobox', { name: /search notes/i }).fill('Medio')
    await page.getByRole('option', { name: /Medio/i }).click()

    const link = page.locator('.ProseMirror a.note-link', { hasText: 'Medio' })
    await expect(link).toBeVisible()
    await capture(page, testInfo, 'insert-note-before-click.png')

    const attributes = await link.evaluate((element) => ({
      href: element.getAttribute('href'),
      noteId: element.getAttribute('data-note-id'),
      target: element.getAttribute('target'),
    }))
    const urlBefore = page.url()
    const pageCountBefore = context.pages().length

    await link.click()
    await page.waitForTimeout(250)
    await capture(page, testInfo, 'insert-note-after-click.png')

    expect(attributes.href).toMatch(/^#note\//)
    expect(attributes.noteId).toBeTruthy()
    expect(attributes.target).toBeNull()
    await expect(page.getByLabel('Note title')).toHaveValue('Medio')
    expect(page.url()).toBe(urlBefore)
    expect(context.pages()).toHaveLength(pageCountBefore)
  })

  test('phone grid and list modes have measurably different layouts', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await signIn(page)
    await createNote(page, 'Grid Alpha')
    await page.getByRole('button', { name: /back to notes/i }).click()
    await createNote(page, 'Grid Beta')
    await page.getByRole('button', { name: /back to notes/i }).click()
    await createNote(page, 'Grid Gamma')
    await page.getByRole('button', { name: /back to notes/i }).click()

    await page.getByRole('button', { name: /grid view/i }).click()
    const gridCards = page.locator('main article')
    await expect(gridCards.first()).toBeVisible()
    expect(await gridCards.count()).toBeGreaterThanOrEqual(3)
    await capture(page, testInfo, 'mobile-grid.png')

    const gridGeometry = await gridCards.evaluateAll((cards) => cards.slice(0, 3).map((card) => {
      const rect = card.getBoundingClientRect()
      return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) }
    }))

    expect(gridGeometry[0].top).toBe(gridGeometry[1].top)
    expect(gridGeometry[0].left).not.toBe(gridGeometry[1].left)
    expect(gridGeometry[0].width).toBeLessThan(170)

    await page.getByRole('button', { name: /list view/i }).click()
    const listCards = page.locator('.note-card')
    await expect(listCards.first()).toBeVisible()
    expect(await listCards.count()).toBeGreaterThanOrEqual(3)
    await capture(page, testInfo, 'mobile-list.png')

    const listGeometry = await listCards.evaluateAll((cards) => cards.slice(0, 2).map((card) => {
      const rect = card.getBoundingClientRect()
      return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) }
    }))

    expect(listGeometry[0].left).toBe(listGeometry[1].left)
    expect(listGeometry[0].top).not.toBe(listGeometry[1].top)
    expect(listGeometry[0].width).toBeGreaterThan(300)
  })

  test('editor canvas uses the QuickNotes menu and offers the complete font catalogue', async ({ page }, testInfo) => {
    await signIn(page)
    await createNote(page, 'Editor contract')

    const canvas = page.locator('[data-editor-canvas]')
    const nativeMenuPrevented = await canvas.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.bottom - 24,
      })
      return !element.dispatchEvent(event)
    })

    expect(nativeMenuPrevented).toBe(true)
    await expect(page.getByRole('menu', { name: 'Editor actions' })).toBeVisible()
    await capture(page, testInfo, 'editor-context-menu.png')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /show more formatting tools/i }).click()
    await page.getByRole('button', { name: 'Font', exact: true }).click()
    const fontDialog = page.getByRole('dialog', { name: 'Font families' })
    await expect(fontDialog).toBeVisible()
    await expect(fontDialog.locator('button')).toHaveCount(39)
    await capture(page, testInfo, 'font-catalogue.png')
  })

  test('Export Note is a standard solid action button, not a textured banner', async ({ page }, testInfo) => {
    await signIn(page)
    await createNote(page, 'Export contract')
    await page.getByRole('button', { name: /^more actions$/i }).click()
    await page.getByRole('menuitem', { name: /^export$/i }).click()

    const dialog = page.getByRole('dialog', { name: 'Export notes' })
    const exportButton = dialog.getByRole('button', { name: /export note/i })
    await expect(exportButton).toBeVisible()
    await expect(exportButton).not.toHaveClass(/qn-banner-surface/)
    await expect(dialog.locator('.qn-banner-surface')).toHaveCount(0)
    await expect(dialog.locator('.qn-dialog-header')).toHaveCount(1)
    expect(await exportButton.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none')
    await capture(page, testInfo, 'export-solid-action.png')
  })
})
