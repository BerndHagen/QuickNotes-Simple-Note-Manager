import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createNote, expectNoHorizontalOverflow, signIn } from './helpers'

const formatViolations = (violations) =>
  violations
    .map((violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
    )
    .join('\n')

const expectDialogInsideViewport = async (page, dialog) => {
  const viewport = page.viewportSize()
  const box = await dialog.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)

  const outside = await dialog.locator('button, input, select, textarea, [role="button"]').evaluateAll(
    (controls) => controls
      .filter((control) => {
        const style = getComputedStyle(control)
        const rect = control.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 &&
          (rect.left < -1 || rect.right > window.innerWidth + 1)
      })
      .map((control) => control.getAttribute('aria-label') || control.textContent?.trim())
  )
  expect(outside).toEqual([])
  await expectNoHorizontalOverflow(page)
}

test.describe('note transfer dialogs', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('export is named, accessible, and contained on a small screen', async ({ page }) => {
    await signIn(page)
    await page.keyboard.press('Control+Shift+e')

    const dialog = page.getByRole('dialog', { name: 'Export notes' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /close/i })).toBeVisible()

    const formatButtons = dialog.getByRole('group', { name: /select.*format/i }).getByRole('button')
    await expect(formatButtons.first()).toHaveAttribute('aria-pressed', 'true')
    await formatButtons.nth(1).click()
    await expect(formatButtons.nth(1)).toHaveAttribute('aria-pressed', 'true')

    await expectDialogInsideViewport(page, dialog)
    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(formatViolations(violations)).toBe('')
  })

  test('import file selection works from the keyboard and reports a safe result', async ({ page }) => {
    await signIn(page)
    await page.keyboard.press('Control+Shift+i')

    const dialog = page.getByRole('dialog', { name: 'Import notes' })
    const dropzone = dialog.getByRole('button', { name: /choose note files/i })
    await dropzone.focus()
    await expect(dropzone).toBeFocused()

    const chooserPromise = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    const chooser = await chooserPromise
    await chooser.setFiles({
      name: 'keyboard-import.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Keyboard import\n\n- [x] Verified\n\n```js\nconst safe = true\n```'),
    })

    await expect(dialog.getByRole('button', { name: /remove keyboard-import\.md/i })).toBeVisible()
    await expectDialogInsideViewport(page, dialog)

    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(formatViolations(violations)).toBe('')

    await dialog.getByRole('button', { name: /^import \d+ files?$/i }).click()
    await expect(dialog.getByText(/import complete/i)).toBeVisible()
    await expect(dialog.getByText(/imported as [“"]Keyboard import[”"]/i)).toBeVisible()
  })

  test('restores notes, folders, and tags from a JSON workspace backup', async ({ page }) => {
    await signIn(page)
    await page.keyboard.press('Control+Shift+i')

    const dialog = page.getByRole('dialog', { name: 'Import notes' })
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'quicknotes-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'quicknotes-workspace-backup',
        schemaVersion: 1,
        folders: [{ id: 'folder-source', name: 'Restored folder' }],
        tags: [{ id: 'tag-source', name: 'restored', color: '#047857' }],
        notes: [{
          id: 'note-source',
          title: 'Restored from backup',
          content: '<p>Backup body</p>',
          folderId: 'folder-source',
          tags: ['restored'],
        }],
      })),
    })

    await dialog.getByRole('button', { name: /^import 1 file$/i }).click()
    await expect(dialog.getByText(/1 notes, 1 folders, and 1 tags/i)).toBeVisible()
    await dialog.getByRole('button', { name: /^done$/i }).click()

    const restoredNote = page.getByRole('button', { name: /restored from backup/i }).first()
    await expect(restoredNote).toBeVisible()
    await restoredNote.click()
    await expect(page.getByLabel('Note content').getByText('Backup body')).toBeVisible()
  })
})

test('export all excludes notes in Trash from the actual downloads', async ({ page }) => {
  await signIn(page)
  const keepTitle = `Keep export ${Date.now()}`
  const trashTitle = `Trash export ${Date.now()}`
  await createNote(page, keepTitle)
  await createNote(page, trashTitle)

  await page.getByRole('button', { name: /more actions/i }).click()
  await page.getByRole('menuitem', { name: /move to trash/i }).click()
  const confirmation = page.getByRole('dialog')
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: /move to trash/i }).click()
  }

  await page.locator('body').focus()
  await page.keyboard.press('Control+Shift+e')
  const dialog = page.getByRole('dialog', { name: 'Export notes' })
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: /Markdown/ }).click()

  const countText = await dialog.getByText(/notes will be exported/i).innerText()
  const expectedDownloads = Number(countText.match(/\d+/)?.[0])
  expect(expectedDownloads).toBeGreaterThan(0)

  const filenames = []
  page.on('download', (download) => filenames.push(download.suggestedFilename()))
  await dialog.getByRole('button', { name: /export all notes/i }).click()
  await expect.poll(() => filenames.length, { timeout: 20_000 }).toBe(expectedDownloads)

  expect(filenames).toContain(`${keepTitle.replace(/[^a-z0-9]/gi, '_')}.md`)
  expect(filenames).not.toContain(`${trashTitle.replace(/[^a-z0-9]/gi, '_')}.md`)
})
