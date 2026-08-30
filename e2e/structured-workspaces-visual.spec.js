import { test, expect } from '@playwright/test'
import { signIn, expectNoHorizontalOverflow } from './helpers'

const workspaces = [
  { key: 'tasks', type: 'Task List', empty: 'Clean task list', populated: 'Daily priorities', root: '.qn-type-todo' },
  { key: 'project', type: 'Project Board', empty: 'Blank project board', populated: 'Product launch', root: '.qn-type-project' },
  { key: 'meeting', type: 'Meeting Workspace', empty: 'Blank meeting', populated: 'Team sync', root: '.qn-type-meeting' },
  { key: 'journal', type: 'Daily Journal', empty: 'Full daily reflection', populated: 'Evening review', root: '.qn-type-journal' },
  { key: 'ideas', type: 'Idea Board', empty: 'Open idea board', populated: 'Problem solving', root: '.qn-type-brainstorm' },
  { key: 'shopping', type: 'Shopping List', empty: 'Blank shopping list', populated: 'Weekly groceries', root: '.qn-type-shopping' },
  { key: 'weekly', type: 'Weekly Planner', empty: 'Blank week', populated: 'Focused work week', root: '.qn-type-weekly' },
]

async function createWorkspace(page, definition, starter, title) {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${definition.type}`, 'i') })
    .click()
  await dialog.getByText(starter, { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await expect(page.locator(definition.root)).toBeVisible()
}

async function openNote(page, title, root) {
  const back = page.getByRole('button', { name: /back to notes/i })
  if (await back.isVisible().catch(() => false)) await back.click()
  const search = page.getByPlaceholder('Search notes...').first()
  await expect(search).toBeVisible()
  await search.fill(title)
  await page.locator('.note-card', { hasText: title }).click()
  await expect(page.locator(root)).toBeVisible()
}

async function addRepresentativeContent(page, definition) {
  const root = page.locator(definition.root)
  if (definition.key === 'journal') {
    await root.getByRole('button', { name: /^Evening/i }).click()
    await root.getByLabel('Gratitude item 1').fill('A calm start to the day')
    await root.getByLabel('Gratitude item 2').fill('Useful feedback from the team')
    await root.getByLabel('Gratitude item 3').fill('Time to think clearly')
  }
  if (definition.key === 'ideas') {
    for (const idea of ['Interview five users', 'Map the current workflow', 'Prototype the smallest change', 'Measure completion time']) {
      await root.getByLabel('New idea').fill(idea)
      await root.getByRole('button', { name: 'Add Idea' }).click()
    }
  }
}

async function capture(page, testInfo, name) {
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: false })
}

test.describe('structured workspace visual review', () => {
  test.setTimeout(360_000)

  test('captures every empty and populated workspace on desktop, phone, and dark surfaces', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)

    const records = []
    for (const definition of workspaces) {
      const emptyTitle = `Visual empty ${definition.key}`
      await createWorkspace(page, definition, definition.empty, emptyTitle)
      await capture(page, testInfo, `desktop-empty-${definition.key}`)

      const populatedTitle = `Visual populated ${definition.key}`
      await createWorkspace(page, definition, definition.populated, populatedTitle)
      await addRepresentativeContent(page, definition)
      await capture(page, testInfo, `desktop-populated-${definition.key}`)
      records.push({ ...definition, emptyTitle, populatedTitle })
    }

    await page.evaluate(() => localStorage.setItem(
      'quicknotes-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 })
    ))
    await page.reload()
    for (const record of records) {
      await openNote(page, record.populatedTitle, record.root)
      await capture(page, testInfo, `desktop-dark-${record.key}`)
    }

    await page.evaluate(() => localStorage.setItem(
      'quicknotes-theme',
      JSON.stringify({ state: { theme: 'light' }, version: 0 })
    ))
    await page.reload()
    await page.setViewportSize({ width: 390, height: 844 })
    for (const record of records) {
      await openNote(page, record.emptyTitle, record.root)
      await capture(page, testInfo, `phone-empty-${record.key}`)
      await openNote(page, record.populatedTitle, record.root)
      await capture(page, testInfo, `phone-populated-${record.key}`)
    }
  })
})
