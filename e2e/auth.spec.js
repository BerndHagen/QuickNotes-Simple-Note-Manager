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
      await dialog.evaluate(async (element) => {
        await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished))
      })
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

    await expect(page.getByLabel('Username')).toHaveAttribute('placeholder', 'VampyrusNoctis')
    await expect(page.getByLabel('Email address')).toHaveAttribute('placeholder', 'you@example.com')
    await expect(page.getByLabel('Confirm password')).toHaveAttribute(
      'placeholder',
      'Re-enter your password',
    )

    await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

    const username = page.getByLabel('Username')
    await expect(username).toBeFocused()
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alert').first()).toContainText('Username is required')
  })

  test('loads the branded background and presents the three current work surfaces', async ({ page, request }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    const authPage = page.locator('.qn-auth-page')
    const background = await authPage.evaluate((element) => getComputedStyle(element).backgroundImage)
    expect(background).toContain('quicknotes-auth-background.png')

    const assetUrl = new URL('quicknotes-auth-background.png', page.url()).toString()
    const response = await request.get(assetUrl)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('image/png')
    expect((await response.body()).byteLength).toBeGreaterThan(200_000)
    const dimensions = await page.evaluate(async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
      return { width: image.naturalWidth, height: image.naturalHeight }
    }, assetUrl)
    expect(dimensions.width).toBeGreaterThanOrEqual(1_200)
    expect(dimensions.height).toBeGreaterThanOrEqual(1_200)

    const preview = page.locator('.qn-auth-surface-preview')
    await expect(preview).toBeVisible()
    await expect(preview.locator('.qn-auth-surface')).toHaveCount(3)
    await expect(preview.getByText('Document', { exact: true })).toBeVisible()
    await expect(preview.getByText('Paper', { exact: true })).toBeVisible()
    await expect(preview.getByText('Canvas', { exact: true })).toBeVisible()
    await expect(page.locator('.qn-auth-preview')).toHaveCount(0)
  })
})
