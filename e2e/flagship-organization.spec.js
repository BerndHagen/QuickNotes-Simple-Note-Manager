import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { collectErrors, expectNoHorizontalOverflow, signIn } from './helpers'

const violationsText = (violations) =>
  violations.map((violation) => `${violation.id}: ${violation.nodes.length}`).join('\n')

test.describe('flagship organization workflows', () => {
  test('creates, opens, and edits a live Smart View', async ({ page }) => {
    const errors = collectErrors(page)
    await signIn(page)

    await page.getByRole('button', { name: 'New smart view' }).click()
    const dialog = page.getByRole('dialog', { name: 'New smart view' })
    await dialog.getByLabel('Name').fill('Important notes')
    await dialog.getByLabel('Rule 1 field').selectOption('tag')
    await dialog.getByLabel('Rule 1 operator').selectOption('contains')
    await dialog.getByLabel('Rule 1 value').selectOption('important')
    await expect(dialog.getByText(/matching note/)).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(violationsText(violations)).toBe('')

    await dialog.getByRole('button', { name: 'Create view' }).click()
    await expect(page.getByRole('heading', { name: 'Important notes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Important notes', exact: true })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('button', { name: 'Edit Important notes' }).click()
    const editDialog = page.getByRole('dialog', { name: 'Edit smart view' })
    await editDialog.getByLabel('Name').fill('Priority notes')
    await editDialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Priority notes' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('saves a real note as a reusable template and creates from it', async ({ page }) => {
    const errors = collectErrors(page)
    await signIn(page)

    await page.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Save as template' }).click()
    const saveDialog = page.getByRole('dialog', { name: 'Save as template' })
    await saveDialog.getByLabel('Template name').fill('Team handbook')
    await saveDialog.getByLabel('Description').fill('Reusable onboarding reference')
    await saveDialog.getByRole('button', { name: 'Save template' }).click()

    await page.getByRole('button', { name: 'Create workspace' }).click()
    const picker = page.getByRole('dialog', { name: 'New workspace' })
    await picker.getByRole('button', { name: 'My templates' }).click()
    await picker
      .locator('section[aria-label="Workspace types"]')
      .getByRole('button', { name: /Team handbook/i })
      .click()
    await picker.getByLabel('Note title').fill('Onboarding handbook')
    await picker.getByRole('button', { name: 'Create template' }).click()

    await expect(page.getByLabel('Note title')).toHaveValue('Onboarding handbook')
    await expect(page.getByText('Finding your way around')).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe('flagship organization on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the Smart View builder inside the phone viewport', async ({ page }) => {
    await signIn(page)
    await page.locator('.qn-top-chrome').getByRole('button', { name: /show navigation/i }).click()
    await page.getByRole('button', { name: 'New smart view' }).click()
    const dialog = page.getByRole('dialog', { name: 'New smart view' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Rule 1 field')).toBeVisible()
    await page.waitForTimeout(250)

    const box = await dialog.boundingBox()
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(845)
    await expectNoHorizontalOverflow(page)
  })
})
