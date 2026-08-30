import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expectNoHorizontalOverflow, signIn } from './helpers'

const violationsText = (violations) =>
  violations.map((violation) => `${violation.id}: ${violation.nodes.length}`).join('\n')

test.describe('daily workspace workflows', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('Today reopens one journal instead of creating duplicates', async ({ page }) => {
    const allNotes = page.getByRole('button', { name: /All Notes/ })
    const today = page.getByRole('button', { name: 'Today', exact: true })
    const initialText = await allNotes.textContent()

    await today.click()
    await expect(page.getByRole('textbox', { name: 'Journal workspace' })).toHaveValue(/.+/)
    const afterCreateText = await allNotes.textContent()
    expect(afterCreateText).not.toBe(initialText)

    await today.click()
    await expect(allNotes).toHaveText(afterCreateText)
    await expect(today).toHaveAttribute('aria-current', 'page')
  })

  test('task center aggregates and updates document checkboxes', async ({ page }) => {
    await page.getByRole('button', { name: /My Tasks/ }).click()
    const dialog = page.getByRole('dialog', { name: 'My Tasks' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('listitem')).toHaveCount(5)

    await dialog.getByRole('button', {
      name: 'Complete Create a task list from Workspaces and add three things you owe someone',
    }).click()
    await expect(dialog.getByRole('listitem')).toHaveCount(4)

    await dialog.getByRole('button', { name: 'Completed', exact: true }).click()
    await expect(dialog.getByRole('listitem')).toHaveCount(1)
    await expect(dialog.getByText('Create a task list from Workspaces and add three things you owe someone')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(violationsText(violations)).toBe('')
  })

  test('does not suppress the browser context menu across the application', async ({ page }) => {
    await page.getByRole('heading', { name: 'Welcome to QuickNotes' }).click()
    const allowed = await page.getByLabel('Note title').evaluate((element) =>
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    )
    expect(allowed).toBe(true)
  })

  test('recurring task settings create the next occurrence without erasing history', async ({ page }) => {
    await page.getByRole('button', { name: 'Create workspace' }).click()
    const picker = page.getByRole('dialog', { name: /new workspace/i })
    await picker
      .locator('section[aria-label="Workspace types"]')
      .getByRole('button', { name: /^Task List/i })
      .click()
    await picker.getByText('Daily priorities', { exact: true }).click()
    await picker.getByRole('button', { name: /^Create tasks$/i }).click()

    const editor = page.locator('.qn-type-todo')
    const taskName = 'Complete the most important outcome'
    await editor.getByRole('button', { name: `Expand details for ${taskName}` }).click()
    await editor.locator(`select[aria-label="Repeat ${taskName}"]`).selectOption('weekly')
    await expect(editor.locator('span').filter({ hasText: /^Weekly$/ }).first()).toBeVisible()

    await editor.getByRole('button', { name: `Complete ${taskName}` }).click()
    await expect(editor.getByRole('button', { name: `Mark ${taskName} incomplete` })).toBeVisible()
    await expect(editor.getByRole('button', { name: `Complete ${taskName}` })).toBeVisible()
    await expect(editor.getByText(taskName, { exact: true })).toHaveCount(2)
  })
})

test.describe('daily workspace workflows on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('task center remains inside the viewport with a usable task list', async ({ page }) => {
    await signIn(page)
    await page.locator('.qn-top-chrome').getByRole('button', { name: /show navigation/i }).click()
    await page.getByRole('button', { name: /My Tasks/ }).click()
    const dialog = page.getByRole('dialog', { name: 'My Tasks' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(350)

    const box = await dialog.boundingBox()
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(845)
    await expect(dialog.getByRole('button', { name: 'New task list' })).toBeVisible()
    await expect(dialog.getByRole('list', { name: 'Workspace tasks' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
