/* global console, document, process */

import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(projectRoot, 'images')
const baseUrl = `${(process.env.QN_SCREENSHOT_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '')}/`
const viewport = { width: 1440, height: 900 }

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
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(180)
  await page.screenshot({
    path: path.join(outputDir, name),
    animations: 'disabled',
    caret: 'initial',
  })
}

async function createDocument(page) {
  await page.getByRole('button', { name: /new note/i }).first().click()
  const title = page.getByLabel('Note title')
  await title.fill('Release planning')
  await title.blur()
  const editor = page.locator('.ProseMirror').first()
  await editor.fill([
    'QuickNotes 3.0 release planning',
    '',
    'Today',
    'Review the final workspace build and confirm the release notes.',
    'Check Document, Paper, Canvas, search, backup, and the Meeting workflow.',
    '',
    'Decision log',
    'Keep provider-backed features unavailable until a real capability is configured.',
  ].join('\n'))
  await expect(page.getByRole('button', { name: /saved locally|synced/i }).first()).toBeVisible({ timeout: 15_000 })
  return editor
}

async function createSpatial(page, type, title) {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${type}`, 'i') })
    .click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  const workspace = page.getByRole('application', {
    name: new RegExp(type === 'Paper' ? 'Page 1' : 'Infinite canvas', 'i'),
  })
  await workspace.waitFor({ state: 'visible' })
  return workspace
}

async function createStructured(page, { type, starter, title, root }) {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${type}`, 'i') })
    .click()
  await dialog.getByText(starter, { exact: true }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  const workspace = page.locator(root)
  await workspace.waitFor({ state: 'visible' })
  return workspace
}

async function drawStroke(page, points) {
  await page.mouse.move(points[0].x, points[0].y)
  await page.mouse.down()
  for (const point of points.slice(1)) {
    await page.mouse.move(point.x, point.y, { steps: 5 })
  }
  await page.mouse.up()
}

async function captureDocumentAndSearch() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  await createDocument(page)
  await save(page, 'quicknotes-3-document.png')

  await page.keyboard.press('Control+k')
  const search = page.getByRole('dialog', { name: /global search/i })
  await search.getByRole('combobox').fill('release planning')
  await expect(search.getByRole('option', { name: /Release planning/i })).toBeVisible({ timeout: 15_000 })
  await save(page, 'quicknotes-3-search.png')
  await context.close()
}

async function capturePaper() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  const paper = await createSpatial(page, 'Paper', 'Field notes')
  await page.getByLabel('Paper pattern').selectOption('dot')
  const box = await paper.boundingBox()

  await page.getByLabel('Writing instrument').selectOption('highlighter')
  await drawStroke(page, [
    { x: box.x + 115, y: box.y + 170 },
    { x: box.x + 280, y: box.y + 170 },
    { x: box.x + 455, y: box.y + 170 },
  ])
  await page.getByLabel('Writing instrument').selectOption('pen')
  await drawStroke(page, [
    { x: box.x + 115, y: box.y + 120 },
    { x: box.x + 155, y: box.y + 95 },
    { x: box.x + 200, y: box.y + 125 },
    { x: box.x + 245, y: box.y + 90 },
    { x: box.x + 295, y: box.y + 120 },
  ])
  await drawStroke(page, [
    { x: box.x + 120, y: box.y + 250 },
    { x: box.x + 210, y: box.y + 225 },
    { x: box.x + 310, y: box.y + 255 },
    { x: box.x + 420, y: box.y + 220 },
  ])
  await drawStroke(page, [
    { x: box.x + 120, y: box.y + 335 },
    { x: box.x + 210, y: box.y + 320 },
    { x: box.x + 300, y: box.y + 345 },
    { x: box.x + 395, y: box.y + 325 },
  ])
  await expect(page.getByLabel('Paper editor').getByText('Saved on this device')).toBeVisible({ timeout: 15_000 })
  await save(page, 'quicknotes-3-paper.png')
  await context.close()
}

