import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expectNoHorizontalOverflow, signIn } from './helpers'

const formatViolations = (violations) =>
  violations
    .map((violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
    )
    .join('\n')

const expectDialogQuality = async (page, dialog) => {
  const viewport = page.viewportSize()
  const box = await dialog.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)

  const clippedControls = await dialog
    .locator('button, input, textarea, select, [role="button"]')
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          const rect = control.getBoundingClientRect()
          const style = getComputedStyle(control)
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            (rect.left < -1 || rect.right > window.innerWidth + 1)
          )
        })
        .map((control) => control.getAttribute('aria-label') || control.textContent?.trim())
    )
  expect(clippedControls).toEqual([])
  await expectNoHorizontalOverflow(page)

  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(formatViolations(violations)).toBe('')
}

const drawOnPage = async (page, accessibleName, { x = 140, y = 90, width = 280, height = 150 } = {}) => {
  const layer = page.getByRole('application', { name: accessibleName })
  await expect(layer).toBeVisible()
  const box = await layer.boundingBox()
  await page.mouse.move(box.x + x, box.y + y)
  await page.mouse.down()
  await page.mouse.move(box.x + x + width, box.y + y + height, { steps: 8 })
  await page.mouse.up()
  await expect(layer).toBeHidden()
}

test.describe('editor dialogs on a small screen', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.getByRole('heading', { name: 'Welcome to QuickNotes' }).click()
    await expect(page.getByLabel('Note title')).toBeVisible()
    await page.getByRole('button', { name: /show formatting tools/i }).click()
    await expect(page.locator('.editor-toolbar')).toBeVisible()
  })

  test('image upload rejects an unsafe embedded file before reading it', async ({ page }) => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.getByRole('button', { name: 'Insert image' }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Insert image' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/image host.*IP address/i)).toBeVisible()
    await dialog.getByRole('radio', { name: 'Upload file' }).click()
    await dialog.getByLabel('Choose image file').setInputFiles({
      name: 'too-large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(513 * 1024),
    })

    await expect(dialog.getByRole('alert')).toContainText('512 KB or smaller')
    await expect(dialog.getByRole('button', { name: 'Insert image' })).toBeDisabled()
    await expectDialogQuality(page, dialog)
  })

  test('link insertion rejects executable schemes and remains keyboard usable', async ({ page }) => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.getByRole('button', { name: /Insert Link/ }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Insert link' })
    const address = dialog.getByLabel(/Web address/i)
    await expect(address).toBeFocused()
    await address.fill('javascript:alert(1)')
    await dialog.getByRole('button', { name: 'Insert link' }).click()

    await expect(dialog.getByRole('alert')).toContainText('Only HTTP and HTTPS')
    await expect(address).toBeFocused()
    await expectDialogQuality(page, dialog)
  })

  test('HTML tools report blocked clipboard access without clipping controls', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      })
    })
    await page.getByRole('tab', { name: 'View', exact: true }).click()
    await page.getByRole('button', { name: 'Edit HTML Source' }).click()

    const dialog = page.getByRole('dialog', { name: 'HTML editor' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Copy' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Clipboard access was blocked')
    await expect(dialog.getByRole('textbox', { name: 'HTML source' })).toBeFocused()
    await expectDialogQuality(page, dialog)
  })
})

