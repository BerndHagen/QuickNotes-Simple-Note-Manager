import { expect, test } from '@playwright/test'
import { collectErrors, expectNoHorizontalOverflow, signIn } from './helpers'

const openSettings = async (page) => {
  await page.getByRole('button', { name: /show navigation/i }).first().tap()
  await page.getByRole('button', { name: /^settings$/i }).first().tap()
  return page.getByRole('dialog', { name: 'Settings' })
}

test.describe('mobile Safari workflows', () => {
  test('keeps long settings usable through viewport and orientation changes', async ({ page }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 320, height: 568 })
    await signIn(page)

    const dialog = await openSettings(page)
    await expect(dialog).toBeVisible()
    const pane = dialog.locator('[data-settings-pane]')

    const initial = await pane.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }))
    expect(initial.overflowY).toBe('auto')
    expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight)

    await pane.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    const scrolled = await pane.evaluate((element) => ({
      bottom: element.scrollTop + element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    expect(scrolled.bottom).toBeGreaterThanOrEqual(scrolled.scrollHeight - 1)

    await dialog.getByRole('button', { name: /^account$/i }).tap()
    const displayName = pane.getByLabel(/display name/i)
    await displayName.focus()
    await page.setViewportSize({ width: 320, height: 360 })
    await displayName.scrollIntoViewIfNeeded()
    const [inputBox, paneBox] = await Promise.all([displayName.boundingBox(), pane.boundingBox()])
    expect(inputBox.y).toBeGreaterThanOrEqual(paneBox.y - 1)
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(paneBox.y + paneBox.height + 1)
    await expect(displayName).toBeFocused()

    await page.setViewportSize({ width: 667, height: 375 })
    await expectNoHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('supports fast touch editing without losing tools or writing space', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().tap()

    const title = page.getByLabel('Note title')
    const editor = page.locator('.ProseMirror').first()
    await title.fill('WebKit mobile note')
    await editor.tap()
    await editor.pressSequentially('A quick note written on a phone.')

    const toolbar = page.locator('.editor-toolbar')
    const toolbarMetrics = await toolbar.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      rows: new Set(
        [...element.querySelectorAll('button')].map((button) =>
          Math.round(button.getBoundingClientRect().top)
        )
      ).size,
    }))
    expect(toolbarMetrics.height).toBeLessThanOrEqual(60)
    expect(toolbarMetrics.rows).toBe(1)
    expect(toolbarMetrics.scrollWidth).toBeGreaterThan(toolbarMetrics.clientWidth)

    const finalToolBox = await toolbar.evaluate((element) => {
      const finalTool = element.querySelector('button:last-of-type')
      finalTool.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const box = finalTool.getBoundingClientRect()
      return { left: box.left, right: box.right }
    })
    expect(finalToolBox.left).toBeGreaterThanOrEqual(-1)
    expect(finalToolBox.right).toBeLessThanOrEqual(321)

    await page.getByRole('button', { name: 'Text Color' }).tap()
    const popover = page.getByRole('dialog', { name: 'Formatting options' })
    await expect(popover).toBeVisible()
    const popoverBox = await popover.boundingBox()
    expect(popoverBox.x).toBeGreaterThanOrEqual(7)
    expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(313)
    expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(561)

    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 320, height: 360 })
    await editor.tap()
    await editor.pressSequentially(' Still visible.')
    const editorViewport = editor.locator('xpath=../..')
    const editorBox = await editorViewport.boundingBox()
    expect(editorBox.height).toBeGreaterThanOrEqual(96)
    expect(editorBox.y + editorBox.height).toBeLessThanOrEqual(360)
    await expect(editor).toContainText('Still visible.')
    await expectNoHorizontalOverflow(page)
  })

  test('keeps touch actions, modal focus, and scroll locking accessible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 })
    await signIn(page)

    const noteActions = page.getByRole('button', {
      name: /more actions for welcome to quicknotes/i,
    })
    await expect(noteActions).toBeVisible()
    await noteActions.tap()
    const menu = page.getByRole('menu', { name: 'Note actions' })
    await expect(menu).toBeVisible()
    const menuBox = await menu.boundingBox()
    expect(menuBox.x).toBeGreaterThanOrEqual(7)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(383)
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(657)

    await page.keyboard.press('Escape')
    const settingsTrigger = page.getByRole('button', { name: /show navigation/i }).first()
    await settingsTrigger.tap()
    await page.getByRole('button', { name: /^settings$/i }).first().tap()
    const dialog = page.getByRole('dialog', { name: 'Settings' })
    await expect(dialog).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
    await expect(dialog).toContainText('Settings')
    await dialog.getByRole('button', { name: /close settings/i }).tap()
    await expect(dialog).toHaveCount(0)
    await expect(settingsTrigger).toBeFocused()
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  })

  test('preserves drafts through rotation and browser history navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 })
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().tap()
    const editor = page.locator('.ProseMirror').first()
    await editor.tap()
    await editor.pressSequentially('Draft survives WebKit navigation')

    await page.setViewportSize({ width: 664, height: 390 })
    await expect(editor).toContainText('Draft survives WebKit navigation')
    const toolbarBox = await page.locator('.editor-toolbar').boundingBox()
    expect(toolbarBox.height).toBeLessThanOrEqual(60)

    await page.goBack()
    await expect(page.getByRole('searchbox')).toBeVisible()
    await page.goForward()
    await expect(editor).toContainText('Draft survives WebKit navigation')
  })

  test('uses browser Back to dismiss temporary mobile surfaces first', async ({ page }) => {
    await signIn(page)

    await page.getByRole('button', { name: /show navigation/i }).first().tap()
    const navigation = page.getByRole('dialog', { name: 'Navigation' })
    await expect(navigation).toBeVisible()
    await page.goBack()
    await expect(navigation).toHaveCount(0)
    await expect(page.getByRole('searchbox')).toBeVisible()

    await page.getByRole('button', { name: /show navigation/i }).first().tap()
    await page.getByRole('button', { name: /^settings$/i }).first().tap()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    await page.goBack()
    await expect(settings).toHaveCount(0)
    await expect(page.getByRole('searchbox')).toBeVisible()
  })

  test('declares modern viewport and safe-area behavior for standalone use', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('viewport-fit=cover')

    const support = await page.evaluate(() => ({
      dynamicViewport: CSS.supports('height', '100dvh'),
      safeArea: CSS.supports('padding-bottom', 'env(safe-area-inset-bottom)'),
      touch: matchMedia('(pointer: coarse)').matches,
    }))
    expect(support).toEqual({ dynamicViewport: true, safeArea: true, touch: true })
  })
})
