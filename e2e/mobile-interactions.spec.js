import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

const expectSquare = async (locator, label) => {
  const box = await locator.boundingBox()
  expect(box, `${label} has no rendered box`).not.toBeNull()
  expect(
    Math.abs(box.width - box.height),
    `${label} is stretched (${box.width}px × ${box.height}px)`
  ).toBeLessThanOrEqual(1)
}

const openSettings = async (page) => {
  await page.getByRole('button', { name: /show navigation/i }).first().click()
  await page.getByRole('button', { name: /^settings$/i }).first().click()
  return page.getByRole('dialog', { name: 'Settings' })
}

test.describe('mobile control geometry', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true })

  test('keeps icon actions and colour swatches square', async ({ page }) => {
    await signIn(page)
    await expectSquare(page.getByRole('button', { name: /^new note$/i }), 'New note button')

    await page.getByRole('button', { name: /show navigation/i }).first().click()
    await page.getByRole('button', { name: /create.*folder/i }).click()
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    const colours = dialog.getByRole('radiogroup', { name: /colou?r/i }).getByRole('radio')
    expect(await colours.count()).toBeGreaterThan(5)
    for (const colour of await colours.all()) await expectSquare(colour, 'Folder colour swatch')
  })

  test('keeps settings switches as horizontal tracks', async ({ page }) => {
    await signIn(page)
    const dialog = await openSettings(page)
    for (const name of [/confirm before delete/i, /^spell check$/i, /show note statistics/i]) {
      const control = dialog.getByRole('switch', { name })
      const track = control.locator('xpath=following-sibling::*[@data-switch-track]')
      const box = await track.boundingBox()
      expect(box, `${name} has no rendered box`).not.toBeNull()
      expect(box.width / box.height, `${name} is not a switch-shaped control`).toBeGreaterThan(1.6)
    }
  })

  test('uses navigation, a real search field, and sync as the mobile application bar', async ({ page }) => {
    await signIn(page)
    const chrome = page.locator('.qn-top-chrome')
    const navigation = chrome.getByRole('button', { name: /show navigation/i })
    const search = chrome.getByRole('combobox', { name: 'Search all notes and content' })
    const sync = chrome.locator('.qn-top-sync:visible')

    await expect(chrome.getByLabel('QuickNotes')).toBeHidden()
    await expect(chrome.getByRole('button', { name: 'Create quick note' })).toBeHidden()
    await expect(navigation).toBeVisible()
    await expect(search).toBeVisible()
    await expect(search).toHaveAttribute('type', 'search')
    await expect(sync).toBeVisible()

    const [navigationBox, searchBox, syncBox] = await Promise.all([
      navigation.boundingBox(),
      search.boundingBox(),
      sync.boundingBox(),
    ])
    expect(searchBox.width).toBeGreaterThan(200)
    expect(navigationBox.x + navigationBox.width).toBeLessThan(searchBox.x)
    expect(searchBox.x + searchBox.width).toBeLessThan(syncBox.x + syncBox.width)

    await search.click()
    await expect(page.getByRole('dialog', { name: /global search/i })).toHaveCount(0)
    await search.fill('Welcome')
    await expect(page.getByRole('listbox', { name: 'Search results' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox', { name: 'Search results' })).toHaveCount(0)

    await page.setViewportSize({ width: 667, height: 375 })
    await expect(chrome.getByLabel('QuickNotes')).toBeHidden()
    await expect(chrome.getByRole('button', { name: 'Create quick note' })).toBeHidden()
    await expect(search).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

})

test.describe('mobile content-first editing', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true })

  test('keeps global navigation and structured-note actions reachable while content scrolls', async ({ page }) => {
    await signIn(page)

    await page.getByRole('button', { name: 'Create workspace' }).click()
    const dialog = page.getByRole('dialog', { name: /new workspace/i })
    await dialog.locator('section[aria-label="Workspace types"]')
      .getByRole('button', { name: /^Task List/i })
      .click()
    await dialog.getByText('Daily priorities', { exact: true }).click()
    await dialog.getByLabel('Note title').fill('Mobile shell audit')
    await dialog.getByRole('button', { name: /^Create / }).click()
    await page.locator('.note-card', { hasText: 'Mobile shell audit' }).click()

    const workspace = page.locator('.qn-structured-workspace')
    const noteBar = page.locator('.qn-focused-mobile-chrome > .qn-ribbon-note-bar')
    await expect(workspace).toBeVisible()
    await expect(noteBar).toBeVisible()
    await expect(page.locator('.qn-top-chrome')).toBeVisible()

    const navigationToggle = page.locator('.qn-top-chrome')
      .getByRole('button', { name: /show navigation/i })
    await expect(navigationToggle).toBeVisible()
    await navigationToggle.tap()
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()

    await noteBar.getByRole('button', { name: /more actions/i }).tap()
    await expect(page.getByRole('menuitem', { name: /attachments/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /reminder/i })).toBeVisible()
    await page.keyboard.press('Escape')

    const titleBeforeScroll = await noteBar.boundingBox()
    for (let index = 0; index < 14; index += 1) {
      await workspace.getByLabel('New task').fill(`Travel task ${index + 1}`)
      await workspace.getByRole('button', { name: 'Add task' }).click()
    }
    await workspace.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect.poll(() => workspace.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    const titleAfterScroll = await noteBar.boundingBox()
    expect(Math.abs(titleAfterScroll.y - titleBeforeScroll.y)).toBeLessThanOrEqual(1)
  })

  test('gives the note canvas most of the viewport while tools stay available', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /^new note$/i }).click()

    const editorViewport = page.locator('.ProseMirror').locator('xpath=../..')
    const editorBox = await editorViewport.boundingBox()
    expect(
      editorBox.height / 664,
      `Only ${Math.round((editorBox.height / 664) * 100)}% of the screen is available for writing`
    ).toBeGreaterThanOrEqual(0.72)

    await expect(page.locator('.qn-note-banner')).toBeHidden()
    await expect(page.locator('#qn-mobile-note-title')).toBeVisible()

    await page.getByRole('button', { name: /more actions/i }).click()
    const actions = page.getByRole('menu', { name: /more actions/i })
    await expect(actions.getByRole('menuitem', { name: /find.*replace/i })).toBeVisible()
    await expect(actions.getByRole('menuitem', { name: /favourites/i })).toBeVisible()
    await expect(actions.getByRole('menuitem', { name: /^pin note$/i })).toBeVisible()
    const tagsAction = actions.getByRole('menuitem', { name: /^tags$/i })
    await expect(tagsAction).toBeVisible()
    await tagsAction.click()
    const tagsMenu = page.getByRole('menu', { name: /^tags$/i })
    await expect(tagsMenu).toBeVisible()
    const tagsMenuBox = await tagsMenu.boundingBox()
    expect(tagsMenuBox.x).toBeGreaterThanOrEqual(7)
    expect(tagsMenuBox.x + tagsMenuBox.width).toBeLessThanOrEqual(383)
    await page.keyboard.press('Escape')

    const detailsToggle = page.getByRole('button', { name: /show note details/i })
    await expect(detailsToggle).toBeVisible()
    await expect(page.locator('#qn-note-details')).toBeHidden()
    await detailsToggle.click()
    await expect(page.getByRole('button', { name: /no folder/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /no tags/i })).toBeVisible()

    const formattingToggle = page.getByRole('button', { name: /show formatting tools/i })
    await expect(formattingToggle).toBeVisible()
    await formattingToggle.click()
    await expect(page.locator('.editor-toolbar')).toBeVisible()
    await expect(page.locator('.editor-toolbar').getByRole('button').last()).toBeAttached()
  })
})