test.describe('editor productivity objects', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.getByRole('heading', { name: 'Welcome to QuickNotes' }).click()
    await expect(page.locator('.editor-toolbar')).toBeVisible()
  })

  test('uses a flat, conventionally ordered command ribbon', async ({ page }) => {
    const toolbar = page.locator('.editor-toolbar')
    const tabs = page.getByRole('tablist', { name: 'Editor ribbon' })
    await expect(tabs.getByRole('tab')).toHaveCount(5)
    await expect(tabs.getByRole('tab', { name: 'Format' })).toHaveCount(0)
    await expect(tabs.getByRole('tab', { name: 'Tools' })).toHaveCount(0)
    await expect(tabs.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
    await expect(toolbar.getByRole('button', { name: 'Bold' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'More shapes' })).toBeHidden()
    await expect(toolbar.getByRole('button', { name: 'Edit HTML Source' })).toBeHidden()

    await tabs.getByRole('tab', { name: 'Home' }).focus()
    await tabs.getByRole('tab', { name: 'Home' }).press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'Insert' })).toBeFocused()
    await expect(tabs.getByRole('tab', { name: 'Insert' })).toHaveAttribute('aria-selected', 'true')
    await expect(toolbar.getByRole('button', { name: 'More shapes' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Draw text box' })).toBeVisible()
    await tabs.getByRole('tab', { name: 'View', exact: true }).click()
    await expect(toolbar.getByRole('button', { name: 'Edit HTML Source' })).toBeVisible()

    const ungrouped = await toolbar.locator('button:visible').evaluateAll((buttons) =>
      buttons.filter((button) => !button.closest('.qn-ribbon-group')).map((button) => button.getAttribute('aria-label'))
    )
    expect(ungrouped).toEqual([])

    await tabs.getByRole('tab', { name: 'Home' }).click()
    const visibleLabels = await toolbar.locator('.qn-ribbon-group-label').evaluateAll((labels) =>
      labels.filter((label) => getComputedStyle(label).display !== 'none').map((label) => label.textContent)
    )
    expect(visibleLabels).toEqual([])
    const leftmostCommand = await toolbar.locator('button:visible').evaluateAll((buttons) =>
      buttons.map((button) => ({ name: button.getAttribute('aria-label'), left: button.getBoundingClientRect().left }))
        .sort((first, second) => first.left - second.left)[0]?.name
    )
    expect(leftmostCommand).toBe('Font family')
    const groupChrome = await toolbar.locator('.qn-ribbon-group:visible').first().evaluate((group) => {
      const style = getComputedStyle(group)
      return { radius: style.borderRadius, shadow: style.boxShadow, background: style.backgroundColor }
    })
    expect(groupChrome.radius).toBe('0px')
    expect(groupChrome.shadow).toBe('none')
    expect(groupChrome.background).toBe('rgba(0, 0, 0, 0)')

    for (const tabName of ['Home', 'Insert', 'Layout', 'Review', 'View']) {
      await tabs.getByRole('tab', { name: tabName, exact: true }).click()
      const commandCount = await toolbar.locator('button:visible').count()
      expect(commandCount, `${tabName} should not be an underfilled ribbon tab`).toBeGreaterThanOrEqual(5)
    }
  })

  test('keeps the ruler optional and provides persistent workbench customization', async ({ page }) => {
    await page.getByRole('tab', { name: 'View', exact: true }).click()
    await expect(page.getByLabel('Paragraph ruler')).toBeHidden()

    await page.getByRole('button', { name: 'Show ruler' }).click()
    await expect(page.getByLabel('Paragraph ruler')).toBeVisible()
    await expect(page.getByLabel('Vertical page ruler')).toBeVisible()
    const [selectorBox, rulerBox] = await Promise.all([
      page.locator('[data-tab-selector]').boundingBox(),
      page.getByLabel('Paragraph ruler').boundingBox(),
    ])
    expect(selectorBox.x).toBeCloseTo(rulerBox.x, 0)
    await page.getByRole('button', { name: 'Hide ruler' }).click()
    await expect(page.getByLabel('Paragraph ruler')).toBeHidden()
    await expect(page.getByLabel('Vertical page ruler')).toBeHidden()

    await page.getByRole('button', { name: 'Customize editor' }).click()
    const settings = page.getByRole('dialog', { name: 'Editor settings' })
    const noteWidth = settings.getByLabel('Note width')
    await expect(noteWidth).toHaveValue('standard')
    const selectChrome = await noteWidth.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        appearance: style.appearance,
        backgroundImage: style.backgroundImage,
        backgroundPosition: style.backgroundPosition,
        paddingLeft: style.paddingLeft,
      }
    })
    expect(selectChrome.appearance).toBe('none')
    expect(selectChrome.backgroundImage).not.toBe('none')
    expect(selectChrome.backgroundPosition).toContain('calc(100% -')
    expect(selectChrome.paddingLeft).toBe('12px')
    await noteWidth.selectOption('focused')
    await settings.getByLabel('Ribbon spacing').selectOption('compact')
    await settings.getByRole('button', { name: 'Done' }).click()

    await expect(page.locator('[data-editor-page]')).toHaveAttribute('data-document-width', 'focused')
    await expect(page.locator('.editor-ribbon')).toHaveAttribute('data-density', 'compact')
  })

  test('creates the configured checklist from the icon and renders an explicit tick', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Verify the release')

    await page.getByRole('tab', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'Checklist options' }).click()
    const options = page.getByRole('dialog', { name: 'Checklist options' })
    await options.getByRole('button', { name: 'Circle checkbox' }).click()
    await options.getByRole('button', { name: 'blue tick colour' }).click()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Create checklist with current style' }).click()
    await expect(options).toBeVisible()
    const item = editor.locator('li[data-type="taskItem"]')
    await expect(item).toHaveAttribute('data-checkbox-style', 'circle')
    await expect(item).toHaveAttribute('data-checkbox-color', 'blue')
    const checkmark = item.locator('.qn-task-checkbox-visual svg')
    await expect(checkmark).toHaveCSS('opacity', '0')
    await item.locator('input[type="checkbox"]').check({ force: true })
    await expect(item).toHaveAttribute('data-checked', 'true')
    await expect(checkmark).toHaveCSS('opacity', '1')
    await expect(item.locator('.qn-task-checkbox-visual')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(item.locator('.qn-task-checkbox-visual')).toHaveCSS('color', 'rgb(37, 99, 235)')
  })

  test('paginates notes and persists Ctrl+Enter as a manual PDF boundary', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Page one')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.type('Page two')

    await expect(editor.locator('[data-type="pageBreak"]')).toHaveCount(1)
    await expect(editor.locator('.qn-page-gap[data-page-break="manual"]')).toHaveCount(1)
    await expect.poll(async () => Number(await editor.getAttribute('data-page-count'))).toBe(2)
    const gapHeight = await editor.locator('.qn-page-gap').evaluate((gap) => gap.getBoundingClientRect().height)
    expect(gapHeight).toBeGreaterThan(100)
    const [editorBox, gutterBox] = await Promise.all([
      editor.boundingBox(),
      editor.locator('.qn-page-gap__gutter').boundingBox(),
    ])
    expect(gutterBox.x).toBeLessThanOrEqual(editorBox.x + 0.5)
    expect(gutterBox.x + gutterBox.width).toBeGreaterThanOrEqual(editorBox.x + editorBox.width - 0.5)
    await expect(editor.locator('.qn-page-gap__gutter')).toHaveCSS('border-left-width', '0px')
    await expect(editor.locator('.qn-page-gap__gutter')).toHaveCSS('border-right-width', '0px')

    await page.getByRole('tab', { name: 'Layout' }).click()
    await expect(page.getByRole('button', { name: /Insert page break/ })).toBeVisible()
  })

  test('creates a new visual A4 page when document content overflows', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+A')
    for (let index = 1; index <= 28; index += 1) {
      await page.keyboard.insertText(`Paragraph ${index} has enough content to exercise automatic page flow across a realistic A4 writing surface with ordinary prose.`)
      await page.keyboard.press('Enter')
    }

    await expect.poll(async () => editor.locator('.qn-page-gap[data-page-break="automatic"]').count()).toBeGreaterThan(0)
    await expect.poll(async () => Number(await editor.getAttribute('data-page-count'))).toBeGreaterThanOrEqual(2)
  })

  test('edits one checklist item without forcing deletion of the checklist', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Note content' })
    const taskItems = page.locator('.ProseMirror li.task-item')
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Ship the release')

    await page.getByRole('tab', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'Checklist options' }).click()
    const options = page.getByRole('dialog', { name: 'Checklist options' })
    await options.getByRole('button', { name: 'Create checklist' }).click()

    const itemText = editor.getByText('Ship the release', { exact: true })
    await itemText.click()
    const item = itemText.locator('xpath=ancestor::li[1]')
    await expect(item).toHaveClass(/task-item/)
    await page.getByRole('button', { name: 'Checklist options' }).click()
    await options.getByRole('button', { name: 'Circle checkbox' }).click()
    await options.getByRole('button', { name: 'purple tick colour' }).click()
    await options.getByLabel('Size').selectOption('large')
    await options.getByLabel('Completed text').selectOption('keep')

    await expect(item).toHaveAttribute('data-checkbox-style', 'circle')
    await expect(item).toHaveAttribute('data-checkbox-color', 'purple')
    await expect(item).toHaveAttribute('data-checkbox-size', 'large')
    await expect(item).toHaveAttribute('data-checked-style', 'keep')

    await options.getByRole('button', { name: 'Add below' }).click()
    await expect(taskItems).toHaveCount(2)
    await page.getByRole('dialog', { name: 'Checklist options' }).getByRole('button', { name: 'Remove this checkbox' }).click()
    await expect(taskItems).toHaveCount(1)
    await expect(editor).toContainText('Ship the release')
  })

  test('uses visible checklist defaults and batch-applies styles to selected items', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('First task')

    await page.getByRole('tab', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'Checklist options' }).click()
    let options = page.getByRole('dialog', { name: 'Checklist options' })
    const circle = options.getByRole('button', { name: 'Circle checkbox' })
    const blue = options.getByRole('button', { name: 'blue tick colour' })
    await circle.click()
    await blue.click()
    await expect(circle).toHaveAttribute('aria-pressed', 'true')
    await expect(blue).toHaveAttribute('aria-pressed', 'true')
    await expect(options.getByRole('status')).toContainText('New checklist items will use blue tick colour')
    await options.getByRole('button', { name: 'Create checklist' }).click()

    const items = editor.locator('li[data-type="taskItem"]')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toHaveAttribute('data-checkbox-style', 'circle')
    await expect(items.first()).toHaveAttribute('data-checkbox-color', 'blue')

    await editor.press('End')
    await editor.press('Enter')
    await editor.pressSequentially('Second task')
    await expect(items).toHaveCount(2)
    await editor.click()
    await page.keyboard.press('Control+A')

    await page.getByRole('button', { name: 'Checklist options' }).click()
    options = page.getByRole('dialog', { name: 'Checklist options' })
    await expect(options.getByText('2 selected items', { exact: true })).toBeVisible()
    await options.getByRole('button', { name: 'Square checkbox' }).click()
    await options.getByRole('button', { name: 'rose tick colour' }).click()

    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toHaveAttribute('data-checkbox-style', 'square')
    await expect(items.nth(1)).toHaveAttribute('data-checkbox-style', 'square')
    await expect(items.nth(0)).toHaveAttribute('data-checkbox-color', 'rose')
    await expect(items.nth(1)).toHaveAttribute('data-checkbox-color', 'rose')
    await expect(options.getByRole('status')).toContainText('2 selected items')
  })

  test('inserts semantic callouts and timestamps from the Insert tab', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Deployment is paused')

    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.getByRole('button', { name: 'Callout' }).click()
    await page.getByRole('dialog', { name: 'Callout styles' }).getByRole('button', { name: 'Create callout' }).click()
    const callout = page.locator('aside[data-type="callout"]').last()
    await expect(callout).toContainText('Deployment is paused')

    await page.getByRole('button', { name: 'Callout' }).click()
    await page.getByRole('dialog', { name: 'Callout styles' }).getByRole('button', { name: 'Important' }).click()
    await expect(callout).toHaveAttribute('data-tone', 'important')

    await editor.press('Control+End')
    await editor.press('Enter')
    await page.getByRole('button', { name: 'Insert current date' }).click()
    await expect(editor).not.toHaveText('')
  })

  test('discovers structural tools from the slash command menu', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('/call')

    const menu = page.getByRole('listbox', { name: 'Insert block' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter')

    await expect(menu).toBeHidden()
    await expect(page.locator('aside[data-type="callout"]')).toHaveCount(1)
  })

  test('inserts a shape with direct and exact transformation controls', async ({ page }) => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.getByRole('button', { name: 'More shapes' }).click()
    const gallery = page.getByRole('dialog', { name: 'Insert a shape' })
    await expect(gallery.getByRole('button', { name: 'Insert diamond' })).toBeVisible()
    await expect(gallery.getByRole('button', { name: 'Insert right arrow' }).first()).toBeVisible()
    await expect(gallery.locator('.qn-shape-gallery-item .qn-shape__geometry > *')).toHaveCount(51)
    await gallery.getByRole('button', { name: 'Insert diamond' }).click()
    await drawOnPage(page, 'Draw shape on the page', { width: 300, height: 160 })
    const shape = page.locator('.qn-shape').last()
    await expect(shape).toBeVisible()
    await shape.locator('.qn-shape__surface').click()
    const shapeToolbar = page.getByRole('toolbar', { name: 'Shape formatting' })
    await expect(shapeToolbar).toBeVisible()
    await expect(shape.locator('.qn-shape__geometry polygon')).toBeVisible()

    await shapeToolbar.getByRole('button', { name: 'Size and rotation' }).click()

    const width = page.getByRole('spinbutton', { name: 'Shape width' })
    const height = page.getByRole('spinbutton', { name: 'Shape height' })
    await expect(width).toBeVisible()
    await width.fill('320')
    await height.fill('150')
    await page.getByRole('button', { name: 'Rotate right 90 degrees' }).click()
    const flipHorizontal = page.getByRole('button', { name: 'Flip horizontally' })
    await expect(flipHorizontal).toHaveAttribute('aria-pressed', 'false')
    await flipHorizontal.click()

    await expect(shape).toHaveAttribute('data-width', '320')
    await expect(shape).toHaveAttribute('data-height', '150')
    await expect(shape).toHaveAttribute('data-rotation', '90')
    await expect(shape).toHaveAttribute('data-flip-h', 'true')
    await expect(flipHorizontal).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('spinbutton', { name: 'Shape rotation in degrees' })).toHaveValue('90')

    const toolbarBox = await shapeToolbar.boundingBox()
    expect(toolbarBox.x).toBeGreaterThanOrEqual(8)
    expect(toolbarBox.y).toBeGreaterThanOrEqual(8)
    expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(page.viewportSize().width - 8)
    expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(page.viewportSize().height - 8)
  })

  test('moves a shape freely and exposes Word-style wrapping choices', async ({ page }) => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.getByRole('button', { name: 'More shapes' }).click()
    await page.getByRole('dialog', { name: 'Insert a shape' })
      .getByRole('button', { name: 'Insert right arrow' })
      .first()
      .click()
    await drawOnPage(page, 'Draw shape on the page')

    const shape = page.locator('.qn-shape').last()
    await shape.locator('.qn-shape__surface').click()
    await page.getByRole('button', { name: 'Layout options' }).click()
    const layout = page.getByRole('dialog', { name: 'Shape layout options' })
    await expect(layout.getByRole('button', { name: /Free position/ })).toBeVisible()
    await layout.getByRole('button', { name: /Free position/ }).click()

    const moveHandle = shape.getByRole('button', { name: 'Drag to move shape' })
    const before = await moveHandle.boundingBox()
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2 + 64, before.y + before.height / 2 + 36, { steps: 5 })
    await page.mouse.up()

    await expect(shape).toHaveAttribute('data-wrap', 'absolute')
    await expect.poll(async () => Number(await shape.getAttribute('data-x'))).toBeGreaterThan(40)
    await expect.poll(async () => Number(await shape.getAttribute('data-y'))).toBeGreaterThan(20)
  })

  test('draws, freely moves, resizes, and colours a text box', async ({ page }) => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.getByRole('button', { name: 'Draw text box' }).click()
    await drawOnPage(page, 'Draw text box on the page', { x: 180, y: 100, width: 340, height: 170 })

    const textBox = page.locator('.qn-text-box').last()
    await expect(textBox).toHaveAttribute('data-wrap', 'absolute')
    await expect(textBox).toHaveAttribute('data-width', '340')
    await expect(textBox).toHaveAttribute('data-height', '170')
    await textBox.click({ position: { x: 30, y: 30 } })
    await expect(textBox.getByRole('button', { name: /Resize text box/ })).toHaveCount(8)

    const formatting = page.getByRole('toolbar', { name: 'Text box formatting' })
    await formatting.getByRole('button', { name: 'Text box fill' }).click()
    await page.getByRole('dialog', { name: 'Text box fill' }).getByRole('button', { name: 'Fill #eff6ff' }).click()
    await expect(textBox).toHaveAttribute('data-bg', '#eff6ff')

    const moveHandle = textBox.getByRole('button', { name: 'Move text box' })
    const beforeMove = await moveHandle.boundingBox()
    await page.mouse.move(beforeMove.x + beforeMove.width / 2, beforeMove.y + beforeMove.height / 2)
    await page.mouse.down()
    await page.mouse.move(beforeMove.x + beforeMove.width / 2 + 70, beforeMove.y + beforeMove.height / 2 + 40, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => Number(await textBox.getAttribute('data-x'))).toBeGreaterThan(200)

    const resize = textBox.getByRole('button', { name: 'Resize text box se' })
    const beforeResize = await resize.boundingBox()
    const beforeResizeWidth = Number(await textBox.getAttribute('data-width'))
    const beforeResizeHeight = Number(await textBox.getAttribute('data-height'))
    await page.mouse.move(beforeResize.x + beforeResize.width / 2, beforeResize.y + beforeResize.height / 2)
    await page.mouse.down()
    await page.mouse.move(beforeResize.x + beforeResize.width / 2 + 30, beforeResize.y + beforeResize.height / 2 + 25, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => Number(await textBox.getAttribute('data-width'))).toBeGreaterThan(beforeResizeWidth)
    await expect.poll(async () => Number(await textBox.getAttribute('data-height'))).toBeGreaterThan(beforeResizeHeight)
  })

  test('supports repeated indents, styled checklists, and persistent ruler tab stops', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first()
    const paragraph = editor.locator('p').first()
    await paragraph.click()
    await editor.press('End')
    await editor.pressSequentially('Project owner')

    await page.getByRole('tab', { name: 'Layout' }).click()
    const toolbar = page.locator('.editor-toolbar')
    const increaseIndent = toolbar.getByRole('button', { name: 'Increase Indent' })
    await increaseIndent.click()
    await increaseIndent.click()
    await increaseIndent.click()
    await expect(paragraph).toHaveAttribute('data-left-indent', '120')

    await page.getByRole('tab', { name: 'Home' }).click()
    await toolbar.getByRole('button', { name: 'Checklist options' }).click()
    await page.getByRole('dialog', { name: 'Checklist options' }).getByRole('button', { name: 'Create checklist' }).click()
    await toolbar.getByRole('button', { name: 'Checklist options' }).click()
    await page.getByRole('dialog', { name: 'Checklist options' }).getByRole('button', { name: 'Circle checkbox' }).click()
    await expect(editor.locator('li[data-checkbox-style]').first()).toHaveAttribute('data-checkbox-style', 'circle')
    await page.keyboard.press('Escape')

    await editor.click()
    await editor.press('Control+End')
    await editor.press('Enter')
    await editor.press('Enter')
    await editor.pressSequentially('Tab stop target')

    await page.getByRole('tab', { name: 'View', exact: true }).click()
    await toolbar.getByRole('button', { name: 'Show ruler' }).click()
    const ruler = page.locator('.qn-document-ruler')
    await expect(ruler).toBeVisible()
    const rulerPage = ruler.locator('[data-ruler-page]')
    const leftMargin = ruler.locator('.qn-ruler-margin--left')
    const rightMargin = ruler.locator('.qn-ruler-margin--right')
    const editorPage = page.locator('[data-editor-page]')
    const [rulerPageBox, editorPageBox, leftMarginBox, rightMarginBox] = await Promise.all([
      rulerPage.boundingBox(),
      editorPage.boundingBox(),
      leftMargin.boundingBox(),
      rightMargin.boundingBox(),
    ])
    expect(Math.abs(rulerPageBox.x - editorPageBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(rulerPageBox.width - editorPageBox.width)).toBeLessThanOrEqual(1)
    expect(leftMarginBox.width).toBeGreaterThan(20)
    expect(rightMarginBox.width).toBeGreaterThan(20)
    await expect(leftMargin).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(rightMargin).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const track = ruler.locator('[data-ruler-track]')
    await track.click({ position: { x: 210, y: 18 } })
    await expect(ruler.getByRole('button', { name: /Left tab stop at 210 pixels/ })).toBeVisible()

    await editor.getByText('Tab stop target', { exact: true }).click()
    await editor.press('End')
    await editor.press('Tab')
    await expect(editor.locator('[data-type="tabStop"]')).toHaveCount(1)
    await expect(editor.locator('[data-type="tabStop"]')).toHaveAttribute('data-tab-type', 'left')

    await ruler.getByRole('button', { name: /Tab stop type: Left/ }).click()
    await track.click({ position: { x: 300, y: 18 } })
    const centerStop = ruler.getByRole('button', { name: /Center tab stop at 300 pixels/ })
    await expect(centerStop).toBeVisible()
    await centerStop.press('Enter')
    await expect(ruler.getByRole('button', { name: /Right tab stop at 300 pixels/ })).toBeVisible()
  })
})
