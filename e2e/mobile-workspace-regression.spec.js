import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { collectErrors, createNote, dragTouch, expectNoHorizontalOverflow, pinchTouch, signIn } from './helpers'

const workspaces = [
  { type: 'Task List', starter: 'Daily priorities', root: '.qn-type-todo' },
  { type: 'Project Board', starter: 'Product launch', root: '.qn-type-project' },
  { type: 'Meeting Workspace', starter: 'Team sync', root: '.qn-type-meeting' },
  { type: 'Daily Journal', starter: 'Evening review', root: '.qn-type-journal' },
  { type: 'Idea Board', starter: 'Problem solving', root: '.qn-type-brainstorm' },
  { type: 'Shopping List', starter: 'Weekly groceries', root: '.qn-type-shopping' },
  { type: 'Weekly Planner', starter: 'Focused work week', root: '.qn-type-weekly' },
]

const createWorkspace = async (page, definition, title) => {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${definition.type}`, 'i') })
    .click()
  await dialog.getByText(definition.starter, { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await page.locator('.note-card', { hasText: title }).click()
  await expect(page.locator(definition.root)).toBeVisible()
}

const expectContainedOrScrollable = async (root, label) => {
  const offenders = await root.evaluate((container) => {
    const containerBox = container.getBoundingClientRect()
    const isScrollableAncestor = (element) => {
      for (let parent = element.parentElement; parent && parent !== container; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true
      }
      return false
    }
    const isPannableWorldContent = (element) => Boolean(
      element.matches('.qn-spatial-object-world') &&
      element.closest('.qn-spatial-interaction-surface')
    )
    return [...container.querySelectorAll('*')].flatMap((element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      if (
        style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 ||
        box.width < 1 || box.height < 1 || box.bottom < containerBox.top || box.top > containerBox.bottom ||
        style.position === 'fixed' || isScrollableAncestor(element) || isPannableWorldContent(element)
      ) return []
      if (box.left >= containerBox.left - 1 && box.right <= containerBox.right + 1) return []
      return [{
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
        left: Math.round(box.left),
        right: Math.round(box.right),
        containerLeft: Math.round(containerBox.left),
        containerRight: Math.round(containerBox.right),
      }]
    }).slice(0, 12)
  })
  expect(offenders, `${label} has clipped, unreachable horizontal content`).toEqual([])
}

const auditWorkspace = async (page, definition, suffix = '') => {
  const root = page.locator(definition.root)
  await expectNoHorizontalOverflow(page)
  await expectContainedOrScrollable(root, `${definition.type}${suffix}`)
  const writingArea = root.locator('.qn-structured-content').first()
  await expect(writingArea).toBeVisible()
  const [rootBox, writingBox] = await Promise.all([root.boundingBox(), writingArea.boundingBox()])
  expect(writingBox.height, `${definition.type}${suffix} leaves too little phone height for work`)
    .toBeGreaterThanOrEqual(Math.min(140, rootBox.height * 0.28))
  const violations = await new AxeBuilder({ page })
    .include(definition.root)
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(
    violations.violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`),
    `${definition.type}${suffix} accessibility`
  ).toEqual([])
}

