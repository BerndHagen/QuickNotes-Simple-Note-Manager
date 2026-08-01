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

      if (viewport.width < 1024) {
        await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
      }
      const dialog = page.getByRole('dialog', { name: 'Settings' })
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

test.describe('small-screen settings', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('keeps every settings section and control horizontally reachable', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /show navigation/i }).first().click()
    await page.getByRole('button', { name: /^settings$/i }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Settings' })
    const sections = dialog.getByRole('navigation', { name: 'Settings sections' })
    const sectionButtons = sections.getByRole('button')
    const sectionCount = await sectionButtons.count()

    expect(sectionCount).toBeGreaterThan(4)

    for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
      const sectionButton = sectionButtons.nth(sectionIndex)
      const sectionName = (await sectionButton.innerText()).trim()
      await sectionButton.click()
      await expect(sectionButton).toHaveAttribute('aria-current', 'page')

      const pane = dialog.locator('[data-settings-pane]')
      const paneMetrics = await pane.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      expect(
        paneMetrics.scrollWidth,
        `${sectionName} settings pane hides content beyond its ${paneMetrics.clientWidth}px width`
      ).toBeLessThanOrEqual(paneMetrics.clientWidth + 1)

      const controls = pane.locator('button, input, select, textarea, a[href]')
      const controlCount = await controls.count()
      for (let controlIndex = 0; controlIndex < controlCount; controlIndex += 1) {
        const control = controls.nth(controlIndex)
        if (!(await control.isVisible())) continue

        await control.scrollIntoViewIfNeeded()
        const [controlBox, paneBox] = await Promise.all([control.boundingBox(), pane.boundingBox()])
        expect(controlBox, `${sectionName} contains a control without a rendered box`).not.toBeNull()
        expect(paneBox).not.toBeNull()
        expect(controlBox.x, `${sectionName} contains a control clipped on the left`).toBeGreaterThanOrEqual(
          paneBox.x - 1
        )
        expect(
          controlBox.x + controlBox.width,
          `${sectionName} contains a control clipped on the right`
        ).toBeLessThanOrEqual(paneBox.x + paneBox.width + 1)
      }
    }

    await expectNoHorizontalOverflow(page)
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
