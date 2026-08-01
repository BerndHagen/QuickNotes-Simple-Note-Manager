import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { collectErrors, expectNoHorizontalOverflow, signIn } from './helpers'

const formatViolations = (violations) =>
  violations
    .map((violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
    )
    .join('\n')

const focusedTypes = [
  {
    type: 'Task List',
    starter: 'Daily priorities',
    className: '.qn-type-todo',
    title: 'Professional daily priorities',
    expectation: /3 tasks remaining/i,
    sections: [],
  },
  {
    type: 'Project Board',
    starter: 'Product launch',
    className: '.qn-type-project',
    title: 'Professional product launch',
    expectation: /3 tasks/i,
    sections: ['Milestones', 'Team', 'Kanban Board'],
  },
  {
    type: 'Meeting Workspace',
    starter: 'Team sync',
    className: '.qn-type-meeting',
    title: 'Professional team sync',
    expectation: /3 agenda items/i,
    sections: ['Attendees', 'Agenda', 'Notes', 'Action Items', 'Decisions', 'Details'],
  },
  {
    type: 'Daily Journal',
    starter: 'Evening review',
    className: '.qn-type-journal',
    title: 'Professional evening review',
    expectation: /3 things i'm grateful for/i,
    sections: ['Morning', 'During the Day', 'Reflect', 'Free Write', 'Evening'],
  },
  {
    type: 'Idea Board',
    starter: 'Problem solving',
    className: '.qn-type-brainstorm',
    title: 'Professional problem solving',
    expectation: /possible cause/i,
    sections: [],
  },
  {
    type: 'Shopping List',
    starter: 'Weekly groceries',
    className: '.qn-type-shopping',
    title: 'Professional grocery plan',
    expectation: /0 of 5 items checked/i,
    sections: [],
  },
  {
    type: 'Weekly Planner',
    starter: 'Focused work week',
    className: '.qn-type-weekly',
    title: 'Professional work week',
    expectation: /goals met/i,
    sections: ['Goals', 'Weekly Review', 'Week View'],
  },
]

async function openPicker(page) {
  await page.getByRole('button', { name: 'Choose a focused note type' }).click()
  const dialog = page.getByRole('dialog', { name: /create a focused note/i })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('focused note types', () => {
  test.setTimeout(120_000)

  test('offers one responsive, accessible creation workflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await signIn(page)
    const dialog = await openPicker(page)

    await expect(dialog.getByLabel('Search note types')).toBeVisible()
    await expect(dialog.getByText('Choose a starting point')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^Create document/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(formatViolations(violations)).toBe('')
  })

  test('creates and renders every specialized workspace with its promised structure', async ({ page }) => {
    const errors = collectErrors(page)
    await signIn(page)

    for (const definition of focusedTypes) {
      const dialog = await openPicker(page)
      const typeList = dialog.locator('section[aria-label="Note types"]')
      await typeList.getByRole('button', { name: new RegExp(`^${definition.type}`, 'i') }).click()
      await dialog.getByText(definition.starter, { exact: true }).click()
      await dialog.getByLabel('Note title').fill(definition.title)
      await dialog.getByRole('button', { name: /^Create / }).click()

      const editor = page.locator(definition.className)
      await expect(editor).toBeVisible()
      await expect(editor.locator('.qn-type-hero input').first()).toHaveValue(definition.title)
      await expect(editor.getByText(definition.expectation).first()).toBeVisible()

      const { violations } = await new AxeBuilder({ page })
        .include(definition.className)
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      expect(formatViolations(violations), `${definition.type} accessibility`).toBe('')

      const toolRail = editor.locator('.qn-type-tabs')
      for (const section of definition.sections) {
        await toolRail.getByRole('button', { name: new RegExp(`^${section}`, 'i') }).click()
        const sectionAudit = await new AxeBuilder({ page })
          .include(definition.className)
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
        expect(
          formatViolations(sectionAudit.violations),
          `${definition.type} / ${section} accessibility`
        ).toBe('')
      }

      if (definition.type === 'Task List') {
        await editor.getByRole('button', { name: /expand details for/i }).first().click()
      }
      if (definition.type === 'Project Board') {
        await editor.getByRole('button', { name: /^Edit /i }).first().click()
        const taskDialog = page.getByRole('dialog', { name: 'Edit task' })
        await expect(taskDialog.getByLabel('Status')).toBeVisible()
        const modalAudit = await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
        expect(formatViolations(modalAudit.violations), 'Project task dialog accessibility').toBe('')
        await taskDialog.getByRole('button', { name: 'Cancel' }).click()
      }
      if (definition.type === 'Idea Board') {
        await editor.getByRole('button', { name: 'List view' }).click()
        await editor.getByRole('button', { name: /possible cause/i }).first().click()
      }
      if (definition.type === 'Shopping List') {
        await editor.getByRole('button', { name: 'Settings' }).click()
      }

      if (['Task List', 'Idea Board', 'Shopping List'].includes(definition.type)) {
        const interactionAudit = await new AxeBuilder({ page })
          .include(definition.className)
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
        expect(
          formatViolations(interactionAudit.violations),
          `${definition.type} expanded controls accessibility`
        ).toBe('')
      }
    }

    expect(errors).toEqual([])
  })

  test('keeps every specialized workspace usable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const errors = collectErrors(page)
    await signIn(page)

    for (const definition of focusedTypes) {
      const dialog = await openPicker(page)
      await dialog
        .locator('section[aria-label="Note types"]')
        .getByRole('button', { name: new RegExp(`^${definition.type}`, 'i') })
        .click()
      await dialog.getByText(definition.starter, { exact: true }).click()
      const mobileTitle = `Mobile ${definition.title}`
      await dialog.getByLabel('Note title').fill(mobileTitle)
      await dialog.getByRole('button', { name: /^Create / }).click()
      await page.locator('.note-card', { hasText: mobileTitle }).click()

      const editor = page.locator(definition.className)
      await expect(editor).toBeVisible()
      await expectNoHorizontalOverflow(page)

      const controls = await editor.locator('button:visible').evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect()
          return {
            name: button.getAttribute('aria-label') || button.textContent?.trim(),
            width: box.width,
            height: box.height,
          }
        })
      )
      for (const control of controls) {
        expect(control.width, `${definition.type}: ${control.name} collapses horizontally`).toBeGreaterThanOrEqual(24)
        expect(control.height, `${definition.type}: ${control.name} collapses vertically`).toBeGreaterThanOrEqual(24)
      }

      await page.getByRole('button', { name: /back to notes/i }).click()
      await expect(page.getByRole('searchbox')).toBeVisible()
    }

    expect(errors).toEqual([])
  })
})