test.describe('phone workspace workflow regression', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true })
  test.setTimeout(180_000)

  test('keeps every non-spatial workspace operable, contained, and scrollable', async ({ page, browserName }) => {
    const errors = collectErrors(page)
    await signIn(page)

    for (const [index, definition] of workspaces.entries()) {
      await createWorkspace(page, definition, `Phone workflow ${index + 1}`)
      const root = page.locator(definition.root)
      await auditWorkspace(page, definition)

      if (definition.type === 'Task List') {
        await root.getByLabel('New task').fill('Mobile task')
        await root.getByRole('button', { name: 'Add task', exact: true }).click()
        await expect(root.getByText('Mobile task', { exact: true })).toBeVisible()
      } else if (definition.type === 'Project Board') {
        await root.getByRole('tab', { name: /^Board/i }).click()
        await root.getByRole('button', { name: /actions for define launch goal and audience/i }).click()
        await page.getByRole('menuitem', { name: 'To do', exact: true }).click()
        await expect(root.getByLabel(/to do, 2 tasks/i)).toContainText('Define launch goal and audience')
        await root.getByRole('button', { name: /actions for define launch goal and audience/i }).click()
        await page.getByRole('menuitem', { name: 'Edit details' }).click()
        const dialog = page.getByRole('dialog', { name: 'Edit task' })
        await expect(dialog.getByLabel('Status')).toBeVisible()
        await expectContainedOrScrollable(dialog, 'Project task dialog')
        await dialog.getByRole('button', { name: 'Cancel' }).click()
      } else if (definition.type === 'Meeting Workspace') {
        for (const section of ['Attendees', 'Agenda', 'Notes', 'Capture', 'Action Items', 'Decisions', 'Details']) {
          await root.getByRole('tab', { name: new RegExp(`^${section}`, 'i') }).click()
          await auditWorkspace(page, definition, ` / ${section}`)
        }
      } else if (definition.type === 'Daily Journal') {
        for (const section of ['Check-in & goals', 'During the Day', 'Reflect', 'Write', 'Evening']) {
          await root.getByRole('tab', { name: new RegExp(`^${section}`, 'i') }).click()
          await auditWorkspace(page, definition, ` / ${section}`)
        }
      } else if (definition.type === 'Idea Board') {
        // Chromium exposes the low-level multi-touch protocol needed by the
        // helper. WebKit still exercises the rendered canvas and the complete
        // register workflow; direct iOS gesture coverage lives in the manual
        // phone matrix because Playwright does not synthesize WebKit touch IDs.
        if (browserName === 'chromium') {
          const canvas = root.getByRole('application', { name: /infinite canvas/i })
          const canvasBox = await canvas.boundingBox()
          await dragTouch(page,
            { x: canvasBox.x + 45, y: canvasBox.y + 80 },
            { x: canvasBox.x + 155, y: canvasBox.y + 135 },
            { steps: 10 }
          )
          await expect(root.getByText('Saved on this device')).toBeVisible()
        }
        await root.getByRole('tab', { name: /^Idea register/i }).click()
        await root.getByLabel('New idea').fill('Mobile idea')
        await root.getByRole('button', { name: 'Add idea' }).click()
        await expect(root.getByText('Mobile idea', { exact: true })).toBeVisible()
        await root.getByRole('tab', { name: /^Canvas/i }).click()
      } else if (definition.type === 'Shopping List') {
        await root.getByLabel('Item name').fill('Mobile item')
        await root.getByRole('button', { name: 'Add item', exact: true }).click()
        await expect(root.getByText('Mobile item', { exact: true })).toBeVisible()
        await root.getByRole('button', { name: 'Edit Mobile item' }).click()
        await root.getByLabel(/Estimated price/).last().fill('2.50')
        await expect(root.getByText('Mobile item', { exact: true })).toBeVisible()
      } else if (definition.type === 'Weekly Planner') {
        for (const section of ['Goals', 'Weekly Review', 'Week View']) {
          await root.getByRole('tab', { name: new RegExp(`^${section}`, 'i') }).click()
          await auditWorkspace(page, definition, ` / ${section}`)
        }
      }

      await auditWorkspace(page, definition, ' after interaction')
      await page.setViewportSize({ width: 667, height: 375 })
      await auditWorkspace(page, definition, ' / landscape')
      await page.setViewportSize({ width: 320, height: 420 })
      await auditWorkspace(page, definition, ' / keyboard-height viewport')
      await page.getByRole('button', { name: /back to notes/i }).click()
      await expect(page.getByRole('searchbox', { name: 'Filter this list…', exact: true })).toBeVisible()
      await page.locator('.note-card', { hasText: `Phone workflow ${index + 1}` }).click()
      await expect(root).toBeVisible()
      await page.getByRole('button', { name: /back to notes/i }).click()
      await page.setViewportSize({ width: 320, height: 568 })
    }

    expect(errors).toEqual([])
  })

  test('uses two fingers to zoom the active note without magnifying browser chrome', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright WebKit does not expose multi-touch gesture injection')
    await signIn(page)
    await createNote(page, `Phone pinch ${Date.now()}`)
    const editor = page.getByRole('textbox', { name: 'Note content' })
    const box = await editor.boundingBox()
    const zoom = page.getByRole('button', { name: /Reset zoom\. Current zoom/ })
    await expect(zoom).toHaveAccessibleName('Reset zoom. Current zoom 100%')
    const deviceScale = await page.evaluate(() => window.devicePixelRatio)

    await pinchTouch(
      page,
      { x: box.x + box.width * 0.42, y: box.y + 180 },
      { x: box.x + box.width * 0.58, y: box.y + 180 },
      { x: box.x + box.width * 0.2, y: box.y + 180 },
      { x: box.x + box.width * 0.8, y: box.y + 180 },
    )

    await expect.poll(async () => Number((await zoom.getAttribute('aria-label')).match(/(\d+)%/)?.[1]))
      .toBeGreaterThan(100)
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(deviceScale)
    await expectNoHorizontalOverflow(page)
  })

  test('uses a phone-sized workspace picker without a desktop-width canvas', async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 })
    await signIn(page)
    await page.getByRole('button', { name: 'Create workspace' }).click()

    const dialog = page.getByRole('dialog', { name: /new workspace/i })
    const picker = dialog.locator('.qn-workspace-picker')
    await expect(picker).toHaveAttribute('data-mobile-step', 'choose')
    await expect(dialog.locator('section[aria-label="Workspace types"]')).toBeVisible()
    await expect(dialog.locator('.qn-workspace-picker-configure')).not.toBeVisible()
    await expectContainedOrScrollable(dialog, 'Workspace picker type step')

    await dialog.locator('section[aria-label="Workspace types"]')
      .getByRole('button', { name: /^Project Board/i })
      .click()
    await expect(picker).toHaveAttribute('data-mobile-step', 'configure')
    await expect(dialog.getByRole('button', { name: 'Workspace types' })).toBeVisible()
    await expect(dialog.getByLabel('Note title')).toBeVisible()
    await expectContainedOrScrollable(dialog, 'Workspace picker configuration step')

    await dialog.getByRole('button', { name: 'Workspace types' }).click()
    await expect(picker).toHaveAttribute('data-mobile-step', 'choose')
    await expectNoHorizontalOverflow(page)
  })
})
