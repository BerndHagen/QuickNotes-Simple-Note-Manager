/* global console, process */

import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(projectRoot, 'images')
const baseUrl = (process.env.QN_SCREENSHOT_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const viewport = { width: 1920, height: 1080 }

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function openLocalWorkspace(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  const localEntry = page.getByRole('button', { name: /use a private local workspace/i })
  const continueLocal = page.getByRole('button', { name: /(?:create|continue to my) local workspace/i })
  const workspace = page.locator('#qn-main')

  await localEntry.or(continueLocal).or(workspace).waitFor({ state: 'visible' })
  if (await workspace.isVisible().catch(() => false)) return
  if (await localEntry.isVisible().catch(() => false)) await localEntry.click()
  if (!(await workspace.isVisible().catch(() => false))) await continueLocal.click()
  await workspace.waitFor({ state: 'visible' })
}

async function save(page, name) {
  await page.screenshot({ path: path.join(outputDir, name), fullPage: true })
}

async function createFocused(page, type, starter, title, className) {
  await page.getByRole('button', { name: 'Choose a focused note type' }).click()
  const dialog = page.getByRole('dialog', { name: /create a focused note/i })
  await dialog
    .locator('section[aria-label="Note types"]')
    .getByRole('button', { name: new RegExp(`^${type}`, 'i') })
    .click()
  await dialog.getByText(starter, { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  const editor = page.locator(className)
  await editor.waitFor({ state: 'visible' })
  await expect(editor.locator('.qn-type-hero input').first()).toHaveValue(title)
}

async function captureStartup() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: /use a private local workspace/i })).toBeEnabled()
  await save(page, 'screenshot-startup.png')
  await context.close()
}

async function captureEditorAndSearch() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  await page.locator('.ProseMirror').waitFor({ state: 'visible' })
  await save(page, 'screenshot-editor.png')
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog', { name: /global search/i }).waitFor({ state: 'visible' })
  await save(page, 'screenshot-search.png')
  await context.close()
}

async function captureFocused(name, type, starter, title, className) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  await createFocused(page, type, starter, title, className)
  await save(page, name)
  await context.close()
}

try {
  await captureStartup()
  await captureEditorAndSearch()
  await captureFocused(
    'screenshot-tasks.png',
    'Task List',
    'Daily priorities',
    'Delivery priorities',
    '.qn-type-todo',
  )
  await captureFocused(
    'screenshot-meeting.png',
    'Meeting Workspace',
    'Team sync',
    'Quarterly planning sync',
    '.qn-type-meeting',
  )
  await captureFocused(
    'screenshot-board.png',
    'Project Board',
    'Product launch',
    'Enterprise launch plan',
    '.qn-type-project',
  )
} finally {
  await browser.close()
}

console.log(`Updated six repository screenshots in ${outputDir}`)