async function captureCanvas() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  const canvas = await createSpatial(page, 'Canvas', 'Project map')
  const box = await canvas.boundingBox()

  await page.getByRole('button', { name: 'Rectangle' }).click()
  await drawStroke(page, [
    { x: box.x + 120, y: box.y + 120 },
    { x: box.x + 340, y: box.y + 235 },
  ])
  await page.getByRole('button', { name: 'Arrow' }).click()
  await drawStroke(page, [
    { x: box.x + 345, y: box.y + 180 },
    { x: box.x + 485, y: box.y + 270 },
  ])
  await page.getByRole('button', { name: 'Sticky note' }).click()
  await page.mouse.click(box.x + 510, box.y + 220)
  const sticky = page.getByLabel('Sticky note text')
  await sticky.fill('Review the release boundary')
  await sticky.press('Control+Enter')
  await page.getByRole('button', { name: 'Index card' }).click()
  await page.mouse.click(box.x + 180, box.y + 350)
  const card = page.getByLabel('Index card text')
  await card.fill('Document\nPaper\nCanvas\nSearch')
  await card.press('Control+Enter')
  await page.getByLabel('Writing instrument').selectOption('pen')
  await drawStroke(page, [
    { x: box.x + 470, y: box.y + 410 },
    { x: box.x + 525, y: box.y + 385 },
    { x: box.x + 580, y: box.y + 420 },
    { x: box.x + 640, y: box.y + 385 },
  ])
  await expect(page.getByLabel('Canvas editor').getByText('Saved on this device')).toBeVisible({ timeout: 15_000 })
  await save(page, 'quicknotes-3-canvas.png')
  await context.close()
}

async function captureMeeting() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: /^Meeting Workspace/i })
    .click()
  await dialog.getByText('Team sync', { exact: true }).click()
  await dialog.getByLabel('Note title').fill('Quarterly planning')
  await dialog.getByRole('button', { name: /^Create meeting/i }).click()
  const meeting = page.locator('.qn-type-meeting')
  await meeting.waitFor({ state: 'visible' })
  await meeting.getByRole('tab', { name: /^Agenda/i }).click()
  await expect(meeting.getByText('Progress and wins', { exact: true })).toBeVisible()
  await save(page, 'quicknotes-3-meeting.png')
  await context.close()
}

async function captureTaskCenter() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: /^Task List/i })
    .click()
  await dialog.getByText('Daily priorities', { exact: true }).click()
  await dialog.getByLabel('Note title').fill('Release checklist')
  await dialog.getByRole('button', { name: /^Create tasks$/i }).click()
  await page.getByRole('button', { name: /My Tasks/ }).click()
  const tasks = page.getByRole('dialog', { name: 'My Tasks' })
  await expect(tasks).toBeVisible()
  await expect(tasks.getByRole('list', { name: 'Workspace tasks' })).toBeVisible()
  await save(page, 'quicknotes-3-tasks.png')
  await context.close()
}

async function captureProject() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  const project = await createStructured(page, {
    type: 'Project Board',
    starter: 'Product launch',
    title: 'Product launch',
    root: '.qn-type-project',
  })
  await project.getByRole('tab', { name: /^Board/i }).click()
  await expect(project.getByText('Define launch goal and audience', { exact: true })).toBeVisible()
  await save(page, 'quicknotes-3-project.png')
  await context.close()
}

async function captureJournal() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  const journal = await createStructured(page, {
    type: 'Daily Journal',
    starter: 'Evening review',
    title: 'Evening reflection',
    root: '.qn-type-journal',
  })
  await journal.getByRole('tab', { name: /^Evening/i }).click()
  await journal.getByLabel('Gratitude item 1').fill('A clear plan for the release')
  await journal.getByLabel('Gratitude item 2').fill('Thoughtful feedback from the team')
  await journal.getByLabel('Gratitude item 3').fill('Time to finish the important details')
  await save(page, 'quicknotes-3-journal.png')
  await context.close()
}

async function captureIdeas() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  const ideas = await createStructured(page, {
    type: 'Idea Board',
    starter: 'Product discovery',
    title: 'Product discovery',
    root: '.qn-type-brainstorm',
  })
  await ideas.getByRole('tab', { name: /^Idea register/i }).click()
  for (const idea of [
    'Interview frequent travellers',
    'Reduce steps in mobile capture',
    'Test the smallest useful workflow',
    'Measure time from thought to note',
  ]) {
    await ideas.getByLabel('New idea').fill(idea)
    await ideas.getByRole('button', { name: 'Add Idea' }).click()
  }
  await expect(ideas.locator('.qn-idea-row')).toHaveCount(4)
  await save(page, 'quicknotes-3-ideas.png')
  await context.close()
}

async function captureShopping() {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await openLocalWorkspace(page)
  const shopping = await createStructured(page, {
    type: 'Shopping List',
    starter: 'Weekly groceries',
    title: 'Weekly groceries',
    root: '.qn-type-shopping',
  })
  await expect(shopping.getByText('Fresh fruit', { exact: true })).toBeVisible()
  await save(page, 'quicknotes-3-shopping.png')
  await context.close()
}

try {
  await captureDocumentAndSearch()
  await capturePaper()
  await captureCanvas()
  await captureMeeting()
  await captureTaskCenter()
  await captureProject()
  await captureJournal()
  await captureIdeas()
  await captureShopping()
} finally {
  await browser.close()
}

console.log(`Updated ten QuickNotes 3.0 screenshots in ${outputDir}`)
