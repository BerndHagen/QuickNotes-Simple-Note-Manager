import { expect, test } from '@playwright/test'
import { createNote, signIn } from './helpers'

test.describe('document page geometry and workspace zoom', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await createNote(page, `Pagination ${Date.now()}`)
  })

  test('renders independent sheets and owns Ctrl+wheel and keyboard zoom', async ({ page }, testInfo) => {
    const editor = page.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.insertText('First page content')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.insertText('Second page content')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.insertText('Third page content')

    const sheets = page.locator('.qn-document-page-sheet')
    await expect(sheets).toHaveCount(3)
    await expect(page.locator('.qn-page-gap__gutter')).toHaveCount(2)

    const geometry = await sheets.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        borderTop: style.borderTopWidth,
        borderBottom: style.borderBottomWidth,
        borderLeft: style.borderLeftWidth,
        borderRight: style.borderRightWidth,
        borderTopColor: style.borderTopColor,
        borderRightColor: style.borderRightColor,
        borderBottomColor: style.borderBottomColor,
        borderLeftColor: style.borderLeftColor,
        shadow: style.boxShadow,
      }
    }))
    expect(geometry[1].top - geometry[0].bottom).toBeGreaterThanOrEqual(23)
    expect(geometry[2].top - geometry[1].bottom).toBeGreaterThanOrEqual(23)
    for (const sheet of geometry) {
      expect(sheet.borderTop).toBe('2px')
      expect(sheet.borderBottom).toBe('2px')
      expect(sheet.borderLeft).toBe('2px')
      expect(sheet.borderRight).toBe('2px')
      expect(new Set([
        sheet.borderTopColor,
        sheet.borderRightColor,
        sheet.borderBottomColor,
        sheet.borderLeftColor,
      ])).toHaveProperty('size', 1)
      expect(sheet.shadow).not.toBe('none')
    }

    const cleanGap = await page.locator('.qn-page-gap__gutter').first().evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      height: element.getBoundingClientRect().height,
      before: getComputedStyle(element, '::before').content,
      after: getComputedStyle(element, '::after').content,
    }))
    expect(cleanGap).toEqual({
      backgroundColor: 'rgba(0, 0, 0, 0)',
      height: 24,
      before: 'none',
      after: 'none',
    })

    const editorChrome = await editor.evaluate((element) => {
      const style = getComputedStyle(element)
      const gutter = element.querySelector('.qn-page-gap__gutter')
      return {
        borderTop: style.borderTopWidth,
        borderBottom: style.borderBottomWidth,
        shadow: style.boxShadow,
        gutterBefore: gutter ? getComputedStyle(gutter, '::before').content : null,
        gutterAfter: gutter ? getComputedStyle(gutter, '::after').content : null,
      }
    })
    expect(editorChrome).toEqual({
      borderTop: '0px',
      borderBottom: '0px',
      shadow: 'none',
      gutterBefore: 'none',
      gutterAfter: 'none',
    })

    const resetZoom = page.getByRole('button', { name: /Reset zoom\. Current zoom/ })
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 100%')
    const deviceScaleBefore = await page.evaluate(() => window.devicePixelRatio)
    await editor.hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 110%')
    await expect.poll(() => sheets.first().evaluate((element) => element.getBoundingClientRect().width))
      .toBeGreaterThan(geometry[0].width * 1.09)
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(deviceScaleBefore)
    await expect(sheets).toHaveCount(3)

    await page.keyboard.press('Control+0')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 100%')
    await page.keyboard.press('Control+=')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 110%')
    await page.keyboard.press('Control+-')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 100%')
    await page.screenshot({
      path: testInfo.outputPath('independent-document-pages.png'),
      fullPage: false,
    })
  })

  test('keeps the same page and zoom model in Focus mode', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    const editor = page.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.insertText('Focus page one')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.insertText('Focus page two')
    await page.waitForTimeout(500)

    await page.keyboard.press('Control+Shift+f')
    const focusMode = page.locator('.qn-focus-mode')
    await expect(focusMode).toBeVisible()
    await expect(focusMode.locator('.qn-document-page-sheet')).toHaveCount(2)

    const resetZoom = focusMode.getByRole('button', { name: /Reset zoom\. Current zoom/ })
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 100%')
    await focusMode.locator('.ProseMirror').hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 110%')

    const sheetGeometry = await focusMode.locator('.qn-document-page-sheet').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { top: rect.top, bottom: rect.bottom }
      })
    )
    expect(sheetGeometry[1].top - sheetGeometry[0].bottom).toBeGreaterThan(25)
  })

  test('applies the same controls and shortcuts to structured workspaces', async ({ page }) => {
    await page.getByRole('button', { name: 'Create workspace' }).click()
    const picker = page.getByRole('dialog', { name: /new workspace/i })
    await picker
      .locator('section[aria-label="Workspace types"]')
      .getByRole('button', { name: /^Task List/i })
      .click()
    await picker.getByText('Daily priorities', { exact: true }).click()
    await picker.getByRole('button', { name: /^Create tasks$/i }).click()

    const fieldset = page.locator('fieldset[data-workspace-zoom]')
    await expect(fieldset).toHaveAttribute('data-workspace-zoom', '1')
    const resetZoom = page.getByRole('button', { name: /Reset zoom\. Current zoom/ })
    await fieldset.hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 110%')
    await expect(fieldset).toHaveAttribute('data-workspace-zoom', '1.1')
    expect(await fieldset.evaluate((element) => getComputedStyle(element).zoom)).toBe('1.1')
  })

  test('preserves independent page edges in dark mode and usable zoom controls on phones', async ({ page }, testInfo) => {
    const editor = page.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.insertText('Dark page one')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.insertText('Dark page two')
    await page.waitForTimeout(400)

    await page.evaluate(() => localStorage.setItem(
      'quicknotes-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 })
    ))
    await page.reload()
    await expect(page.locator('#qn-main')).toBeVisible()
    const sheets = page.locator('.qn-document-page-sheet')
    await expect(sheets).toHaveCount(2)
    await page.locator('.ProseMirror').click()
    const darkEdges = await sheets.evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        colors: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor],
        shadow: style.boxShadow,
      }
    }))
    for (const sheet of darkEdges) {
      expect(sheet.widths).toEqual(['2px', '2px', '2px', '2px'])
      expect(new Set(sheet.colors)).toHaveProperty('size', 1)
      expect(sheet.shadow).not.toBe('none')
    }
    await page.locator('[data-editor-canvas]').evaluate((workbench) => {
      const firstSheet = workbench.querySelector('.qn-document-page-sheet')
      workbench.scrollTop = Math.max(0, firstSheet.offsetHeight - workbench.clientHeight + 160)
    })
    await page.screenshot({ path: testInfo.outputPath('dark-independent-pages.png') })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByText(/^Pagination \d+$/).last().click()
    await expect(page.getByLabel('Note title')).toBeVisible()
    const zoomIn = page.getByRole('button', { name: 'Zoom in' })
    await expect(zoomIn).toBeVisible()
    await zoomIn.click()
    await expect(page.getByRole('button', { name: 'Reset zoom. Current zoom 110%' })).toBeVisible()
    const documentOverflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      editorClientWidth: document.querySelector('[data-editor-canvas]')?.clientWidth,
      editorScrollWidth: document.querySelector('[data-editor-canvas]')?.scrollWidth,
    }))
    expect(documentOverflow.scrollWidth).toBeLessThanOrEqual(documentOverflow.clientWidth + 1)
    expect(documentOverflow.editorScrollWidth).toBeGreaterThan(documentOverflow.editorClientWidth)
  })
})
