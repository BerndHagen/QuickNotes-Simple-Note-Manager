import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expectNoHorizontalOverflow, signIn } from './helpers'

const violationsText = (violations) =>
  violations.map((violation) => `${violation.id}: ${violation.nodes.length}`).join('\n')

async function openSettings(page) {
  await page.getByRole('button', { name: /^settings$/i }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('recognition privacy is explicit, persistent, responsive, and accessible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  let settings = await openSettings(page)
  await settings.getByRole('button', { name: 'Recognition', exact: true }).click()

  const localOnly = settings.getByRole('radio', { name: 'Local only', exact: true })
  const externalAllowed = settings.getByRole('radio', { name: 'External', exact: true })
  await expect(localOnly).toHaveAttribute('aria-checked', 'true')
  await externalAllowed.click()
  await expect(externalAllowed).toHaveAttribute('aria-checked', 'true')
  await expect(settings.getByText(/each transfer still requires a separate confirmation/i)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('recognition-privacy-light.png'), fullPage: true })

  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(violationsText(violations)).toBe('')

  await expect(page.getByText('Recognition privacy setting saved', { exact: true })).toBeHidden({ timeout: 6_000 })
  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('recognition-privacy-mobile.png'), fullPage: true })
  await settings.getByRole('button', { name: /close settings/i }).click()

  await page.setViewportSize({ width: 1440, height: 900 })
  settings = await openSettings(page)
  await settings.getByRole('button', { name: 'General', exact: true }).click()
  await settings.getByRole('button', { name: 'Dark', exact: true }).click()
  await settings.getByRole('button', { name: 'Recognition', exact: true }).click()
  await expect(settings.getByRole('radio', { name: 'External', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.screenshot({ path: testInfo.outputPath('recognition-privacy-dark.png'), fullPage: true })

  // Leave this isolated test workspace on the privacy-preserving default.
  await settings.getByRole('radio', { name: 'Local only', exact: true }).click()
  await expect(settings.getByRole('radio', { name: 'Local only', exact: true })).toHaveAttribute('aria-checked', 'true')
})
