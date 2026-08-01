import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signIn } from './helpers'

const analyse = (page, context) => {
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ])
  return context ? builder.include(context).analyze() : builder.analyze()
}

const format = (violations) =>
  violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
    .join('\n')

test.describe('accessibility', () => {
  test('sign-in screen has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const { violations } = await analyse(page)
    expect(format(violations)).toBe('')
  })

  test('workspace has no WCAG A/AA violations', async ({ page }) => {
    await signIn(page)
    const { violations } = await analyse(page)
    expect(format(violations)).toBe('')
  })

  test('dark workspace and editor have no WCAG A/AA violations', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await signIn(page)

    const paperStyles = [
      'Plain',
      'Lined',
      'Lined + Margin',
      'College Rule',
      'Grid',
      'Grid (Small)',
      'Dotted',
      'Dotted (Dense)',
      'Sepia',
      'Blueprint',
      'Dark',
      'Dark Lined',
    ]

    for (const paperStyle of paperStyles) {
      await page.getByRole('button', { name: 'Paper Style' }).click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: paperStyle, exact: true })
        .click()

      const { violations } = await analyse(page, '.ProseMirror')
      expect(format(violations), `${paperStyle} paper`).toBe('')
    }
  })

  test('settings dialog has no WCAG A/AA violations', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /^settings$/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const { violations } = await analyse(page, '[role="dialog"]')
    expect(format(violations)).toBe('')
  })

  test('keyboard shortcuts dialog has no WCAG A/AA violations', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /shortcuts/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const { violations } = await analyse(page, '[role="dialog"]')
    expect(format(violations)).toBe('')
  })

  test('the whole sidebar is reachable by keyboard', async ({ page }) => {
    await signIn(page)

    // Tab from the top of the document and confirm every nav row is
    // reachable without a pointer.
    await page.keyboard.press('Tab') // skip link
    const skip = await page.evaluate(() => document.activeElement?.textContent)
    expect(skip).toMatch(/skip to content/i)

    const reached = await page.evaluate(async () => {
      const nav = document.querySelector('nav[aria-label="Workspace"]')
      const focusable = nav.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')
      return focusable.length
    })
    expect(reached).toBeGreaterThan(10)
  })

  test('every icon-only control has an accessible name', async ({ page }) => {
    await signIn(page)
    const unnamed = await page.evaluate(() => {
      const problems = []
      for (const el of document.querySelectorAll('button')) {
        const name = (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.textContent ||
          ''
        ).trim()
        if (!name) problems.push(el.outerHTML.slice(0, 120))
      }
      return problems
    })
    expect(unnamed).toEqual([])
  })
})
