import { expect, test } from '@playwright/test'
import { createNote, signIn } from './helpers'

const capture = async (page, testInfo, name) => {
  await page.screenshot({
    path: testInfo.outputPath(name),
    fullPage: true,
  })
}

test.describe('production-critical UX contracts', () => {
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
})
