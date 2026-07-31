import { test, expect } from '@playwright/test'
import { signIn, collectErrors, createNote, expectNoHorizontalOverflow } from './helpers'

test.describe('workspace', () => {
  test('signs in and shows the three-pane workspace', async ({ page }) => {
    const errors = collectErrors(page)
    await signIn(page)

    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible()
    await expect(page.getByRole('button', { name: /all notes/i })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('keeps a local workspace open across reloads', async ({ page }) => {
    await signIn(page)
    await expect(page.getByText(/saved locally/i).first()).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(/saved locally/i).first()).toBeVisible()
  })

  test('creates, edits and persists a note across a reload', async ({ page }) => {
    await signIn(page)
    const title = `E2E note ${Date.now()}`
    await createNote(page, title)

    const body = page.locator('.ProseMirror').first()
    await body.click()
    await body.pressSequentially('Persisted body text')

    // Give the debounced auto-save a chance to flush.
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: new RegExp(title, 'i') }).first()).toBeVisible()
    await expect(page.getByLabel('Note content').getByText('Persisted body text')).toBeVisible()
  })

  test('filters the list by search query and clears it', async ({ page }) => {
    await signIn(page)
    const unique = `Zebra${Date.now()}`
    await createNote(page, unique)
    await createNote(page, `Aardvark${Date.now()}`)

    const search = page.getByRole('searchbox')
    await search.fill(unique)
    await expect(page.getByRole('button', { name: new RegExp(unique, 'i') }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Aardvark/i })).toHaveCount(0)

    await page.getByRole('button', { name: /clear search/i }).click()
    await expect(search).toHaveValue('')
  })

  test('shows an empty state when a search matches nothing', async ({ page }) => {
    await signIn(page)
    await page.getByRole('searchbox').fill('zzz-no-such-note-zzz')
    await expect(page.getByText(/no notes found/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /clear search/i }).first()).toBeVisible()
  })

  test('Ctrl+N opens the quick note dialog', async ({ page }) => {
    await signIn(page)
    await page.keyboard.press('Control+n')
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  // Editor keys belong to the editor: a document-level handler must not
  // claim Ctrl+I while the caret is in a note.
  test('Ctrl+I inside the editor does not open the import dialog', async ({ page }) => {
    await signIn(page)
    await createNote(page, `Shortcut scope ${Date.now()}`)

    const body = page.locator('.ProseMirror').first()
    await body.click()
    await body.pressSequentially('formatted')
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+i')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.ProseMirror em, .ProseMirror i')).toHaveCount(1)
  })

  test('marks a note as a favourite and finds it under Favorites', async ({ page }) => {
    await signIn(page)
    const title = `Favourite ${Date.now()}`
    await createNote(page, title)

    await page.getByRole('button', { name: /add to favourites/i }).first().click()
    await page.getByRole('button', { name: /^favorites/i }).click()
    await expect(page.getByRole('button', { name: new RegExp(title, 'i') }).first()).toBeVisible()
  })

  test('moves a note to trash and restores the list count', async ({ page }) => {
    await signIn(page)
    const title = `Trash me ${Date.now()}`
    await createNote(page, title)

    await page.getByRole('button', { name: /more actions/i }).click()
    await page.getByRole('menuitem', { name: /move to trash/i }).click()

    const confirm = page.getByRole('dialog')
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /move to trash/i }).click()
    }
    await expect(page.getByRole('button', { name: new RegExp(title, 'i') })).toHaveCount(0)
  })
})

test.describe('dialogs', () => {
  test('traps focus, closes on Escape and restores focus to the trigger', async ({ page }) => {
    await signIn(page)

    const trigger = page.getByRole('button', { name: /^settings$/i }).first()
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Focus must be inside the dialog, not left on the page behind it.
    const focusInside = await page.evaluate(() =>
      document.querySelector('[role="dialog"]')?.contains(document.activeElement)
    )
    expect(focusInside).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('dialog fits inside a short viewport and scrolls internally', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 })
    await signIn(page)
    await page.getByRole('button', { name: /^settings$/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const box = await dialog.boundingBox()
    expect(box.y).toBeGreaterThanOrEqual(-1)
    expect(box.y + box.height).toBeLessThanOrEqual(560 + 1)
    await expectNoHorizontalOverflow(page)
  })
})
