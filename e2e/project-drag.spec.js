import { expect, test } from '@playwright/test'
import { dragTouch, signIn } from './helpers'

test.use({ hasTouch: true })

const createProject = async (page, title) => {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: /^Project Board/i }).click()
  await dialog.getByText('Product launch', { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await page.locator('.qn-type-project').getByRole('tab', { name: /^Board/i }).click()
}

const dragMouse = async (page, source, target) => {
  const [from, to] = await Promise.all([source.boundingBox(), target.boundingBox()])
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 8, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(90, to.height / 2), { steps: 14 })
  await page.mouse.up()
}

const projectColumn = (board, id) => board.locator(`.qn-project-column[data-column="${id}"]`)

test('moves project tasks by real mouse and held-touch drag, then persists the result', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  const title = `Project drag ${Date.now()}`
  await createProject(page, title)
  const board = page.locator('.qn-type-project')
  const backlog = projectColumn(board, 'backlog')
  const todo = projectColumn(board, 'todo')

  await dragMouse(
    page,
    backlog.getByRole('button', { name: /move define launch goal and audience/i }),
    todo,
  )
  await expect(todo).toContainText('Define launch goal and audience')
  await expect(board.locator('[aria-live="polite"]')).toHaveText(/moved to (?:position \d+ in )?to do/i)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.note-card', { hasText: title }).click()
  await expect(board).toBeVisible()
  await board.getByRole('tab', { name: /^Board/i }).click()
  const todoOnPhone = projectColumn(board, 'todo')
  const inProgress = projectColumn(board, 'inProgress')
  const handle = todoOnPhone.getByRole('button', { name: /move complete launch-readiness review/i })
  const boardRail = board.locator('.qn-project-board')
  await boardRail.evaluate((rail) => {
    const sourceColumn = rail.querySelector('[data-column="todo"]')
    rail.scrollLeft = Math.max(0, sourceColumn.offsetLeft - 16)
  })
  await expect(handle).toBeInViewport()
  const [handleBox, inProgressBox] = await Promise.all([handle.boundingBox(), inProgress.boundingBox()])
  const startPoint = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 }
  const startHit = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y)
    return hit?.closest?.('.qn-project-drag-handle')?.getAttribute('aria-label') || hit?.outerHTML || ''
  }, startPoint)
  expect(startHit).toContain('Move Complete launch-readiness review')
  let activeTouchDrag = null
  await dragTouch(
    page,
    startPoint,
    { x: Math.min(374, inProgressBox.x + 38), y: inProgressBox.y + Math.min(70, inProgressBox.height / 2) },
    {
      steps: 18,
      holdMs: 240,
      stepDelayMs: 16,
      beforeRelease: async () => {
        activeTouchDrag = await page.evaluate(() => ({
          preview: document.querySelector('.qn-project-task-preview')?.textContent || '',
          target: document.querySelector('.qn-project-column--target')?.getAttribute('data-column') || '',
        }))
      },
    },
  )
  expect(activeTouchDrag).toEqual(expect.objectContaining({
    preview: expect.stringContaining('Complete launch-readiness review'),
    target: 'inProgress',
  }))
  await expect(inProgress).toContainText('Complete launch-readiness review')
  await expect(board.locator('[aria-live="polite"]')).toHaveText(/moved to (?:position \d+ in )?in progress/i)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.qn-type-project')).toBeVisible()
  await page.locator('.qn-type-project').getByRole('tab', { name: /^Board/i }).click()
  await expect(projectColumn(page.locator('.qn-type-project'), 'inProgress'))
    .toContainText('Complete launch-readiness review')
})
