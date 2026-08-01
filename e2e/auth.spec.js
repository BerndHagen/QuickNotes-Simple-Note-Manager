import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('authentication entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' })
  })

  test('legal and help surfaces load on demand and restore focus', async ({ page }) => {
    const surfaces = [
      { trigger: 'Help', title: 'Help & Support' },
      { trigger: 'Privacy', title: 'Privacy Policy' },
      { trigger: 'Terms', title: 'Terms of Service' },
    ]

    for (const surface of surfaces) {
      const trigger = page
        .getByRole('navigation', { name: 'Legal and support' })
        .getByRole('button', { name: surface.trigger, exact: true })
      await trigger.click()

      const dialog = page.getByRole('dialog', { name: surface.title })
      await expect(dialog).toBeVisible()
      const { violations } = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(violations).toEqual([])

      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }
  })

  test('invalid registration moves focus to the first field that needs attention', async ({ page }) => {
    const registerTab = page.getByRole('button', { name: 'Create account', exact: true }).first()
    test.skip(!(await registerTab.isVisible().catch(() => false)), 'Cloud registration is not configured.')

    await registerTab.click()
    await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

    const firstName = page.getByLabel('First name')
    await expect(firstName).toBeFocused()
    await expect(firstName).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alert').first()).toContainText('First name is required')
  })
})
