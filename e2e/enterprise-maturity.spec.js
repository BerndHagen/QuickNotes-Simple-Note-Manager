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

  test('uses one gold Lucide favourite treatment in list, editor, and grid views', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await signIn(page)

    const listStar = page.locator('.note-card').filter({ hasText: 'Welcome to QuickNotes' })
      .getByTitle('Favourite').locator('svg')
    const editorStar = page.getByRole('button', { name: /remove from favourites/i }).first().locator('svg')
    const listColor = await listStar.evaluate((icon) => getComputedStyle(icon).color)
    await expect(editorStar).toHaveCSS('color', listColor)

    await page.getByRole('button', { name: 'Grid view', exact: true }).click()
    const gridStar = page.getByRole('button', { name: 'Remove from favorites', exact: true }).first().locator('svg')
    await expect(gridStar).toHaveCSS('color', listColor)
    await expect(gridStar).toHaveCSS('fill', listColor)
    await expect(page.getByText('⭐', { exact: false })).toHaveCount(0)
  })

  test('uses restrained radius tiers for controls, rows and application windows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const search = page.getByRole('searchbox', { name: /filter this list/i })
    const card = page.locator('.note-card').first()
    const [searchRadius, cardRadius] = await Promise.all([
      search.evaluate((element) => getComputedStyle(element).borderRadius),
      card.evaluate((element) => getComputedStyle(element).borderRadius),
    ])
    expect(searchRadius).toBe('6px')
    expect(cardRadius).toBe('0px')

    await page.getByRole('button', { name: /^settings$/i }).first().click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    const windowRadius = await settings.locator('.qn-settings-shell').evaluate(
      (element) => getComputedStyle(element).borderRadius
    )
    expect(windowRadius).toBe('12px')
  })

  test('centers every window icon against its title block on a neutral header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    await page.getByRole('button', { name: /^settings$/i }).first().click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    const header = settings.locator('[data-dialog-banner]')
    const geometry = await header.evaluate((element) => {
      const icon = element.querySelector('[data-dialog-icon]').getBoundingClientRect()
      const copy = element.querySelector('[data-dialog-copy]').getBoundingClientRect()
      const close = element.querySelector('button').getBoundingClientRect()
      const center = (rect) => rect.top + rect.height / 2
      const style = getComputedStyle(element)
      return {
        iconCopyDelta: Math.abs(center(icon) - center(copy)),
        closeCopyDelta: Math.abs(center(close) - center(copy)),
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
      }
    })

    expect(geometry.iconCopyDelta).toBeLessThanOrEqual(1)
    expect(geometry.closeCopyDelta).toBeLessThanOrEqual(1)
    expect(geometry.backgroundImage).toBe('none')
    expect(geometry.backgroundColor).toBe('rgb(240, 245, 243)')
  })

  test('uses identical rail separators and a high-contrast creation action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const rail = page.getByRole('navigation', { name: 'Workspace' })
    const separators = rail.locator('.qn-nav-separator')
    expect(await separators.count()).toBeGreaterThanOrEqual(2)
    const separatorBoxes = await separators.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x, width: box.width }
    }))
    expect(separatorBoxes.every((box) =>
      box.x === separatorBoxes[0].x && box.width === separatorBoxes[0].width
    )).toBe(true)

    const newNote = page.getByRole('button', { name: 'New note', exact: true }).first()
    await expect(newNote).toHaveClass(/qn-button-primary/)
    const creationContrast = await newNote.evaluate((button) => {
      const channels = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
      const luminance = (value) => {
        const rgb = channels(value).map((channel) => {
          const normalized = channel / 255
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4
        })
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
      }
      const style = getComputedStyle(button)
      const foreground = luminance(style.color)
      const background = luminance(style.backgroundColor)
      return {
        ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        iconColor: getComputedStyle(button.querySelector('svg')).color,
        foreground: style.color,
      }
    })
    expect(creationContrast.ratio).toBeGreaterThanOrEqual(4.5)
    expect(creationContrast.iconColor).toBe(creationContrast.foreground)
    const restingBackground = await newNote.evaluate((element) => getComputedStyle(element).backgroundColor)
    await newNote.hover()
    await expect.poll(() => newNote.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground)
  })

  test('uses continuous brand chrome and a neutral document command surface', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const applicationBar = page.locator('.qn-top-chrome')
    const header = page.locator('.qn-ribbon-note-bar')
    const tabs = page.locator('.qn-ribbon-tabs')
    await expect(header).toBeVisible()
    await expect(tabs).toBeVisible()
    const applicationSurface = await applicationBar.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      }
    })
    const documentSurface = await header.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.color,
      }
    })
    const tabsBackground = await tabs.evaluate((element) => getComputedStyle(element).backgroundColor)

    expect(applicationSurface.backgroundImage).toBe('none')
    expect(applicationSurface.backgroundColor).toBe('rgb(11, 74, 56)')
    expect(documentSurface.backgroundImage).toBe('none')
    expect(documentSurface.backgroundColor).toBe('rgb(255, 255, 255)')
    expect(documentSurface.color).not.toBe('rgb(255, 255, 255)')
    expect(tabsBackground).not.toBe(applicationSurface.backgroundColor)
  })

  test('keeps the green identity in dark chrome and neutral utility surfaces', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    await page.getByRole('button', { name: /^settings$/i }).first().click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await settings.getByRole('button', { name: 'Dark', exact: true }).click()

    const header = settings.locator('[data-dialog-banner]')
    const settingsNavigation = settings.getByRole('navigation', { name: 'Settings sections' }).locator('..')
    const selectedSection = settings.getByRole('button', { name: 'General', exact: true })
    await expect(header).toHaveCSS('background-color', 'rgb(21, 27, 35)')
    await expect(settingsNavigation).toHaveCSS('background-color', 'rgb(17, 23, 30)')
    await expect(selectedSection).not.toHaveCSS('background-color', 'rgb(17, 23, 30)')

    await settings.getByRole('button', { name: /close settings/i }).click()
    const applicationBar = page.locator('.qn-top-chrome')
    const rail = page.locator('.qn-nav-surface').first()
    const titleBar = page.locator('.qn-ribbon-note-bar')
    const newNote = page.getByRole('button', { name: 'New note', exact: true }).first()

    await expect(applicationBar).toHaveCSS('background-color', 'rgb(7, 55, 44)')
    await expect(rail).toHaveCSS('background-color', 'rgb(8, 46, 39)')
    await expect(rail).toHaveCSS('background-image', 'none')
    await expect(titleBar).toHaveCSS('background-color', 'rgb(22, 28, 37)')
    await expect(newNote).toHaveCSS('background-color', 'rgb(38, 49, 61)')

    await newNote.hover()
    await expect.poll(() => newNote.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe('rgb(134, 181, 165)')
  })

  test('keeps project creation controls readable on every column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    const editor = await createFocusedWorkspace(page, {
      type: 'Project Board',
      starter: 'Product launch',
      title: 'Accessible launch plan',
      className: '.qn-type-project',
    })

    await editor.getByRole('tab', { name: /^Board/i }).click()

    const addButtons = editor.getByRole('button', { name: /^Add task to / })
    await expect(addButtons).toHaveCount(4)
    const contrast = await addButtons.evaluateAll((buttons) => {
      const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
      const luminance = (value) => {
        const channels = rgb(value).map((channel) => {
          const normalized = channel / 255
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4
        })
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
      }
      return buttons.map((button) => {
        const style = getComputedStyle(button)
        const foreground = luminance(style.color)
        const background = luminance(style.backgroundColor)
        return {
          ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
          foreground: style.color,
          background: style.backgroundColor,
        }
      })
    })
    expect(contrast.every(({ ratio }) => ratio >= 4.5), JSON.stringify(contrast)).toBe(true)
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

    await editor.getByRole('tab', { name: /^Idea register/i }).click()
    const ideaInput = editor.getByLabel('New idea')
    await ideaInput.fill('Prioritize customer interview findings')
    await editor.getByRole('button', { name: 'Add idea' }).click()
    const card = editor.locator('.qn-idea-row').filter({ hasText: 'Prioritize customer interview findings' })
    await expect(card).toBeVisible()
    await card.locator('.qn-idea-title').click()

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

  test('keeps the meeting tab rail and its contextual summary action operational', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    const editor = await createFocusedWorkspace(page, {
      type: 'Meeting Workspace',
      starter: 'Team sync',
      title: 'Quarterly operating review',
      className: '.qn-type-meeting',
    })

    const copySummary = editor.getByRole('button', { name: 'Copy summary', exact: true })
    await expect(copySummary).toBeInViewport()
    await editor.getByRole('tab', { name: /^Action Items/i }).click()
    await expect(editor.getByLabel('New action item')).toBeVisible()
    await expect(editor.getByRole('tab', { name: /^Action Items/i })).toHaveAttribute('aria-selected', 'true')
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

    await editor.getByRole('tab', { name: /^Board/i }).click()

    const actions = editor.getByRole('button', { name: /actions for define launch goal and audience/i })
    await actions.focus()
    await page.keyboard.press('Enter')
    const moveButton = page.getByRole('menuitem', { name: 'To do', exact: true })
    await moveButton.focus()
    await page.keyboard.press('Enter')
    await expect(editor.locator('[aria-live="polite"]')).toHaveText(/moved to to do/i)
    await expect(editor.getByLabel(/to do, 2 tasks/i)).toContainText('Define launch goal and audience')
  })
})
