import { test, expect } from '@playwright/test'
import { jsPDF } from 'jspdf'
import { collectErrors, createNote, expectNoHorizontalOverflow, signIn } from './helpers'

const pdfBuffer = () => {
  const document = new jsPDF()
  document.setFontSize(18)
  document.text('QuickNotes annotation source', 20, 30)
  document.text('The original page remains unchanged.', 20, 48)
  return Buffer.from(document.output('arraybuffer'))
}

const openResources = async (page) => {
  const direct = page.getByRole('button', { name: 'Attachments and recordings' }).first()
  if (await direct.isVisible().catch(() => false)) await direct.click()
  else {
    await page.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Attachments and recordings' }).click()
  }
  return page.getByRole('dialog', { name: /attachments and recordings/i })
}

const annotationObjectCount = (page) => page.evaluate(async () => {
  const request = indexedDB.open('QuickNotesDB')
  const database = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const count = await new Promise((resolve, reject) => {
    const transaction = database.transaction('spatialAnnotationObjects', 'readonly')
    const query = transaction.objectStore('spatialAnnotationObjects').count()
    query.onsuccess = () => resolve(query.result)
    query.onerror = () => reject(query.error)
  })
  database.close()
  return count
})

const createCanvas = async (page, title) => {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]').getByRole('button', { name: /^Canvas/i }).click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await expect(page.getByRole('application', { name: /infinite canvas/i })).toBeVisible()
}

const canvasObjects = (page, title) => page.evaluate(async (noteTitle) => {
  const request = indexedDB.open('QuickNotesDB')
  const database = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const read = (store) => new Promise((resolve, reject) => {
    const transaction = database.transaction(store, 'readonly')
    const query = transaction.objectStore(store).getAll()
    query.onsuccess = () => resolve(query.result)
    query.onerror = () => reject(query.error)
  })
  const note = (await read('notes')).find((candidate) => candidate.title === noteTitle)
  const objects = (await read('spatialObjects')).filter((object) => object.noteId === note.id)
  database.close()
  return objects
}, title)

