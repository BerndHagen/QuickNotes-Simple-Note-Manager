import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { collectErrors, createNote, expectNoHorizontalOverflow, signIn } from './helpers'

const silentWav = () => {
  const sampleRate = 8_000
  const samples = sampleRate / 4
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}

test('imported audio keeps unavailable external transcription honest and responsive', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await createNote(page, `Audio source ${Date.now()}`)

  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Attachments and recordings' }).click()
  let dialog = page.getByRole('dialog', { name: 'Attachments and recordings' })
  await dialog.locator('input[type="file"][accept*="audio"]').setInputFiles({
    name: 'imported-meeting.wav',
    mimeType: 'audio/wav',
    buffer: silentWav(),
  })
  await expect(dialog.getByRole('heading', { name: 'imported-meeting.wav' })).toBeVisible()
  await expect(dialog.getByText('Audio-file transcription unavailable')).toBeVisible()
  await expect(dialog.getByText(/sign in to a quicknotes cloud account/i)).toBeVisible()
  await expect(dialog.getByRole('button', { name: /transcribe audio/i })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('audio-file-unavailable-light.png'), fullPage: true })

  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(violations.map((violation) => `${violation.id}:${violation.nodes.length}`).join('\n')).toBe('')

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('audio-file-unavailable-compact.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: /^settings$/i }).first().click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('button', { name: 'General', exact: true }).click()
  await settings.getByRole('button', { name: 'Dark', exact: true }).click()
  await settings.getByRole('button', { name: /close settings/i }).click()
  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Attachments and recordings' }).click()
  dialog = page.getByRole('dialog', { name: 'Attachments and recordings' })
  await expect(dialog.getByText('Audio-file transcription unavailable')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('audio-file-unavailable-dark.png'), fullPage: true })

  expect(errors).toEqual([])
})
