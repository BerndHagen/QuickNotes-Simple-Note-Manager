import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expectNoHorizontalOverflow, signIn } from './helpers'

const createTaskWorkspace = async (page, title) => {
  const trigger = page.getByRole('button', { name: 'Create workspace' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator(':focus')).toBeVisible()

  // Repeated Tab and Shift+Tab must remain inside the modal focus trap.
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press('Tab')
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)

  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: /^Task List/i })
    .click()
  await dialog.getByText('Daily priorities', { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await page.locator('.note-card', { hasText: title }).click()
  await expect(page.locator('.qn-type-todo')).toBeVisible()
}

test.describe('real keyboard, reflow, and motion accessibility', () => {
  test('keeps focus ordered through tabs, menus, dialogs, and Escape recovery', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)
    await createTaskWorkspace(page, `Keyboard workflow ${Date.now()}`)

    const root = page.locator('.qn-type-todo')
    const allTab = root.getByRole('tab', { name: /^All/i })
    await allTab.focus()
    await page.keyboard.press('ArrowRight')
    const todayTab = root.getByRole('tab', { name: /^Today/i })
    await expect(todayTab).toBeFocused()
    await expect(todayTab).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    const favouriteTab = root.getByRole('tab', { name: /^Favourites/i })
    await expect(favouriteTab).toBeFocused()
    await expect(favouriteTab).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Home')
    await expect(allTab).toBeFocused()

    const more = page.locator('.qn-ribbon-note-bar').getByRole('button', { name: 'More actions' })
    await more.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu', { name: 'More actions' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu', { name: 'More actions' })).toHaveCount(0)
    await expect(more).toBeFocused()

    await page.getByRole('button', { name: /back to notes/i }).click()
    const createTrigger = page.getByRole('button', { name: 'Create workspace' })
    await createTrigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: /new workspace/i })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(createTrigger).toBeFocused()

    await expectNoHorizontalOverflow(page)
    const violations = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.violations.map((item) => item.id)).toEqual([])
  })

  test('reflows at an equivalent 200% layout width and honours reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 640 })
    await signIn(page)
    await createTaskWorkspace(page, `Reflow workflow ${Date.now()}`)
    await expectNoHorizontalOverflow(page)

    const content = page.locator('.qn-structured-content')
    await expect(content).toBeVisible()
    const canScroll = await content.evaluate((element) => {
      const owner = element.closest('.qn-structured-workspace')
      owner.scrollTop = owner.scrollHeight
      return owner.scrollTop > 0 && owner.scrollTop + owner.clientHeight >= owner.scrollHeight - 2
    })
    expect(canScroll).toBe(true)

    const motion = await page.locator('.qn-structured-tab').first().evaluate((element) => {
      const style = getComputedStyle(element)
      return { transition: style.transitionDuration, animation: style.animationDuration }
    })
    const longestDuration = (value) => Math.max(...value.split(',').map((item) => {
      const numeric = Number.parseFloat(item)
      return item.trim().endsWith('ms') ? numeric : numeric * 1000
    }))
    expect(longestDuration(motion.transition)).toBeLessThanOrEqual(0.01)
    expect(longestDuration(motion.animation)).toBeLessThanOrEqual(0.01)
  })
})