test.describe('Task 4 attachment annotations', () => {
  test('annotates a PDF non-destructively and restores the page overlay after reload', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    await createNote(page, `Annotated source ${Date.now()}`)

    let resources = await openResources(page)
    await resources.locator('input[type="file"]').setInputFiles({
      name: 'review-source.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer(),
    })
    await expect(resources.getByLabel('PDF page 1')).toBeVisible({ timeout: 30_000 })
    await resources.getByRole('button', { name: 'Annotate page' }).click()

    let annotation = page.getByRole('dialog', { name: /annotate review-source\.pdf/i })
    await expect(annotation.getByText('Original PDF is unchanged')).toBeVisible()
    const surface = annotation.getByRole('application', { name: 'Annotations for source page 1' })
    await expect(surface).toBeVisible({ timeout: 30_000 })
    const box = await surface.boundingBox()
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.35)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45, { steps: 12 })
    await page.mouse.up()
    await expect(annotation.getByRole('status')).toContainText('1 annotation')
    await expect.poll(() => annotationObjectCount(page)).toBe(1)
    await page.screenshot({ path: testInfo.outputPath('pdf-annotation-desktop-light.png'), fullPage: true })

    await annotation.getByRole('button', { name: 'Done' }).click()
    await resources.getByRole('button', { name: 'Close', exact: true }).last().click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    resources = await openResources(page)
    await expect(resources.getByText('review-source.pdf')).toBeVisible()
    await resources.getByRole('button', { name: 'Annotate page' }).click()
    annotation = page.getByRole('dialog', { name: /annotate review-source\.pdf/i })
    await expect(annotation.getByRole('status')).toContainText('1 annotation')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('pdf-annotation-compact-light.png'), fullPage: true })

    await page.evaluate(() => localStorage.setItem(
      'quicknotes-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 })
    ))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveClass(/dark/)
    resources = await openResources(page)
    await resources.getByRole('button', { name: 'Annotate page' }).click()
    annotation = page.getByRole('dialog', { name: /annotate review-source\.pdf/i })
    await expect(annotation.getByRole('status')).toContainText('1 annotation')
    await page.screenshot({ path: testInfo.outputPath('pdf-annotation-desktop-dark.png'), fullPage: true })
    expect(errors).toEqual([])
  })

  test('converts only selected high-confidence ink to an editable shape and retains source ink for replay', async ({ page }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page)
    const title = `Shape conversion ${Date.now()}`
    await createCanvas(page, title)

    const canvas = page.getByRole('application', { name: /infinite canvas/i })
    const box = await canvas.boundingBox()
    const start = { x: box.x + 230, y: box.y + 260 }
    const end = { x: box.x + 510, y: box.y + 264 }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 18 })
    await page.mouse.up()
    await expect.poll(async () => (await canvasObjects(page, title)).length).toBe(1)

    await page.getByRole('button', { name: 'Select (V)' }).click()
    await page.mouse.click((start.x + end.x) / 2, (start.y + end.y) / 2)
    const convert = page.getByRole('button', { name: /convert to line/i })
    await expect(convert).toBeVisible()
    await convert.click()
    await expect.poll(async () => (await canvasObjects(page, title)).length).toBe(2)
    let objects = await canvasObjects(page, title)
    expect(objects.find((object) => object.kind === 'stroke')).toMatchObject({ data: { hidden: true } })
    expect(objects.find((object) => object.kind === 'shape')).toMatchObject({ data: { shape: 'line' } })

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await canvasObjects(page, title)).length).toBe(1)
    expect((await canvasObjects(page, title))[0].data.hidden).not.toBe(true)
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect.poll(async () => (await canvasObjects(page, title)).length).toBe(2)

    await page.getByRole('button', { name: 'Replay ink' }).click()
    await expect(page.getByRole('button', { name: 'Stop ink replay' })).toBeVisible()
    await expect.poll(async () => (await canvasObjects(page, title)).length).toBe(2)
    await page.getByRole('button', { name: 'Stop ink replay' }).click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('application', { name: /infinite canvas/i })).toBeVisible({ timeout: 30_000 })
    objects = await canvasObjects(page, title)
    expect(objects).toHaveLength(2)
    expect(objects.find((object) => object.kind === 'shape').data.sourceStrokeIds).toContain(objects.find((object) => object.kind === 'stroke').id)
    expect(errors).toEqual([])
  })

  test('annotates a selected spatial image without changing its canonical payload', async ({ page }) => {
    const errors = collectErrors(page)
    await signIn(page)
    const title = `Image annotation ${Date.now()}`
    await createCanvas(page, title)
    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
      name: 'annotation-source.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    })
    await expect.poll(async () => (await canvasObjects(page, title)).filter((object) => object.kind === 'image').length).toBe(1)
    await page.getByRole('button', { name: 'Annotate' }).click()

    const annotation = page.getByRole('dialog', { name: /annotate annotation-source\.png/i })
    await expect(annotation.getByText('Original image is unchanged')).toBeVisible()
    const surface = annotation.getByRole('application', { name: 'Annotations for source page 1' })
    const box = await surface.boundingBox()
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55, { steps: 10 })
    await page.mouse.up()
    await expect(annotation.getByRole('status')).toContainText('1 annotation')
    await expect.poll(() => annotationObjectCount(page)).toBe(1)

    const payloadBefore = await page.evaluate(async () => {
      const request = indexedDB.open('QuickNotesDB')
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const rows = await new Promise((resolve, reject) => {
        const query = database.transaction('resources', 'readonly').objectStore('resources').getAll()
        query.onsuccess = () => resolve(query.result)
        query.onerror = () => reject(query.error)
      })
      database.close()
      return rows[0].data
    })
    await annotation.getByRole('button', { name: 'Done' }).click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => annotationObjectCount(page)).toBe(1)
    const payloadAfter = await page.evaluate(async () => {
      const request = indexedDB.open('QuickNotesDB')
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const rows = await new Promise((resolve, reject) => {
        const query = database.transaction('resources', 'readonly').objectStore('resources').getAll()
        query.onsuccess = () => resolve(query.result)
        query.onerror = () => reject(query.error)
      })
      database.close()
      return rows[0].data
    })
    expect(payloadAfter).toBe(payloadBefore)
    expect(errors).toEqual([])
  })
})
