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
    await page.getByRole('button', { name: /show more formatting tools/i }).click()
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

  test('uses a simplified ribbon until the writer asks for specialist tools', async ({ page }) => {
    const toolbar = page.locator('.editor-toolbar')
    await expect(toolbar.getByRole('button', { name: 'Bold' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Insert shape' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Strikethrough' })).toBeHidden()
    await expect(toolbar.getByRole('button', { name: 'Edit HTML Source' })).toBeHidden()

    await toolbar.getByRole('button', { name: /show more formatting tools/i }).click()
    await expect(toolbar.getByRole('button', { name: 'Strikethrough' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Edit HTML Source' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /use simplified toolbar/i })).toBeVisible()
  })

  test('inserts a shape with direct and exact transformation controls', async ({ page }) => {
    await page.getByRole('button', { name: 'Insert shape' }).click()
    const shape = page.locator('.qn-shape').last()
    await expect(shape).toBeVisible()
    await shape.locator('.qn-shape__surface').click()
    await expect(shape.getByRole('toolbar', { name: 'Shape formatting' })).toBeVisible()

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

    const toolbarBox = await shape.locator('.qn-shape-toolbar').boundingBox()
    const rotationHandleBox = await shape
      .getByRole('button', { name: /drag to rotate shape/i })
      .boundingBox()
    expect(rotationHandleBox.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height)
  })
})
