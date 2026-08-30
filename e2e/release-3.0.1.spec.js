import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

const openDocumentOnCompactLayout = async (page) => {
  if ((page.viewportSize()?.width || 0) >= 768) return
  await page.getByRole('heading', { name: 'Welcome to QuickNotes' }).click()
  await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible()
}

for (const viewport of [
  { name: 'reduced desktop', width: 1024, height: 768 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`keeps the note title clear of actions on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await signIn(page)

    const noteStatus = page.locator('.note-card [aria-label="Note status"]').first()
    await expect(noteStatus).toBeVisible()
    const statusAlignment = await noteStatus.evaluate((status) => {
      const card = status.closest('.note-card').getBoundingClientRect()
      const statusBox = status.getBoundingClientRect()
      return (statusBox.left - card.left) / card.width
    })
    expect(statusAlignment).toBeGreaterThan(0.55)

    await openDocumentOnCompactLayout(page)

    const separation = await page.locator('.qn-ribbon-note-bar').evaluate((bar) => {
      const title = bar.querySelector('.qn-ribbon-title')?.getBoundingClientRect()
      const actions = bar.querySelector('.qn-ribbon-note-actions')?.getBoundingClientRect()
      return {
        gap: actions.left - title.right,
        titleWidth: title.width,
      }
    })

    expect(separation.titleWidth).toBeGreaterThan(80)
    expect(separation.gap).toBeGreaterThanOrEqual(7)
  })
}

test.describe('3.0.1 desktop regressions', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('groups all pane controls and gives them the same toggle treatment', async ({ page }) => {
    await signIn(page)

    const panes = page.getByRole('group', { name: 'Workspace panes' })
    const navigation = panes.getByRole('button', { name: 'Hide navigation' })
    const notes = panes.getByRole('button', { name: 'Hide note list' })
    const inspector = panes.getByRole('button', { name: 'Show inspector' })
    await expect(navigation).toHaveAttribute('aria-pressed', 'true')
    await expect(notes).toHaveAttribute('aria-pressed', 'true')
    await expect(inspector).toHaveAttribute('aria-pressed', 'false')

    const [navigationBackground, notesBackground] = await Promise.all([
      navigation.evaluate((element) => getComputedStyle(element).backgroundColor),
      notes.evaluate((element) => getComputedStyle(element).backgroundColor),
    ])
    expect(navigationBackground).toBe(notesBackground)

    await navigation.click()
    const showNavigation = panes.getByRole('button', { name: 'Show navigation' })
    await expect(showNavigation).toHaveAttribute('aria-pressed', 'false')
    await notes.click()
    await expect(panes.getByRole('button', { name: 'Show note list' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('uses one canonical word and character count in the footer and inspector', async ({ page }) => {
    await signIn(page)
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+A')
    for (const [index, line] of ['Steam Games', 'Halo Infinite', 'Nier Automata', 'Horizon Zero Dawn'].entries()) {
      await page.keyboard.insertText(line)
      if (index < 3) await page.keyboard.press('Enter')
    }

    const footer = page.locator('.qn-note-statistics')
    await expect(footer).toContainText('9 words')
    await expect(footer).toContainText('57 chars')

    await page.getByRole('button', { name: 'Show inspector' }).click()
    const documentSection = page.getByRole('heading', { name: 'Document' }).locator('..')
    await expect(documentSection.locator('div').filter({ hasText: /^Words/ }).locator('dd')).toHaveText('9')
    await expect(documentSection.locator('div').filter({ hasText: /^Characters/ }).locator('dd')).toHaveText('57')
  })

  test('paints independent shadows and complete focus edges around every visual page', async ({ page }) => {
    await signIn(page)
    const editor = page.getByRole('textbox', { name: 'Note content' })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.insertText('Page one')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.insertText('Page two')

    const gutter = editor.locator('.qn-page-gap__gutter')
    await expect(gutter).toBeVisible()
    const painting = await gutter.evaluate((element) => {
      const editorStyle = getComputedStyle(element.closest('.ProseMirror'))
      const gutterStyle = getComputedStyle(element)
      const upperEdge = getComputedStyle(element, '::before')
      const lowerEdge = getComputedStyle(element, '::after')
      return {
        editorOutline: editorStyle.outlineStyle,
        editorBorder: editorStyle.borderColor,
        gutterShadow: gutterStyle.boxShadow,
        upperLeft: upperEdge.left,
        upperRight: upperEdge.right,
        upperShadow: upperEdge.boxShadow,
        lowerLeft: lowerEdge.left,
        lowerRight: lowerEdge.right,
        lowerShadow: lowerEdge.boxShadow,
        upperColor: upperEdge.backgroundColor,
        lowerColor: lowerEdge.backgroundColor,
      }
    })

    expect(painting.editorOutline).toBe('none')
    expect(painting.gutterShadow).not.toBe('none')
    expect(painting.upperLeft).toBe('0px')
    expect(painting.upperRight).toBe('0px')
    expect(painting.lowerLeft).toBe('0px')
    expect(painting.lowerRight).toBe('0px')
    expect(painting.upperShadow).not.toBe('none')
    expect(painting.lowerShadow).not.toBe('none')
    expect(painting.upperColor).toBe(painting.editorBorder)
    expect(painting.lowerColor).toBe(painting.editorBorder)
  })
})
