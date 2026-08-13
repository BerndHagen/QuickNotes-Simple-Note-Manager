import { test, expect } from '@playwright/test'
import { signIn, collectErrors, expectNoHorizontalOverflow, VIEWPORTS } from './helpers'

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('renders without horizontal overflow or console errors', async ({ page }) => {
      const errors = collectErrors(page)
      await signIn(page)
      await expectNoHorizontalOverflow(page)
      expect(errors).toEqual([])
    })

    test('keeps dialog actions reachable inside the viewport', async ({ page }) => {
      await signIn(page)

      // The sidebar is a drawer below 1024px; open it before using it.
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: /show navigation/i }).first().click()
      }
      await page.getByRole('button', { name: /^settings$/i }).first().click()

      if (viewport.width < 1024) {
        await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
      }
      const dialog = page.getByRole('dialog', { name: 'Settings' })
      await expect(dialog).toBeVisible()

      const box = await dialog.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(-1)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)

      await expectNoHorizontalOverflow(page)
    })
  })
}

test.describe('desktop application boundary', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('uses the browser viewport instead of a decorative inner window', async ({ page }) => {
    await signIn(page)

    const boundary = await page.locator('.qn-workspace-frame').evaluate((element) => {
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
      }
    })

    expect(boundary).toEqual({
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      borderRadius: '0px',
      boxShadow: 'none',
    })

    const sidebar = await page.locator('#qn-sidebar').boundingBox()
    expect(sidebar.x).toBe(0)
    expect(sidebar.y).toBe(0)
    expect(sidebar.height).toBe(900)
  })
})

test.describe('compact navigation', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

  test('shows one pane at a time and navigates between them', async ({ page }) => {
    await signIn(page)

    // The note list is the landing pane; the editor is off-screen.
    await expect(page.getByRole('searchbox')).toBeVisible()

    await page.getByRole('button', { name: /new note/i }).first().click()
    // Creating a note switches to the editor pane, which offers a way back.
    const back = page.getByRole('button', { name: /back to notes/i })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page.getByRole('searchbox')).toBeVisible()
  })

  test('sidebar opens as an overlay drawer and closes after navigating', async ({ page }) => {
    await signIn(page)

    const nav = page.getByRole('navigation', { name: 'Workspace' })
    await page.getByRole('button', { name: /show navigation/i }).first().click()
    await expect(nav.getByRole('button', { name: /^all notes/i })).toBeVisible()

    await nav.getByRole('button', { name: /^favorites/i }).click()
    // Navigating dismisses the drawer so the list is usable again.
    await expect(page.getByRole('searchbox')).toBeVisible()
  })

  test('exposes note actions without requiring hover or long press', async ({ page }) => {
    await signIn(page)

    const actions = page.getByRole('button', { name: /more actions for welcome to quicknotes/i })
    await expect(actions).toBeVisible()
    const box = await actions.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(36)
    expect(box.height).toBeGreaterThanOrEqual(36)

    await actions.click()
    await expect(page.getByRole('menu', { name: 'Note actions' })).toBeVisible()
  })
})

