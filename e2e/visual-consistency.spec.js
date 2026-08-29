import { expect, test } from '@playwright/test'
import { createNote, expectNoHorizontalOverflow, signIn } from './helpers'

const capture = (page, testInfo, name) =>
  page.screenshot({ path: testInfo.outputPath(name), fullPage: true })

test.describe('visual consistency release checks', () => {
  test('Focus Mode is a dedicated writing surface at large, desktop, and compact widths', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await signIn(page)
    await createNote(page, 'Focus presentation audit')
    await page.locator('.ProseMirror').fill('A focused document with enough text to verify the writing surface and its session metrics.')

    await page.getByRole('button', { name: /^more actions$/i }).click()
    await page.getByRole('menuitem', { name: 'Focus mode', exact: true }).click()

    const focus = page.getByRole('dialog', { name: 'Focus presentation audit' })
    await expect(focus).toBeVisible()
    await expect(focus.locator('[data-editor-presentation="focus"]')).toBeVisible()
    await expect(focus.locator('#qn-editor-toolbar')).toHaveCount(0)
    await expect(focus.getByLabel('Paper theme')).toHaveValue('minimal')
    await expect(focus.getByLabel('Ambient sound')).toHaveValue('none')

    const pageWidth = await focus.locator('[data-editor-page]').evaluate((element) => element.getBoundingClientRect().width)
    expect(pageWidth).toBeGreaterThan(620)
    expect(pageWidth).toBeLessThanOrEqual(780)
    await capture(page, testInfo, 'focus-large-light.png')

    await page.setViewportSize({ width: 1280, height: 800 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'focus-desktop-light.png')

    await focus.getByLabel('Paper theme').selectOption('night')
    const firstOption = focus.getByLabel('Paper theme').locator('option').first()
    const optionColours = await firstOption.evaluate((element) => {
      const styles = getComputedStyle(element)
      return { background: styles.backgroundColor, color: styles.color }
    })
    expect(optionColours.background).not.toBe(optionColours.color)
    await capture(page, testInfo, 'focus-desktop-night.png')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await expect(focus.getByLabel('Paper theme')).toBeVisible()
    await expect(focus.getByLabel('Ambient sound')).toBeVisible()
    await expect(focus.getByRole('button', { name: 'Exit focus mode' })).toBeVisible()
    await capture(page, testInfo, 'focus-compact-night.png')
  })

  test('Settings uses consistent section, control, account, and statistics treatments', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    await page.getByRole('button', { name: /^settings$/i }).first().click()

    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    await expect(settings.locator('.qn-dialog-header').locator('.rounded-xl, .rounded-2xl')).toHaveCount(0)
    await capture(page, testInfo, 'settings-general-light.png')

    await settings.getByRole('button', { name: 'Account', exact: true }).click()
    await expect(settings.getByText('Saved privately on this device')).toBeVisible()
    await capture(page, testInfo, 'settings-account-light.png')

    const syncSection = settings.getByRole('button', { name: 'Sync', exact: true })
    if (await syncSection.count()) {
      await syncSection.click()
      const statistics = settings.locator('dl')
      await expect(statistics).toBeVisible()
      await expect(statistics.locator('dd')).toHaveCount(3)
      await capture(page, testInfo, 'settings-sync-light.png')
    }

    await settings.getByRole('button', { name: 'General', exact: true }).click()
    await settings.getByRole('button', { name: 'Dark', exact: true }).click()
    await page.waitForTimeout(200)
    await settings.getByRole('button', { name: 'Account', exact: true }).click()
    await capture(page, testInfo, 'settings-account-dark.png')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await expect(settings.getByRole('navigation', { name: 'Settings sections' })).toBeVisible()
    await capture(page, testInfo, 'settings-account-compact-dark.png')
  })
})
