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

async function addRepresentativeContent(page, definition) {
  const root = page.locator(definition.root)
  if (definition.key === 'journal') {
    await root.getByRole('tab', { name: /^Evening/i }).click()
    await root.getByLabel('Gratitude item 1').fill('A calm start to the day')
    await root.getByLabel('Gratitude item 2').fill('Useful feedback from the team')
    await root.getByLabel('Gratitude item 3').fill('Time to think clearly')
  }
  if (definition.key === 'ideas') {
    await root.getByRole('tab', { name: /^Idea register/i }).click()
    for (const idea of ['Interview five users', 'Map the current workflow', 'Prototype the smallest change', 'Measure completion time']) {
      await root.getByLabel('New idea').fill(idea)
      await root.getByRole('button', { name: 'Add Idea' }).click()
    }
    await root.getByRole('tab', { name: /^Canvas/i }).click()
  }
}

async function capture(page, testInfo, name) {
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: false })
}

test.describe('structured workspace visual review', () => {
  test.setTimeout(120_000)

  for (const definition of workspaces) {
    test(`captures a populated ${definition.key} workspace on desktop and phone`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await signIn(page)
      const populatedTitle = `Visual populated ${definition.key}`
      await createWorkspace(page, definition, definition.populated, populatedTitle)
      await addRepresentativeContent(page, definition)
      await capture(page, testInfo, `desktop-populated-${definition.key}`)

      if (definition.key === 'ideas') {
        await page.locator(definition.root).getByRole('tab', { name: /^Idea register/i }).click()
        await capture(page, testInfo, 'desktop-populated-idea-register')
        await page.locator(definition.root).getByRole('tab', { name: /^Canvas/i }).click()
      }

      await page.setViewportSize({ width: 390, height: 844 })
      if (!await page.locator(definition.root).isVisible().catch(() => false)) {
        await page.locator('.note-card', { hasText: populatedTitle }).click()
      }
      await expect(page.locator(definition.root)).toBeVisible()
      await capture(page, testInfo, `phone-populated-${definition.key}`)

      if (definition.key === 'ideas') {
        await page.locator(definition.root).getByRole('tab', { name: /^Idea register/i }).click()
        await capture(page, testInfo, 'phone-populated-idea-register')
        await page.locator(definition.root).getByRole('tab', { name: /^Canvas/i }).click()
      }

      await page.setViewportSize({ width: 667, height: 375 })
      await expect(page.locator(definition.root)).toBeVisible()
      await capture(page, testInfo, `phone-landscape-${definition.key}`)
    })
  }
})
