import { test, expect } from '@playwright/test'
import { signIn, collectErrors, expectNoHorizontalOverflow, VIEWPORTS } from './helpers'

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('renders without horizontal overflow or console errors', async ({ page }) => {
      const errors = collectErrors(page)
      await signIn(page)
      await expectNoHorizontalOverflow(page)
      expect(errors).toEqual([])
    })

    test('keeps dialog actions reachable inside the viewport', async ({ page }) => {
      await signIn(page)

      // The sidebar is a drawer below 1024px; open it before using it.
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: /show navigation/i }).first().click()
      }
      await page.getByRole('button', { name: /^settings$/i }).first().click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      const box = await dialog.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(-1)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)

      await expectNoHorizontalOverflow(page)
    })
  })
}

test.describe('compact navigation', () => {
  test.use({ viewport: { width: 375, height: 720 } })

  test('shows one pane at a time and navigates between them', async ({ page }) => {
    await signIn(page)

    // The note list is the landing pane; the editor is off-screen.
    await expect(page.getByRole('searchbox')).toBeVisible()

    await page.getByRole('button', { name: /new note/i }).first().click()
    // Creating a note switches to the editor pane, which offers a way back.
    const back = page.getByRole('button', { name: /back to notes/i })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page.getByRole('searchbox')).toBeVisible()
  })

  test('sidebar opens as an overlay drawer and closes after navigating', async ({ page }) => {
    await signIn(page)

    const nav = page.getByRole('navigation', { name: 'Workspace' })
    await page.getByRole('button', { name: /show navigation/i }).first().click()
    await expect(nav.getByRole('button', { name: /^all notes/i })).toBeVisible()

    await nav.getByRole('button', { name: /^favorites/i }).click()
    // Navigating dismisses the drawer so the list is usable again.
    await expect(page.getByRole('searchbox')).toBeVisible()
  })
})

test.describe('large desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('caps editor line length instead of stretching edge to edge', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().click()

    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toBeVisible()
    const box = await editor.boundingBox()
    // Text should stay readable rather than running the full 1920px.
    expect(box.width).toBeLessThan(1400)
  })
})
