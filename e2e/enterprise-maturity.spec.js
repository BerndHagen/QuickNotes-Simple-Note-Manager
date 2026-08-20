import { test, expect } from '@playwright/test'
import { collectErrors, expectNoHorizontalOverflow, signIn } from './helpers'

async function createFocusedWorkspace(page, { type, starter, title, className, mobile = false }) {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog
    .locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${type}`, 'i') })
    .click()
  await dialog.getByText(starter, { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  if (mobile) await page.locator('.note-card', { hasText: title }).click()
  const editor = page.locator(className)
  await expect(editor).toBeVisible()
  return editor
}

test.describe('enterprise UI maturity regressions', () => {
  test('keeps pin and favourite state beside the title and reveals card actions as one unit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const card = page.locator('.note-card').filter({ hasText: 'Welcome to QuickNotes' })
    const cardFrame = card.locator('..')
    const actionGroup = cardFrame.locator('.qn-card-action').first().locator('..')

    await expect(card.getByTitle('Pinned')).toBeVisible()
    await expect(card.getByTitle('Favourite')).toBeVisible()
    await expect(actionGroup).toHaveCSS('opacity', '0')
    await expect(actionGroup).toHaveCSS('pointer-events', 'none')

    await card.hover()
    await expect(actionGroup).toHaveCSS('opacity', '1')
    await expect(actionGroup).toHaveCSS('pointer-events', 'auto')
    await expect(cardFrame.getByRole('button', { name: /more actions for welcome to quicknotes/i })).toBeVisible()
  })

  test('uses one product radius for fields, note cards and application windows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const search = page.getByRole('searchbox', { name: /search notes/i })
    const card = page.locator('.note-card').first()
    const [searchRadius, cardRadius] = await Promise.all([
      search.evaluate((element) => getComputedStyle(element).borderRadius),
      card.evaluate((element) => getComputedStyle(element).borderRadius),
    ])
    expect(searchRadius).toBe('12px')
    expect(cardRadius).toBe(searchRadius)

    await page.getByRole('button', { name: /^settings$/i }).first().click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    const windowRadius = await settings.locator('.qn-settings-shell').evaluate(
      (element) => getComputedStyle(element).borderRadius
    )
    expect(windowRadius).toBe(searchRadius)
  })

  test('uses identical rail separators and shared high-contrast creation actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const rail = page.getByRole('navigation', { name: 'Workspace' })
    const separators = rail.locator('.qn-nav-separator')
    await expect(separators).toHaveCount(2)
    const separatorBoxes = await separators.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x, width: box.width }
    }))
    expect(separatorBoxes[0]).toEqual(separatorBoxes[1])

    const quickNote = rail.getByRole('button', { name: /Quick Note/i })
    const newNote = page.getByRole('button', { name: 'New note', exact: true }).first()
    await expect(quickNote).toHaveClass(/qn-button-primary/)
    await expect(newNote).toHaveClass(/qn-button-primary/)
    const restingBackground = await quickNote.evaluate((element) => getComputedStyle(element).backgroundColor)
    await quickNote.hover()
    await expect.poll(() => quickNote.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground)
  })

  test('keeps the document header neutral with its pattern confined to the right edge', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const header = page.locator('.qn-document-header')
    await expect(header).toBeVisible()
    const surface = await header.evaluate((element) => {
      const style = getComputedStyle(element)
      const pattern = getComputedStyle(element, '::after')
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.color,
        patternImage: pattern.backgroundImage,
        patternWidth: pattern.width,
      }
    })

    expect(surface.backgroundImage).toBe('none')
    expect(surface.patternImage.match(/conic-gradient/g)).toHaveLength(2)
    expect(Number.parseFloat(surface.patternWidth)).toBeGreaterThan(200)
    expect(surface.backgroundColor).toBe('rgb(255, 255, 255)')
    expect(surface.color).not.toBe('rgb(255, 255, 255)')
  })

  test('keeps mobile task copy readable and places secondary actions on their own row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const errors = collectErrors(page)
    await signIn(page)
    const editor = await createFocusedWorkspace(page, {
      type: 'Task List',
      starter: 'Daily priorities',
      title: 'Mobile delivery priorities',
      className: '.qn-type-todo',
      mobile: true,
    })

    const firstTask = editor.locator('.qn-task-row').first()
    const taskCopy = firstTask.getByText('Complete the most important outcome', { exact: true })
    const actions = firstTask.locator('.qn-task-actions')
    const [copyBox, actionsBox] = await Promise.all([taskCopy.boundingBox(), actions.boundingBox()])

    expect(copyBox.width).toBeGreaterThan(220)
    expect(actionsBox.y).toBeGreaterThan(copyBox.y + copyBox.height)
    await expectNoHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('renders idea cards as contained, responsive product objects', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors = collectErrors(page)
    await signIn(page)
    const editor = await createFocusedWorkspace(page, {
      type: 'Idea Board',
      starter: 'Problem solving',
      title: 'Customer discovery',
      className: '.qn-type-brainstorm',
    })

    const ideaInput = editor.getByPlaceholder(/type your idea/i)
    await ideaInput.fill('Prioritize customer interview findings')
    await ideaInput.press('Enter')
    const card = editor.locator('.qn-idea-card').filter({ hasText: 'Prioritize customer interview findings' })
    await expect(card).toBeVisible()
    await expect(page.getByRole('button', { name: /^Tags(?: \(\d+\))?$/ })).toBeVisible()

    const category = card.getByRole('combobox', {
      name: 'Category for Prioritize customer interview findings',
    })
    await expect(category).toBeVisible()
    await category.selectOption('solution')
    await expect(category).toHaveValue('solution')

    const cardBox = await card.boundingBox()
    expect(cardBox.width).toBeGreaterThanOrEqual(230)
    expect(await card.evaluate((element) => getComputedStyle(element).borderStyle)).not.toBe('none')
    const actionBoxes = await card.locator('button:visible').evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect()
        return { left: box.left, right: box.right }
      })
    )
    for (const box of actionBoxes) {
      expect(box.left).toBeGreaterThanOrEqual(cardBox.x - 1)
      expect(box.right).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)
    }
    expect(errors).toEqual([])
  })

  test('keeps the meeting tab rail and its persistent summary action operational', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    const editor = await createFocusedWorkspace(page, {
      type: 'Meeting Workspace',
      starter: 'Team sync',
      title: 'Quarterly operating review',
      className: '.qn-type-meeting',
    })

    const copySummary = editor.getByRole('button', { name: 'Copy meeting summary' })
    await expect(copySummary).toBeInViewport()
    await editor.getByRole('button', { name: /^Action Items/i }).click()
    await expect(editor.getByLabel('New action item')).toBeVisible()
    await expect(editor.getByRole('button', { name: /^Action Items/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('offers direct keyboard-friendly movement for Kanban tasks', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    const editor = await createFocusedWorkspace(page, {
      type: 'Project Board',
      starter: 'Product launch',
      title: 'Launch delivery plan',
      className: '.qn-type-project',
    })

    const moveButton = editor.getByRole('button', {
      name: /move define launch goal and audience to to do/i,
    })
    await moveButton.focus()
    await page.keyboard.press('Enter')
    await expect(editor.locator('[aria-live="polite"]')).toHaveText(/moved to to do/i)
    await expect(editor.getByLabel(/to do, 2 tasks/i)).toContainText('Define launch goal and audience')
  })
})
