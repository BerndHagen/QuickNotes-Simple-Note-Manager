import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { collectErrors, createNote, expectNoHorizontalOverflow, pinchTouch, signIn } from './helpers'

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
    return [...container.querySelectorAll('*')].flatMap((element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      if (
        style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 ||
        box.width < 1 || box.height < 1 || box.bottom < containerBox.top || box.top > containerBox.bottom ||
        style.position === 'fixed' || isScrollableAncestor(element)
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
  const writingArea = root.locator('.qn-workspace-canvas, .qn-task-list').first()
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

  test('keeps every non-spatial workspace operable, contained, and scrollable', async ({ page }) => {
    const errors = collectErrors(page)
    await signIn(page)

    for (const [index, definition] of workspaces.entries()) {
      await createWorkspace(page, definition, `Phone workflow ${index + 1}`)
      const root = page.locator(definition.root)
      await auditWorkspace(page, definition)

      if (definition.type === 'Task List') {
        await root.getByLabel('New task').fill('Mobile task')
        await root.getByRole('button', { name: 'Add', exact: true }).click()
        await expect(root.getByText('Mobile task', { exact: true })).toBeVisible()
      } else if (definition.type === 'Project Board') {
        await root.getByRole('button', { name: /^Edit / }).first().click()
        const dialog = page.getByRole('dialog', { name: 'Edit task' })
        await expect(dialog.getByLabel('Status')).toBeVisible()
        await expectContainedOrScrollable(dialog, 'Project task dialog')
        await dialog.getByRole('button', { name: 'Cancel' }).click()
      } else if (definition.type === 'Meeting Workspace') {
        for (const section of ['Attendees', 'Agenda', 'Notes', 'Action Items', 'Decisions', 'Details']) {
          await root.getByRole('button', { name: new RegExp(`^${section}`, 'i') }).click()
          await auditWorkspace(page, definition, ` / ${section}`)
        }
      } else if (definition.type === 'Daily Journal') {
        for (const section of ['Check-in & goals', 'During the Day', 'Reflect', 'Write', 'Evening']) {
          await root.getByRole('button', { name: new RegExp(`^${section}`, 'i') }).click()
          await auditWorkspace(page, definition, ` / ${section}`)
        }
      } else if (definition.type === 'Idea Board') {
        await root.getByLabel('New idea').fill('Mobile idea')
        await root.getByRole('button', { name: 'Add Idea' }).click()
        await expect(root.getByText('Mobile idea', { exact: true })).toBeVisible()
      } else if (definition.type === 'Shopping List') {
        await root.getByLabel('New shopping item').fill('Mobile item')
        await root.getByRole('button', { name: 'Add', exact: true }).click()
        await expect(root.getByText('Mobile item', { exact: true })).toBeVisible()
      } else if (definition.type === 'Weekly Planner') {
        for (const section of ['Goals', 'Weekly Review', 'Week View']) {
          await root.getByRole('button', { name: new RegExp(`^${section}`, 'i') }).click()
          await auditWorkspace(page, definition, ` / ${section}`)
        }
      }

      await auditWorkspace(page, definition, ' after interaction')
      await page.getByRole('button', { name: /back to notes/i }).click()
      await expect(page.getByRole('searchbox')).toBeVisible()
    }

    expect(errors).toEqual([])
  })

  test('uses two fingers to zoom the active note without magnifying browser chrome', async ({ page }) => {
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
})
