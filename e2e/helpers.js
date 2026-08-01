import { expect } from '@playwright/test'

/**
 * Credentials for the cloud sign-in path, supplied by the environment.
 *
 * Never commit a working account here. Without `QN_EMAIL`/`QN_PASSWORD` the
 * suite runs against the local workspace, which covers every test that does
 * not exercise sync or sharing.
 */
export const CREDENTIALS = {
  email: process.env.QN_EMAIL || '',
  password: process.env.QN_PASSWORD || '',
}

export const VIEWPORTS = [
  { name: '320-mobile-s', width: 320, height: 640 },
  { name: '375-mobile', width: 375, height: 720 },
  { name: '768-tablet', width: 768, height: 1024 },
  { name: '1024-laptop', width: 1024, height: 768 },
  { name: '1280-desktop', width: 1280, height: 800 },
  { name: '1440-desktop-l', width: 1440, height: 900 },
  { name: '1920-desktop-xl', width: 1920, height: 1080 },
]

const resetKeyboardStart = (page) =>
  page.evaluate(() => {
    document.body.tabIndex = -1
    document.body.focus()
    document.body.removeAttribute('tabindex')
  })

/**
 * Opens a workspace and waits for the shell.
 *
 * Uses the cloud account when `QN_EMAIL`/`QN_PASSWORD` are supplied, and the
 * local workspace otherwise — so the suite runs against a Supabase-configured
 * build without needing an account.
 */
export async function signIn(page, entryUrl = './') {
  await page.goto(entryUrl, { waitUntil: 'domcontentloaded' })

  if (CREDENTIALS.email && CREDENTIALS.password) {
    await page.getByLabel(/email/i).first().fill(CREDENTIALS.email)
    await page.locator('input[type="password"]').first().fill(CREDENTIALS.password)
    await page.locator('button[type="submit"]').first().click()
    await expect(page.locator('#qn-main')).toBeVisible({ timeout: 30_000 })
    await resetKeyboardStart(page)
    return
  }

  // On a cloud-capable build the local workspace is one step behind the
  // sign-in form; without a backend the entry button is shown directly.
  const enterLocal = page.getByRole('button', { name: /use a private local workspace/i })
  if (await enterLocal.isVisible().catch(() => false)) await enterLocal.click()

  await page
    .getByRole('button', { name: /(?:create|continue to my) local workspace/i })
    .click()

  await expect(page.locator('#qn-main')).toBeVisible({ timeout: 30_000 })
  await resetKeyboardStart(page)
}

/** Collects console errors and page exceptions for assertion at test end. */
export function collectErrors(page) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // Vite's dev client and the browser's own resource warnings are not
    // application errors.
    if (text.includes('[vite]') || text.includes('Download the React DevTools')) return
    errors.push(text)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  return errors
}

/** Fails if the document scrolls sideways at the current viewport. */
export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
  })
  expect(
    overflow.scrollWidth,
    `page scrolls horizontally (${overflow.scrollWidth}px content in ${overflow.clientWidth}px viewport)`
  ).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

/** Creates a note through the UI and returns its title. */
export async function createNote(page, title) {
  await page.getByRole('button', { name: /new note/i }).first().click()
  const titleInput = page.getByLabel('Note title')
  await expect(titleInput).toBeVisible()
  await titleInput.fill(title)
  await titleInput.blur()
  return title
}