test.describe('small-screen settings', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true })

  test('keeps every settings section and its final control reachable', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /show navigation/i }).first().click()
    await page.getByRole('button', { name: /^settings$/i }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Settings' })
    const sections = dialog.getByRole('navigation', { name: 'Settings sections' })
    const sectionButtons = sections.getByRole('button')
    const sectionCount = await sectionButtons.count()

    expect(sectionCount).toBeGreaterThan(4)

    for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
      const sectionButton = sectionButtons.nth(sectionIndex)
      const sectionName = (await sectionButton.innerText()).trim()
      await sectionButton.click()
      await expect(sectionButton).toHaveAttribute('aria-current', 'page')

      const pane = dialog.locator('[data-settings-pane]')
      const paneMetrics = await pane.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      expect(
        paneMetrics.scrollWidth,
        `${sectionName} settings pane hides content beyond its ${paneMetrics.clientWidth}px width`
      ).toBeLessThanOrEqual(paneMetrics.clientWidth + 1)

      const controls = pane.locator('button, input, select, textarea, a[href], p, kbd, h4')
      const controlCount = await controls.count()
      let firstVisibleControl = null
      let lastVisibleControl = null
      for (let controlIndex = 0; controlIndex < controlCount; controlIndex += 1) {
        const control = controls.nth(controlIndex)
        if (!(await control.isVisible())) continue

        firstVisibleControl ||= control
        lastVisibleControl = control

        await control.scrollIntoViewIfNeeded()
        const [controlBox, paneBox] = await Promise.all([control.boundingBox(), pane.boundingBox()])
        expect(controlBox, `${sectionName} contains a control without a rendered box`).not.toBeNull()
        expect(paneBox).not.toBeNull()
        expect(controlBox.x, `${sectionName} contains a control clipped on the left`).toBeGreaterThanOrEqual(
          paneBox.x - 1
        )
        expect(
          controlBox.x + controlBox.width,
          `${sectionName} contains a control clipped on the right`
        ).toBeLessThanOrEqual(paneBox.x + paneBox.width + 1)
      }

      expect(firstVisibleControl, `${sectionName} has no usable content`).not.toBeNull()
      expect(lastVisibleControl, `${sectionName} has no final content item`).not.toBeNull()

      await firstVisibleControl.scrollIntoViewIfNeeded()
      const firstBox = await firstVisibleControl.boundingBox()
      const paneAtStart = await pane.boundingBox()
      expect(firstBox.y, `${sectionName} first control is clipped above the pane`).toBeGreaterThanOrEqual(
        paneAtStart.y - 1
      )

      await lastVisibleControl.scrollIntoViewIfNeeded()
      const [lastBox, paneAtEnd] = await Promise.all([
        lastVisibleControl.boundingBox(),
        pane.boundingBox(),
      ])
      expect(lastBox.y + lastBox.height, `${sectionName} final control cannot be reached`).toBeLessThanOrEqual(
        paneAtEnd.y + paneAtEnd.height + 1
      )
    }

    await expectNoHorizontalOverflow(page)
  })

  test('remains scrollable when the viewport shrinks around a focused control', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /show navigation/i }).first().click()
    await page.getByRole('button', { name: /^settings$/i }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Settings' })
    const pane = dialog.locator('[data-settings-pane]')
    const sort = pane.getByLabel(/default sort order/i)
    await sort.focus()
    await page.setViewportSize({ width: 320, height: 360 })
    await sort.scrollIntoViewIfNeeded()

    const [controlBox, paneBox] = await Promise.all([sort.boundingBox(), pane.boundingBox()])
    expect(controlBox.y).toBeGreaterThanOrEqual(paneBox.y - 1)
    expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(paneBox.y + paneBox.height + 1)
    await expect(sort).toBeFocused()
  })

  test('handles translated labels and enlarged text without sideways page scrolling', async ({ page }) => {
    await page.addStyleTag({ content: 'html { font-size: 125%; }' })
    await signIn(page)
    await page.getByRole('button', { name: /show navigation/i }).first().click()
    await page.getByRole('button', { name: /^settings$/i }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Settings' })
    await dialog.getByRole('button', { name: /Deutsch/i }).click()
    const pane = dialog.locator('[data-settings-pane]')
    const metrics = await pane.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
    await expectNoHorizontalOverflow(page)
  })
})

