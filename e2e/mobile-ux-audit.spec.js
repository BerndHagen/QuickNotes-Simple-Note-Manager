import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow, signIn } from './helpers'

const openNavigation = async (page) => {
  await page.getByRole('button', { name: /show navigation/i }).first().tap()
  return page.getByRole('dialog', { name: 'Navigation' })
}

test.describe('mobile UX regressions', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true })

  test('renders every shared icon control as an exact square', async ({ page }) => {
    await signIn(page)

    const newNote = page.getByRole('button', { name: /^new note$/i })
    const box = await newNote.boundingBox()
    expect(box.width).toBe(44)
    expect(box.height).toBe(44)

    const controls = await page.locator('.qn-square-control:visible').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          name: element.getAttribute('aria-label') || element.getAttribute('title'),
          width: rect.width,
          height: rect.height,
        }
      })
    )
    for (const control of controls) {
      expect(control.width, `${control.name} width`).toBe(control.height)
    }
  })

  test('keeps Help and Support scrollable in a short phone viewport', async ({ page }) => {
    await signIn(page)
    const navigation = await openNavigation(page)
    await navigation.getByRole('button', { name: /help.*support/i }).tap()

    const dialog = page.getByRole('dialog', { name: /help/i })
    const body = dialog.locator('[data-dialog-body]')
    const metrics = await body.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }))
    expect(metrics.overflowY).toBe('auto')
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)

    await body.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop + element.clientHeight))
      .toBeGreaterThanOrEqual(metrics.scrollHeight - 1)
    await expect(dialog.getByText(/QuickNotes v/i)).toBeVisible()
  })

  test('shows complete settings labels and readable device shortcuts', async ({ page }) => {
    await signIn(page)
    let navigation = await openNavigation(page)
    await navigation.getByRole('button', { name: /^settings$/i }).tap()

    const settings = page.getByRole('dialog', { name: 'Settings' })
    const tabs = settings.getByRole('navigation', { name: 'Settings sections' }).getByRole('button')
    for (const tab of await tabs.all()) {
      const label = (await tab.textContent()).trim()
      expect(label).not.toMatch(/^[A-Z]\.$/)
      const clipped = await tab.locator('span').evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1
      )
      expect(clipped, `${label} is visually shortened`).toBe(false)
    }
    await settings.getByRole('button', { name: /close settings/i }).tap()
    navigation = await openNavigation(page)
    await navigation.getByRole('button', { name: /keyboard shortcuts/i }).tap()
    const shortcutDialog = page.getByRole('dialog', { name: /shortcuts/i })
    const newNoteShortcut = shortcutDialog.getByRole('button', {
      name: /change shortcut for new quick note/i,
    })
    await expect(newNoteShortcut).toBeVisible()
    await expect(newNoteShortcut).toContainText(/(?:Command|Ctrl) \+ N/i)
    await expect(shortcutDialog).not.toContainText(/[⌘⌥⇧]/)
    await expectNoHorizontalOverflow(page)
  })
})
