import { test, expect } from '@playwright/test'
import { collectErrors, expectNoHorizontalOverflow, signIn } from './helpers'

async function createSpatialNote(page, type, title) {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${type}`, 'i') })
    .click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await expect(page.getByRole('application', { name: new RegExp(type === 'Paper' ? 'Page 1' : 'Infinite canvas', 'i') })).toBeVisible()
}

async function spatialObjectCount(page, noteTitle) {
  return page.evaluate(async (title) => {
    const request = indexedDB.open('QuickNotesDB')
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const note = await new Promise((resolve, reject) => {
      const tx = database.transaction('notes', 'readonly')
      const getAll = tx.objectStore('notes').getAll()
      getAll.onsuccess = () => resolve(getAll.result.find((candidate) => candidate.title === title))
      getAll.onerror = () => reject(getAll.error)
    })
    const count = await new Promise((resolve, reject) => {
      const tx = database.transaction('spatialObjects', 'readonly')
      const index = tx.objectStore('spatialObjects').index('noteId')
      const requestCount = index.count(IDBKeyRange.only(note.id))
      requestCount.onsuccess = () => resolve(requestCount.result)
      requestCount.onerror = () => reject(requestCount.error)
    })
    database.close()
    return count
  }, noteTitle)
}

async function spatialState(page, noteTitle) {
  return page.evaluate(async (title) => {
    const request = indexedDB.open('QuickNotesDB')
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const readAll = (store) => new Promise((resolve, reject) => {
      const tx = database.transaction(store, 'readonly')
      const query = tx.objectStore(store).getAll()
      query.onsuccess = () => resolve(query.result)
      query.onerror = () => reject(query.error)
    })
    const notes = await readAll('notes')
    const note = notes.find((candidate) => candidate.title === title)
    const [documents, objects, resources] = await Promise.all([
      readAll('spatialDocuments'),
      readAll('spatialObjects'),
      readAll('resources'),
    ])
    database.close()
    return {
      document: documents.find((candidate) => candidate.noteId === note.id),
      objects: objects.filter((candidate) => candidate.noteId === note.id),
      resources,
    }
  }, noteTitle)
}

async function downloadSize(download) {
  const stream = await download.createReadStream()
  let size = 0
  for await (const chunk of stream) size += chunk.length
  return size
}

test.describe('Paper and Canvas spatial editors', () => {
  test('draws, undoes, redoes, paginates, and reloads a Paper note', async ({ page }) => {
    const errors = collectErrors(page)
    await signIn(page)
    const title = `Paper E2E ${Date.now()}`
    await createSpatialNote(page, 'Paper', title)

    const paper = page.getByRole('application', { name: /page 1/i })
    const box = await paper.boundingBox()
    await page.mouse.move(box.x + 90, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 180, box.y + 145, { steps: 12 })
    await page.mouse.up()
    await expect(page.getByLabel('Paper editor').getByText('Saved on this device')).toBeVisible()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)

    await page.getByRole('button', { name: 'Highlighter (H)' }).click()
    await page.mouse.move(box.x + 100, box.y + 250)
    await page.mouse.down()
    await page.mouse.move(box.x + 220, box.y + 250, { steps: 10 })
    await page.mouse.up()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(2)

    await page.getByRole('button', { name: 'Replay ink' }).click()
    await expect(page.getByRole('button', { name: 'Stop ink replay' })).toBeVisible()
    await page.getByLabel('Ink replay position').fill('500')
    await expect(page.getByText('Ink replay paused')).toBeVisible()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(2)
    await page.getByRole('button', { name: 'Stop ink replay' }).click()

    await page.getByRole('button', { name: 'Select (V)' }).click()
    await page.mouse.move(box.x + 55, box.y + 60)
    await page.mouse.down()
    await page.mouse.move(box.x + 245, box.y + 285, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByText('2 selected')).toBeVisible()

    await page.getByRole('button', { name: 'Stroke eraser (E)' }).click()
    await page.mouse.click(box.x + 160, box.y + 250)
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)

    const strokeBeforeMove = (await spatialState(page, title)).objects[0]
    const beforeMove = strokeBeforeMove.bounds
    const middlePoint = strokeBeforeMove.data.points[Math.floor(strokeBeforeMove.data.points.length / 2)]
    const strokeScreen = { x: box.x + middlePoint[0] * 0.8, y: box.y + middlePoint[1] * 0.8 }
    await page.getByRole('button', { name: 'Select (V)' }).click()
    await page.mouse.click(strokeScreen.x, strokeScreen.y)
    await expect(page.getByText('1 selected')).toBeVisible()
    await page.mouse.move(strokeScreen.x, strokeScreen.y)
    await page.mouse.down()
    await page.mouse.move(strokeScreen.x + 30, strokeScreen.y + 25, { steps: 5 })
    await page.mouse.up()
    await expect.poll(async () => (await spatialState(page, title)).objects[0].bounds.x).toBeGreaterThan(beforeMove.x + 20)

    await page.getByLabel('Paper pattern').selectOption('dot')
    await expect(paper).toHaveAttribute('aria-label', /dot warm paper/i)

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(paper).toHaveAttribute('aria-label', /blank warm paper/i)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await spatialState(page, title)).objects[0].bounds.x).toBeCloseTo(beforeMove.x, 1)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(2)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(0)

    await page.getByRole('button', { name: 'Redo' }).click()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(2)
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect.poll(async () => (await spatialState(page, title)).objects[0].bounds.x).toBeGreaterThan(beforeMove.x + 20)
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect(paper).toHaveAttribute('aria-label', /dot warm paper/i)

    await page.getByRole('button', { name: 'Add page' }).first().click()
    await expect(page.getByRole('application', { name: /page 2/i })).toBeVisible()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('application', { name: /page 1/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('application', { name: /page 2/i })).toBeVisible()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)

    await page.locator('.qn-paper-page-entry').first().click()
    const pngPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PNG' }).click()
    const png = await pngPromise
    expect(png.suggestedFilename()).toMatch(/\.png$/)
    expect(await downloadSize(png)).toBeGreaterThan(1_000)

    const pdfPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PDF' }).click()
    const pdf = await pdfPromise
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/)
    expect(await downloadSize(pdf)).toBeGreaterThan(1_000)
    expect(errors).toEqual([])
  })

  test('creates real Canvas objects and remains usable at compact width', async ({ page }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 768, height: 800 })
    await signIn(page)
    const title = `Canvas E2E ${Date.now()}`
    await createSpatialNote(page, 'Canvas', title)

    const canvas = page.getByRole('application', { name: /infinite canvas/i })
    const box = await canvas.boundingBox()
    await page.mouse.move(box.x + 70, box.y + 80)
    await page.mouse.down()
    await page.mouse.move(box.x + 140, box.y + 115, { steps: 8 })
    await page.mouse.up()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)

    await page.getByRole('button', { name: 'Rectangle' }).click()
    await page.mouse.move(box.x + 160, box.y + 160)
    await page.mouse.down()
    await page.mouse.move(box.x + 330, box.y + 280, { steps: 6 })
    await page.mouse.up()
    await expect.poll(() => spatialObjectCount(page, title)).toBe(2)

    await page.getByRole('button', { name: 'Sticky note' }).click()
    await page.mouse.click(box.x + 90, box.y + 190)
    await expect(page.getByLabel('Sticky note text')).toHaveValue('New sticky note')
    await expect.poll(() => spatialObjectCount(page, title)).toBe(3)

    const stickyBefore = (await spatialState(page, title)).objects.find((object) => object.kind === 'sticky').bounds
    const resizeHandle = page.getByRole('button', { name: 'Resize selected object' })
    const handleBox = await resizeHandle.boundingBox()
    await page.mouse.move(handleBox.x + 4, handleBox.y + 4)
    await page.mouse.down()
    await page.mouse.move(handleBox.x + 44, handleBox.y + 34, { steps: 5 })
    await page.mouse.up()
    await expect.poll(async () => (await spatialState(page, title)).objects.find((object) => object.kind === 'sticky').bounds.width).toBeGreaterThan(stickyBefore.width + 25)

    await page.mouse.move(box.x + 130, box.y + 230)
    await page.mouse.down()
    await page.mouse.move(box.x + 165, box.y + 255, { steps: 5 })
    await page.mouse.up()
    await page.mouse.dblclick(box.x + 165, box.y + 255)
    await page.getByLabel('Sticky note text').fill('Editable canvas thought')
    await page.getByLabel('Sticky note text').press('Control+Enter')
    await expect.poll(async () => (await spatialState(page, title)).objects.find((object) => object.kind === 'sticky').data.text).toBe('Editable canvas thought')

    await page.getByRole('button', { name: 'Index card' }).click()
    await page.mouse.click(box.x + 90, box.y + 430)
    await expect.poll(() => spatialObjectCount(page, title)).toBe(4)

    await page.getByRole('button', { name: 'Link to note' }).click()
    await page.getByLabel('Target').selectOption({ label: 'Welcome to QuickNotes' })
    await page.mouse.click(box.x + 300, box.y + 420)
    await expect.poll(() => spatialObjectCount(page, title)).toBe(5)
    expect((await spatialState(page, title)).objects.find((object) => object.kind === 'noteLink').data.targetNoteId).toBeTruthy()

    const imageInput = page.locator('input[type="file"][accept*="image/png"]')
    await imageInput.setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    })
    await expect.poll(() => spatialObjectCount(page, title)).toBe(6)
    const withImage = await spatialState(page, title)
    expect(withImage.resources).toHaveLength(1)
    expect(withImage.objects.find((object) => object.kind === 'image').data.resourceId).toBe(withImage.resources[0].id)

    const viewportBefore = (await spatialState(page, title)).document.viewport
    await page.getByRole('button', { name: 'Pan (Space)' }).click()
    await page.mouse.move(box.x + 220, box.y + 480)
    await page.mouse.down()
    await page.mouse.move(box.x + 260, box.y + 520, { steps: 5 })
    await page.mouse.up()
    await expect.poll(async () => (await spatialState(page, title)).document.viewport.panX).not.toBe(viewportBefore.panX)
    const zoomBefore = (await spatialState(page, title)).document.viewport.zoom
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(async () => (await spatialState(page, title)).document.viewport.zoom).toBeGreaterThan(zoomBefore)

    await expectNoHorizontalOverflow(page)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('application', { name: /infinite canvas/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByLabel('Sticky note text')).toHaveValue('Editable canvas thought')
    await expect.poll(() => spatialObjectCount(page, title)).toBe(6)

    const pngPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PNG' }).click()
    expect(await downloadSize(await pngPromise)).toBeGreaterThan(1_000)
    expect(errors).toEqual([])
  })

  test('keeps pen geometry and high-DPI ink aligned at device scale 2', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()
    await signIn(page)
    const title = `High DPI Paper ${Date.now()}`
    await createSpatialNote(page, 'Paper', title)
    const paper = page.getByRole('application', { name: /page 1/i })
    const box = await paper.boundingBox()
    const clientSize = await paper.locator('canvas').first().evaluate((canvas) => ({
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      width: canvas.width,
      height: canvas.height,
    }))
    expect(clientSize.width).toBe(clientSize.clientWidth * 2)
    expect(clientSize.height).toBe(clientSize.clientHeight * 2)

    const session = await context.newCDPSession(page)
    const start = { x: box.x + box.width * 0.72, y: box.y + box.height * 0.35 }
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, pointerType: 'pen', force: 0.25 })
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x + 55, y: start.y + 30, button: 'left', buttons: 1, pointerType: 'pen', force: 0.8 })
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: start.x + 55, y: start.y + 30, button: 'left', buttons: 0, pointerType: 'pen', force: 0 })
    await expect.poll(() => spatialObjectCount(page, title)).toBe(1)
    const stroke = (await spatialState(page, title)).objects[0]
    expect(stroke.data.points[0][0]).toBeCloseTo((start.x - box.x) / 0.8, 0)
    expect(stroke.data.points.some((point) => point[2] > 0.7)).toBe(true)
    await context.close()
  })
})
