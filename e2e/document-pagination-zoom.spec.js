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
    const edges = page.locator('.qn-document-page-edge')
    await expect(sheets).toHaveCount(3)
    await expect(edges).toHaveCount(3)
    await expect(page.locator('.qn-page-gap__gutter')).toHaveCount(2)

    const geometry = await edges.evaluateAll((elements) => elements.map((element) => {
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

    const cleanGap = await page.locator('.qn-document-page-gutter').first().evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      height: element.getBoundingClientRect().height,
      before: getComputedStyle(element, '::before').content,
      after: getComputedStyle(element, '::after').content,
    }))
    expect(cleanGap.height).toBe(24)
    expect(cleanGap.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(cleanGap.before).toBe('none')
    expect(cleanGap.after).toBe('none')

    const editorChrome = await editor.evaluate((element) => {
      const style = getComputedStyle(element)
      const gutter = element.closest('.qn-editor-page')?.querySelector('.qn-document-page-gutter')
      const flowGutter = element.querySelector('.qn-page-gap__gutter')
      const sheetLayer = element.closest('.qn-editor-page')?.querySelector('.qn-document-page-sheets')
      const sheet = sheetLayer?.querySelector('.qn-document-page-sheet')
      const edge = sheetLayer?.querySelector('.qn-document-page-edge')
      return {
        borderTop: style.borderTopWidth,
        borderBottom: style.borderBottomWidth,
        shadow: style.boxShadow,
        overflowX: style.overflowX,
        gutterZIndex: gutter ? getComputedStyle(gutter).zIndex : null,
        sheetLayerZIndex: sheetLayer ? getComputedStyle(sheetLayer).zIndex : null,
        sheetZIndex: sheet ? getComputedStyle(sheet).zIndex : null,
        edgeZIndex: edge ? getComputedStyle(edge).zIndex : null,
        gutterBefore: gutter ? getComputedStyle(gutter, '::before').content : null,
        gutterAfter: gutter ? getComputedStyle(gutter, '::after').content : null,
        flowGutterBackground: flowGutter ? getComputedStyle(flowGutter).backgroundColor : null,
      }
    })
    expect(editorChrome).toEqual({
      borderTop: '0px',
      borderBottom: '0px',
      shadow: 'none',
      overflowX: 'clip',
      gutterZIndex: '2',
      sheetLayerZIndex: 'auto',
      sheetZIndex: '0',
      edgeZIndex: '3',
      gutterBefore: 'none',
      gutterAfter: 'none',
      flowGutterBackground: 'rgba(0, 0, 0, 0)',
    })

    const resetZoom = page.getByRole('button', { name: /Reset zoom\. Current zoom/ })
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 100%')
    const deviceScaleBefore = await page.evaluate(() => window.devicePixelRatio)
    await editor.hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 110%')
    await expect.poll(() => edges.first().evaluate((element) => element.getBoundingClientRect().width))
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
    await expect(focusMode.locator('.qn-document-page-edge')).toHaveCount(2)

    const resetZoom = focusMode.getByRole('button', { name: /Reset zoom\. Current zoom/ })
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 100%')
    await focusMode.locator('.ProseMirror').hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(resetZoom).toHaveAccessibleName('Reset zoom. Current zoom 110%')

    const sheetGeometry = await focusMode.locator('.qn-document-page-edge').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { top: rect.top, bottom: rect.bottom }
      })
    )
    expect(sheetGeometry[1].top - sheetGeometry[0].bottom).toBeGreaterThan(25)
  })

  test('aligns automatic checklist page gaps exactly between independent sheets', async ({ page }, testInfo) => {
    const editor = page.locator('.ProseMirror')
    await page.getByRole('button', { name: /Create checklist with current style/i }).click()
    await page.keyboard.press('Escape')
    await editor.focus()

    const item = 'A deliberately long checklist entry that wraps onto several visual lines and must stay inside one measured document sheet without exposing the workbench before the page edge.'
    for (let index = 0; index < 28; index += 1) {
      await page.keyboard.insertText(`${index + 1}. ${item}`)
      if (index < 27) await page.keyboard.press('Enter')
    }

    const gutters = page.locator('.qn-page-gap__gutter')
    await expect.poll(() => gutters.count()).toBeGreaterThan(0)
    await gutters.first().scrollIntoViewIfNeeded()
    const geometry = await page.locator('.qn-editor-page').evaluate((root) => {
      const rect = (element) => {
        const bounds = element.getBoundingClientRect()
        return { top: bounds.top, bottom: bounds.bottom, height: bounds.height }
      }
      return {
        edges: [...root.querySelectorAll('.qn-document-page-edge')].map(rect),
        gutters: [...root.querySelectorAll('.qn-document-page-gutter')].map(rect),
        flowGutters: [...root.querySelectorAll('.qn-page-gap__gutter')].map((element) => getComputedStyle(element).backgroundColor),
      }
    })

    expect(geometry.edges.length).toBe(geometry.gutters.length + 1)
    expect(new Set(geometry.flowGutters)).toEqual(new Set(['rgba(0, 0, 0, 0)']))
    geometry.gutters.forEach((gutter, index) => {
      expect(Math.abs(gutter.top - geometry.edges[index].bottom)).toBeLessThanOrEqual(1)
      expect(Math.abs(gutter.bottom - geometry.edges[index + 1].top)).toBeLessThanOrEqual(1)
      expect(gutter.height).toBeCloseTo(24, 0)
    })

    await editor.hover()
    await page.keyboard.press('Control+=')
    await page.keyboard.press('Control+=')
    const zoomedGeometry = await page.locator('.qn-editor-page').evaluate((root) => {
      const bounds = (element) => {
        const rectangle = element.getBoundingClientRect()
        return { top: rectangle.top, bottom: rectangle.bottom }
      }
      return {
        edges: [...root.querySelectorAll('.qn-document-page-edge')].map(bounds),
        gutters: [...root.querySelectorAll('.qn-document-page-gutter')].map(bounds),
      }
    })
    zoomedGeometry.gutters.forEach((gutter, index) => {
      expect(Math.abs(gutter.top - zoomedGeometry.edges[index].bottom)).toBeLessThanOrEqual(1)
      expect(Math.abs(gutter.bottom - zoomedGeometry.edges[index + 1].top)).toBeLessThanOrEqual(1)
    })

    await page.screenshot({
      path: testInfo.outputPath('automatic-checklist-pages.png'),
      fullPage: false,
    })

    // This is the legacy-note failure mode from the field report: the same
    // long checklist must reconstruct identical sheet/gutter ownership after
    // it has been persisted and opened in a fresh document session.
    const expectedPageCount = geometry.edges.length
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.locator('#qn-main')).toBeVisible()
    await expect(page.locator('.ProseMirror')).toContainText('28. A deliberately long checklist entry')
    await expect(page.locator('.qn-document-page-edge')).toHaveCount(expectedPageCount)
    const reopenedGeometry = await page.locator('.qn-editor-page').evaluate((root) => {
      const bounds = (element) => {
        const rectangle = element.getBoundingClientRect()
        return { top: rectangle.top, bottom: rectangle.bottom, height: rectangle.height }
      }
      return {
        zoom: Number.parseFloat(getComputedStyle(root).zoom) || 1,
        edges: [...root.querySelectorAll('.qn-document-page-edge')].map(bounds),
        gutters: [...root.querySelectorAll('.qn-document-page-gutter')].map(bounds),
      }
    })
    expect(reopenedGeometry.edges.length).toBe(reopenedGeometry.gutters.length + 1)
    reopenedGeometry.gutters.forEach((gutter, index) => {
      expect(Math.abs(gutter.top - reopenedGeometry.edges[index].bottom)).toBeLessThanOrEqual(1)
      expect(Math.abs(gutter.bottom - reopenedGeometry.edges[index + 1].top)).toBeLessThanOrEqual(1)
      expect(gutter.height).toBeCloseTo(24 * reopenedGeometry.zoom, 0)
    })
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

  test('owns desktop zoom across the complete Paper workspace', async ({ page }) => {
    await page.getByRole('button', { name: 'Create workspace' }).click()
    const picker = page.getByRole('dialog', { name: /new workspace/i })
    await picker
      .locator('section[aria-label="Workspace types"]')
      .getByRole('button', { name: /^Paper/i })
      .click()
    await picker.getByLabel('Note title').fill('Paper zoom boundary')
    await picker.getByRole('button', { name: /^Create paper$/i }).click()
    await page.locator('.note-card', { hasText: 'Paper zoom boundary' }).click()

    const zoom = page.getByLabel('Current zoom')
    const deviceScaleBefore = await page.evaluate(() => window.devicePixelRatio)
    await expect(zoom).toHaveText(/80%/)

    await page.getByRole('complementary', { name: 'Paper pages' })
      .getByRole('button', { name: 'Add page', exact: true })
      .hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(zoom).toHaveText(/90%/)
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(deviceScaleBefore)

    await page.keyboard.press('Control+0')
    await expect(zoom).toHaveText(/100%/)
    await page.keyboard.press('Control+-')
    await expect(zoom).toHaveText(/90%/)
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
    const edges = page.locator('.qn-document-page-edge')
    await expect(sheets).toHaveCount(2)
    await expect(edges).toHaveCount(2)
    await page.locator('.ProseMirror').click()
    const darkEdges = await edges.evaluateAll((elements) => elements.map((element) => {
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
