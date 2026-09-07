import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expectNoHorizontalOverflow, signIn } from './helpers'

const createWorkspace = async (page, type, starter, title) => {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${type}`, 'i') })
    .click()
  await dialog.getByText(starter, { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await page.locator('.note-card', { hasText: title }).click()
}

test.describe('shared workspace interface contracts', () => {
  test('uses the application width and one canonical, readable checkbox at ultrawide size', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1200 })
    await signIn(page)
    const title = `Ultrawide shopping ${Date.now()}`
    await createWorkspace(page, 'Shopping List', 'Weekly groceries', title)

    const root = page.locator('.qn-type-shopping')
    const content = root.locator('.qn-structured-content')
    const section = root.locator('.qn-structured-section').first()
    const header = root.locator('.qn-structured-header')
    const [rootBox, headerBox, contentBox, sectionBox] = await Promise.all([
      root.boundingBox(),
      header.boundingBox(),
      content.boundingBox(),
      section.boundingBox(),
    ])
    expect(sectionBox.width).toBeGreaterThan(1400)
    expect(Math.abs(sectionBox.width - (contentBox.width - 32))).toBeLessThanOrEqual(2)
    expect(Math.abs(headerBox.x + headerBox.width - (rootBox.x + rootBox.width))).toBeLessThanOrEqual(2)
    expect(await root.evaluate((element) => getComputedStyle(element).scrollbarGutter)).toBe('auto')
    await expect(root.locator('.qn-focused-type-icon')).toHaveCount(0)

    const [syncBox, navigationBox] = await Promise.all([
      page.locator('.qn-top-sync').boundingBox(),
      page.getByRole('button', { name: /hide navigation/i }).first().boundingBox(),
    ])
    expect(Math.abs(syncBox.width - navigationBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(syncBox.height - navigationBox.height)).toBeLessThanOrEqual(1)

    const itemField = root.getByLabel('Item name')
    await itemField.fill('Coffee beans')
    await root.getByRole('button', { name: 'Add item', exact: true }).click()
    const checkbox = root.getByRole('checkbox', { name: 'Mark Coffee beans as purchased' })
    await checkbox.click()
    const checkedCheckbox = root.getByRole('checkbox', { name: 'Mark Coffee beans as needed' })
    await expect(checkedCheckbox).toHaveAttribute('aria-checked', 'true')
    const mark = checkedCheckbox.locator('.qn-checkbox-mark')
    await expect(mark.locator('svg')).toBeVisible()
    expect(await mark.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(255, 255, 255)')

    await itemField.focus()
    const focusColor = await itemField.evaluate((element) => getComputedStyle(element).outlineColor)
    expect(focusColor).not.toBe('rgb(16, 185, 129)')
    await expectNoHorizontalOverflow(page)
    const accessibility = await new AxeBuilder({ page }).include('.qn-type-shopping').analyze()
    expect(accessibility.violations).toEqual([])
    await page.screenshot({ path: 'test-results/systemic-ultrawide.png', fullPage: false })

    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(mark.locator('svg')).toBeVisible()
    expect(await mark.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(11, 15, 20)')
    const darkAccessibility = await new AxeBuilder({ page }).include('.qn-type-shopping').analyze()
    expect(darkAccessibility.violations).toEqual([])
    await page.screenshot({ path: 'test-results/systemic-ultrawide-dark.png', fullPage: false })
  })

  test('keeps app search inline and distinguishes it from the current-list filter', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)

    await expect(page.getByRole('searchbox', { name: 'Filter this list…' })).toBeVisible()
    const search = page.getByRole('combobox', { name: 'Search all notes and content' })
    await search.click()
    expect(await search.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none')
    await expect(page.getByRole('dialog', { name: /global search/i })).toHaveCount(0)
    await search.fill('Welcome')
    await expect(page.getByRole('listbox', { name: 'Search results' })).toBeVisible()
    await expect(page.locator('.qn-top-search-result').first()).toContainText('Welcome to QuickNotes')
    await expect(page.getByRole('button', { name: /advanced search and filters/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: 'test-results/systemic-search-phone.png', fullPage: false })
  })

  test('gives Journal writing balanced padding on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)
    await createWorkspace(page, 'Daily Journal', 'Evening review', `Phone journal ${Date.now()}`)
    const root = page.locator('.qn-type-journal')
    await root.getByRole('tab', { name: /^Write/i }).click()
    const writing = root.getByRole('textbox', { name: 'Free writing' })
    await writing.fill('A realistic journal paragraph written on a phone.')
    const padding = await writing.evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
    })
    expect(padding).toEqual(['16px', '16px', '16px', '16px'])
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: 'test-results/systemic-journal-phone.png', fullPage: false })
  })
})