test.describe('desktop note reordering', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('lets a pointer user drag a manually sorted note from anywhere on its card', async ({ page }) => {
    await signIn(page)
    for (const title of ['First movable note', 'Second movable note']) {
      await page.getByRole('button', { name: /^new note$/i }).click()
      await page.getByLabel('Note title').fill(title)
      await page.getByLabel('Note title').blur()
    }

    await page.getByRole('button', { name: /sort by/i }).click()
    await page.getByRole('menuitem', { name: /manual.*drag.*drop/i }).click()

    const before = (await page.locator('.note-card h3').allTextContents()).filter((title) =>
      title.includes('movable note')
    )
    expect(before).toHaveLength(2)
    const [sourceTitle, targetTitle] = before
    const source = page.locator('.note-card', { hasText: sourceTitle })
    const target = page.locator('.note-card', { hasText: targetTitle })
    const [from, to] = await Promise.all([source.boundingBox(), target.boundingBox()])
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
    await page.mouse.up()

    await expect(page.getByRole('searchbox', { name: 'Filter this list…', exact: true })).toBeVisible()
    const titles = await page.locator('.note-card h3').allTextContents()
    expect(titles.indexOf(sourceTitle)).toBeGreaterThan(titles.indexOf(targetTitle))
  })
})

test.describe('tag assignment feedback', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('updates the checkmark and selected background immediately when a tag is removed and restored', async ({ page }) => {
    await signIn(page)
    await page.locator('.note-card', { hasText: 'Welcome to QuickNotes' }).hover()
    const welcomeActions = page.getByRole('button', { name: /More actions for Welcome to QuickNotes/i })
    await welcomeActions.click()
    await page.getByRole('menuitem', { name: /Assign tags/i }).click()

    const assignMenu = page.getByRole('menu', { name: 'Assign tags' })
    const welcomeTag = assignMenu.getByRole('menuitemcheckbox', { name: '#welcome' })
    await expect(welcomeTag).toHaveAttribute('aria-checked', 'true')
    await expect(welcomeTag.locator('svg')).toHaveCount(1)
    await expect(welcomeTag).toHaveClass(/bg-accent-soft/)

    await welcomeTag.click()
    await expect(welcomeTag).toHaveAttribute('aria-checked', 'false')
    await expect(welcomeTag.locator('svg')).toHaveCount(0)
    await expect(welcomeTag).not.toHaveClass(/bg-accent-soft/)

    await welcomeTag.click()
    await expect(welcomeTag).toHaveAttribute('aria-checked', 'true')
    await expect(welcomeTag.locator('svg')).toHaveCount(1)
  })
})