test.describe('mobile editor usability', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true })

  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().click()
    await page.getByRole('button', { name: /show formatting tools/i }).click()
    await expect(page.locator('.editor-toolbar')).toBeVisible()
  })

  test('keeps the toolbar compact while every command remains reachable', async ({ page }) => {
    const toolbar = page.locator('.editor-toolbar')
    const tabs = page.getByRole('tablist', { name: 'Editor ribbon' })
    let commandCount = 0
    for (const tabName of ['Home', 'Insert', 'Format', 'Layout', 'Tools']) {
      await tabs.getByRole('tab', { name: tabName }).click()
      const metrics = await toolbar.evaluate((element) => {
        const toolbarBox = element.getBoundingClientRect()
        const visibleButtons = [...element.querySelectorAll('button')].filter((button) => button.offsetParent !== null)
        const results = []
        for (const button of visibleButtons) {
          button.scrollIntoView({ block: 'nearest', inline: 'nearest' })
          const box = button.getBoundingClientRect()
          results.push({
            label: button.getAttribute('aria-label'),
            left: box.left,
            right: box.right,
            width: box.width,
            height: box.height,
          })
        }
        return {
          height: toolbarBox.height,
          rows: new Set(visibleButtons.map((button) => Math.round(button.getBoundingClientRect().top))).size,
          results,
        }
      })

      expect(metrics.height).toBeLessThanOrEqual(61)
      expect(metrics.rows).toBe(1)
      commandCount += metrics.results.length
      for (const command of metrics.results) {
        expect(command.label, 'Every toolbar button needs an accessible name').toBeTruthy()
        expect(command.left, `${command.label} is clipped on the left`).toBeGreaterThanOrEqual(-1)
        expect(command.right, `${command.label} is clipped on the right`).toBeLessThanOrEqual(321)
        expect(command.width, `${command.label} is too narrow for touch`).toBeGreaterThanOrEqual(44)
        expect(command.height, `${command.label} is too short for touch`).toBeGreaterThanOrEqual(44)
      }
    }
    expect(commandCount).toBeGreaterThan(30)

    const editorViewport = page.locator('.ProseMirror').locator('xpath=../..')
    const editorBox = await editorViewport.boundingBox()
    expect(editorBox.height).toBeGreaterThanOrEqual(280)
    await expectNoHorizontalOverflow(page)
  })

  test('keeps formatting popovers inside the visible viewport', async ({ page }) => {
    await page.getByRole('tab', { name: 'Format' }).click()
    await page.getByRole('button', { name: 'Text Color' }).click()
    const dropdown = page.getByRole('dialog', { name: 'Formatting options' })
    await expect(dropdown).toBeVisible()

    const box = await dropdown.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(7)
    expect(box.x + box.width).toBeLessThanOrEqual(313)
    expect(box.y).toBeGreaterThanOrEqual(7)
    expect(box.y + box.height).toBeLessThanOrEqual(561)
  })

  test('retains a usable focused editing region when keyboard space is approximated', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first()
    await editor.click()
    await editor.pressSequentially('Visible while typing')
    await page.setViewportSize({ width: 320, height: 360 })

    const editorViewport = editor.locator('xpath=../..')
    const box = await editorViewport.boundingBox()
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(360)
    expect(box.height).toBeGreaterThanOrEqual(96)
    await expect(editor).toBeFocused()
  })

  test('keeps selected-image controls touch accessible and inside the editor', async ({ page }) => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.getByRole('button', { name: 'Insert image' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Insert image' })
    await dialog.getByRole('radio', { name: 'Upload file' }).click()
    await dialog.getByLabel('Choose image file').setInputFiles({
      name: 'mobile-control.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64'
      ),
    })
    await expect(dialog.getByText('Preview')).toBeVisible()
    await dialog.getByRole('button', { name: 'Insert image' }).click()

    const image = page.locator('.ProseMirror img').last()
    await image.click()
    const controls = page.locator('.image-menu')
    await expect(controls).toBeVisible()

    const metrics = await controls.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const buttons = [...element.querySelectorAll('button')]
      buttons.at(-1)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const lastBox = buttons.at(-1)?.getBoundingClientRect()
      return {
        left: box.left,
        right: box.right,
        buttonCount: buttons.length,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        lastLeft: lastBox?.left,
        lastRight: lastBox?.right,
      }
    })
    expect(metrics.left).toBeGreaterThanOrEqual(-1)
    expect(metrics.right).toBeLessThanOrEqual(321)
    expect(metrics.buttonCount).toBeGreaterThan(10)
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
    expect(metrics.lastLeft).toBeGreaterThanOrEqual(-1)
    expect(metrics.lastRight).toBeLessThanOrEqual(321)
  })

  test('uses browser Back and Forward to switch between notes and the editor', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first()
    await editor.click()
    await editor.pressSequentially('Draft kept across mobile navigation')

    await page.goBack()
    await expect(page.getByRole('searchbox')).toBeVisible()
    await page.goForward()
    await expect(editor).toContainText('Draft kept across mobile navigation')
  })
})

