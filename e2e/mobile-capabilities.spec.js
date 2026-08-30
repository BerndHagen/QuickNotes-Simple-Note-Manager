import { expect, test } from '@playwright/test'
import { collectErrors, dragTouch, expectNoHorizontalOverflow, pinchTouch, signIn } from './helpers'

const createSpatialWorkspace = async (page, kind, title) => {
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const dialog = page.getByRole('dialog', { name: /new workspace/i })
  await dialog.locator('section[aria-label="Workspace types"]')
    .getByRole('button', { name: new RegExp(`^${kind}`, 'i') })
    .click()
  await dialog.getByLabel('Note title').fill(title)
  await dialog.getByRole('button', { name: /^Create / }).click()
  await page.locator('.note-card', { hasText: title }).click()
}

const spatialObjects = (page, title) => page.evaluate(async (noteTitle) => {
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

test.describe('mobile capability parity', () => {
  test('draws, pans, places, edits, moves, and resizes Paper content with touch', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)
    const title = `Touch Paper ${Date.now()}`
    await createSpatialWorkspace(page, 'Paper', title)

    const pageDrawer = page.getByRole('complementary', { name: 'Paper pages' })
    await expect(pageDrawer).toHaveCount(0)
    await page.getByRole('button', { name: 'Show pages' }).click()
    await expect(pageDrawer).toBeVisible()
    await pageDrawer.getByRole('button', { name: 'Hide pages' }).click()
    await expect(pageDrawer).toHaveCount(0)

    const instruments = page.getByLabel('Writing instrument')
    await expect(instruments.locator('option:not([disabled])')).toHaveCount(9)
    await instruments.selectOption('brushPen')

    const surface = page.getByRole('application', { name: /page 1/i })
    const box = await surface.boundingBox()
    const activeInk = surface.locator('.qn-spatial-ink--active')
    const activeInkPixels = () => activeInk.evaluate((canvas) => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      let opaque = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) opaque += 1
      }
      return opaque
    })
    await dragTouch(page,
      { x: box.x + 50, y: box.y + 90 },
      { x: box.x + 155, y: box.y + 150 },
      {
        steps: 12,
        beforeRelease: async () => expect.poll(activeInkPixels).toBeGreaterThan(0),
      }
    )
    await expect.poll(async () => (await spatialObjects(page, title)).filter((item) => item.kind === 'stroke').length).toBe(1)
    await expect.poll(async () => (await spatialObjects(page, title)).find((item) => item.kind === 'stroke')?.data?.brush).toBe('brushPen')

    await page.getByLabel('Insert object').selectOption('sticky')
    await dragTouch(page,
      { x: box.x + 35, y: box.y + 210 },
      { x: box.x + 35, y: box.y + 210 },
      { steps: 1 }
    )
    await expect.poll(async () => (await spatialObjects(page, title)).filter((item) => item.kind === 'sticky').length).toBe(1)
    await page.getByRole('button', { name: 'Edit text' }).click()
    const stickyText = page.getByLabel('Sticky note text')
    await stickyText.fill('Edited while travelling')
    await stickyText.blur()
    await expect.poll(async () => (await spatialObjects(page, title)).find((item) => item.kind === 'sticky')?.data?.text).toBe('Edited while travelling')

    const resize = page.getByRole('button', { name: 'Resize selected object' })
    const resizeBox = await resize.boundingBox()
    const widthBefore = (await spatialObjects(page, title)).find((item) => item.kind === 'sticky').bounds.width
    await dragTouch(page,
      { x: resizeBox.x + resizeBox.width / 2, y: resizeBox.y + resizeBox.height / 2 },
      { x: resizeBox.x + resizeBox.width / 2 + 42, y: resizeBox.y + resizeBox.height / 2 + 26 },
      { steps: 8 }
    )
    await expect.poll(async () => (await spatialObjects(page, title)).find((item) => item.kind === 'sticky')?.bounds?.width).toBeGreaterThan(widthBefore + 25)

    await page.getByRole('button', { name: 'Select (V)' }).click()
    const stickyBefore = (await spatialObjects(page, title)).find((item) => item.kind === 'sticky')
    const paperScale = box.width / 794
    const start = {
      x: box.x + (stickyBefore.bounds.x + 40) * paperScale,
      y: box.y + (stickyBefore.bounds.y + 40) * paperScale,
    }
    await dragTouch(page, start, { x: start.x + 34, y: start.y + 26 }, { steps: 8 })
    await expect.poll(async () => (await spatialObjects(page, title)).find((item) => item.kind === 'sticky')?.bounds?.x).toBeGreaterThan(stickyBefore.bounds.x + 20)
    await page.screenshot({ path: testInfo.outputPath('mobile-paper-touch.png') })

    const stage = page.locator('.qn-paper-stage')
    const zoomBeforePinch = Number.parseInt((await page.getByLabel('Current zoom').textContent()), 10)
    const pinchBox = await surface.boundingBox()
    await pinchTouch(
      page,
      { x: pinchBox.x + pinchBox.width * 0.42, y: pinchBox.y + 180 },
      { x: pinchBox.x + pinchBox.width * 0.58, y: pinchBox.y + 180 },
      { x: pinchBox.x + pinchBox.width * 0.24, y: pinchBox.y + 180 },
      { x: pinchBox.x + pinchBox.width * 0.76, y: pinchBox.y + 180 },
    )
    await expect.poll(async () => Number.parseInt((await page.getByLabel('Current zoom').textContent()), 10)).toBeGreaterThan(zoomBeforePinch)
    const panTool = page.getByRole('button', { name: 'Pan (Space)' })
    await panTool.click()
    await expect(panTool).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => stage.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(100)
    const scrollBefore = await stage.evaluate((element) => element.scrollLeft)
    await dragTouch(page,
      { x: box.x + 225, y: box.y + 570 },
      { x: box.x + 100, y: box.y + 570 },
      { steps: 8 }
    )
    await expect.poll(() => stage.evaluate((element) => element.scrollLeft)).toBeGreaterThan(scrollBefore + 50)

    // Return to a useful overview, add a page through the real phone drawer,
    // close the drawer, and continue writing on the newly active page.
    for (let attempts = 0; attempts < 20; attempts += 1) {
      const current = Number.parseInt((await page.getByLabel('Current zoom').textContent()), 10)
      if (current <= zoomBeforePinch) break
      await page.getByRole('button', { name: 'Zoom out' }).click()
    }
    await expect.poll(async () => Number.parseInt((await page.getByLabel('Current zoom').textContent()), 10))
      .toBeLessThanOrEqual(zoomBeforePinch)
    await page.getByRole('button', { name: 'Show pages' }).click()
    await pageDrawer.getByRole('button', { name: 'Add page' }).click()
    await expect(pageDrawer.getByText('Page 2', { exact: true })).toBeVisible()
    await pageDrawer.getByRole('button', { name: 'Hide pages' }).click()
    const secondPage = page.getByRole('application', { name: /page 2/i })
    await secondPage.scrollIntoViewIfNeeded()
    const secondBox = await secondPage.boundingBox()
    await page.getByLabel('Writing instrument').selectOption('pen')
    await dragTouch(page,
      { x: secondBox.x + 55, y: secondBox.y + 90 },
      { x: secondBox.x + 150, y: secondBox.y + 135 },
      { steps: 10 }
    )
    await expect.poll(async () => (await spatialObjects(page, title)).filter((item) => item.kind === 'stroke').length).toBe(2)
    await page.getByRole('button', { name: 'Show pages' }).click()
    await pageDrawer.getByRole('button', { name: /Page 1/i }).click()
    await expect(page.getByRole('application', { name: /page 1/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('draws on Canvas and attachment annotations with actual touch pointers', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)
    const title = `Touch Canvas ${Date.now()}`
    await createSpatialWorkspace(page, 'Canvas', title)

    const canvas = page.getByRole('application', { name: /infinite canvas/i })
    const canvasBox = await canvas.boundingBox()
    await dragTouch(page,
      { x: canvasBox.x + 45, y: canvasBox.y + 90 },
      { x: canvasBox.x + 180, y: canvasBox.y + 155 },
      { steps: 12 }
    )
    await expect.poll(async () => (await spatialObjects(page, title)).filter((item) => item.kind === 'stroke').length).toBe(1)

    await page.getByLabel('Insert object').selectOption('rectangle')
    await dragTouch(page,
      { x: canvasBox.x + 55, y: canvasBox.y + 235 },
      { x: canvasBox.x + 175, y: canvasBox.y + 315 },
      { steps: 10 }
    )
    await expect.poll(async () => (await spatialObjects(page, title)).filter((item) => item.kind === 'shape').length).toBe(1)

    await page.getByRole('button', { name: 'Stroke eraser (E)' }).click()
    await dragTouch(page,
      { x: canvasBox.x + 105, y: canvasBox.y + 119 },
      { x: canvasBox.x + 125, y: canvasBox.y + 132 },
      { steps: 6 }
    )
    await expect.poll(async () => (await spatialObjects(page, title)).filter((item) => item.kind === 'stroke').length).toBe(0)

    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
      name: 'mobile-annotation.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    })
    await expect.poll(async () => (await spatialObjects(page, title)).filter((item) => item.kind === 'image').length).toBe(1)
    await page.getByRole('button', { name: 'Annotate' }).click()

    const annotation = page.getByRole('dialog', { name: /annotate mobile-annotation\.png/i })
    const annotationSurface = annotation.getByRole('application', { name: /annotations for source page 1/i })
    const annotationBox = await annotationSurface.boundingBox()
    const annotationActiveInk = annotationSurface.locator('.qn-spatial-ink--active')
    const annotationActivePixels = () => annotationActiveInk.evaluate((canvas) => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      let opaque = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) opaque += 1
      }
      return opaque
    })
    await dragTouch(page,
      { x: annotationBox.x + 45, y: annotationBox.y + 100 },
      { x: annotationBox.x + 190, y: annotationBox.y + 170 },
      {
        steps: 12,
        beforeRelease: async () => expect.poll(annotationActivePixels).toBeGreaterThan(0),
      }
    )
    await expect(annotation.getByRole('status')).toContainText('1 annotation')
    await expect.poll(() => annotationObjectCount(page)).toBe(1)
    const annotationPan = annotation.getByRole('button', { name: 'Pan attachment' })
    await annotationPan.click()
    await expect(annotationPan).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({ path: testInfo.outputPath('mobile-canvas-annotation-touch.png') })
    await expectNoHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('provides mobile note details and stable history behavior', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)
    await page.locator('.note-card', { hasText: 'Welcome to QuickNotes' }).click()
    await page.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Note details' }).click()

    const details = page.getByRole('dialog', { name: 'Note details' })
    await expect(details).toBeVisible()
    await expect(details.getByRole('tab', { name: 'Info' })).toBeVisible()
    await details.getByRole('tab', { name: 'Outline' }).click()
    await expect(details.getByRole('tabpanel')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-note-details.png') })
    await page.goBack()
    await expect(details).toHaveCount(0)
    await expect(page.getByLabel('Note title')).toBeVisible()

    await page.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Note details' }).click()
    await expect(details).toBeVisible()
    await page.setViewportSize({ width: 900, height: 844 })
    await expect(details).toHaveCount(0)
  })
})