test.describe('mobile note reordering', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true })

  const createMovableNotes = async (page) => {
    for (const title of ['First touch note', 'Second touch note']) {
      await page.getByRole('button', { name: /^new note$/i }).click()
      await page.getByLabel('Note title').fill(title)
      await page.getByLabel('Note title').blur()
      await page.goBack()
      await expect(page.getByRole('searchbox', { name: 'Filter this list…', exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: /sort by/i }).click()
    await page.getByRole('menuitem', { name: /manual.*drag.*drop/i }).click()
  }

  test('supports dragging from the visible touch handle', async ({ page }) => {
    await signIn(page)
    await createMovableNotes(page)

    const before = (await page.locator('.note-card h3').allTextContents()).filter((title) =>
      title.includes('touch note')
    )
    const [sourceTitle, targetTitle] = before
    const handle = page.getByRole('button', { name: `Reorder ${sourceTitle}` })
    await expect(handle).toBeVisible()
    const [from, to] = await Promise.all([
      handle.boundingBox(),
      page.locator('.note-card', { hasText: targetTitle }).boundingBox(),
    ])

    const client = await page.context().newCDPSession(page)
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
    const end = { x: start.x, y: to.y + to.height / 2 }
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    await page.waitForTimeout(220)
    for (let step = 1; step <= 8; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: start.x, y: start.y + ((end.y - start.y) * step) / 8 }],
      })
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    await expect
      .poll(async () => {
        const titles = await page.locator('.note-card h3').allTextContents()
        return titles.indexOf(sourceTitle) > titles.indexOf(targetTitle)
      })
      .toBe(true)
  })

  test('shows direct move controls when a drag gesture is inconvenient', async ({ page }) => {
    await signIn(page)
    await createMovableNotes(page)
    const before = (await page.locator('.note-card h3').allTextContents()).filter((title) =>
      title.includes('touch note')
    )
    const firstTitle = before[0]

    await expect(page.getByText(/drag a handle.*arrow buttons/i)).toBeVisible()
    await page.getByRole('button', { name: `Move ${firstTitle} down` }).click()
    await expect
      .poll(async () => {
        const titles = await page.locator('.note-card h3').allTextContents()
        return titles.indexOf(firstTitle) > titles.indexOf(before[1])
      })
      .toBe(true)
  })
})