test.describe('phone landscape editor', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true })

  test('preserves meaningful writing height without wrapping the toolbar', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().click()

    const toolbar = page.locator('.editor-toolbar')
    const editorViewport = page.locator('.ProseMirror').locator('xpath=../..')
    await expect(toolbar).toBeHidden()
    const collapsedEditorBox = await editorViewport.boundingBox()
    expect(collapsedEditorBox.height).toBeGreaterThanOrEqual(220)

    await page.getByRole('button', { name: /show formatting tools/i }).click()
    const [toolbarBox, editorBox] = await Promise.all([toolbar.boundingBox(), editorViewport.boundingBox()])
    expect(toolbarBox.height).toBeLessThanOrEqual(61)
    expect(editorBox.height).toBeGreaterThanOrEqual(145)
    await expectNoHorizontalOverflow(page)
  })
})

test.describe('large desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('caps editor line length instead of stretching edge to edge', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().click()

    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toBeVisible()
    const box = await editor.boundingBox()
    // Text should stay readable rather than running the full 1920px.
    expect(box.width).toBeLessThan(1400)
  })

  test('keeps the layout selector available after switching to the expanded grid', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Grid view' }).click()

    const selector = page.getByRole('group', { name: 'View mode' })
    await expect(selector).toBeVisible()
    await expect(selector.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true')

    await selector.getByRole('button', { name: 'List view' }).click()
    await expect(page.getByRole('searchbox')).toBeVisible()
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('desktop editor tools', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('shows every formatting tool without horizontal scrolling', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().click()

    const toolbar = page.locator('.editor-toolbar')
    await expect(toolbar).toBeVisible()
    const tabs = page.getByRole('tablist', { name: 'Editor ribbon' })
    for (const tabName of ['Home', 'Insert', 'Format', 'Layout', 'Tools']) {
      await tabs.getByRole('tab', { name: tabName }).click()
      const metrics = await toolbar.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      expect(metrics.scrollWidth, `${tabName} commands should fit the desktop editor`).toBeLessThanOrEqual(metrics.clientWidth + 1)
    }
  })

  test('renders readable tooltips and distinct paper focus, selection, and hover states', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /new note/i }).first().click()

    const bold = page.getByRole('button', { name: 'Bold' })
    await bold.hover()
    const tooltip = page.getByRole('tooltip', { name: /Bold/ })
    await expect(tooltip).toContainText('Bold')
    const contrast = await tooltip.evaluate((element) => {
      const parse = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
      const luminance = (rgb) => {
        const channels = rgb.map((value) => {
          const normalized = value / 255
          return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
      }
      const style = getComputedStyle(element)
      const foreground = luminance(parse(style.color))
      const background = luminance(parse(style.backgroundColor))
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    })
    expect(contrast).toBeGreaterThanOrEqual(4.5)

    await page.getByRole('tab', { name: 'Layout' }).click()
    await page.getByRole('button', { name: 'Paper Style' }).click()
    const paperMenu = page.getByRole('dialog', { name: 'Formatting options' })
    const plain = paperMenu.getByRole('button', { name: 'Plain' })
    await expect(plain).toBeFocused()
    await expect(plain).toHaveAttribute('aria-pressed', 'true')
    const inset = await Promise.all([paperMenu.boundingBox(), plain.boundingBox()])
    expect(inset[1].x).toBeGreaterThan(inset[0].x)
    expect(inset[1].x + inset[1].width).toBeLessThan(inset[0].x + inset[0].width)

    const lined = paperMenu.getByRole('button', { name: 'Lined', exact: true })
    const backgroundBefore = await lined.evaluate((element) => getComputedStyle(element).backgroundColor)
    await lined.hover()
    await expect.poll(
      () => lined.evaluate((element) => getComputedStyle(element).backgroundColor)
    ).not.toBe(backgroundBefore)
  })

  test('keeps complete tool groups in stable tabs at every desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 })
    await signIn(page)
    await page.getByRole('heading', { name: 'Welcome to QuickNotes' }).click()

    const toolbar = page.locator('.editor-toolbar')
    await expect(toolbar.getByRole('button', { name: 'Strikethrough' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Align Left' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Paper Style' })).toBeHidden()
    await page.getByRole('tab', { name: 'Layout' }).click()
    await expect(toolbar.getByRole('button', { name: 'Paper Style' })).toBeVisible()

    await page.setViewportSize({ width: 2560, height: 1080 })
    await expect(toolbar.getByRole('button', { name: 'Paper Style' })).toBeVisible()
    const metrics = await toolbar.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  })
})
