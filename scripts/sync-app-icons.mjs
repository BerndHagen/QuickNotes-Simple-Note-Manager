/* global console, document, Image */

import { readFile, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(projectRoot, 'images', 'quicknotes-editor-logo.png')
const outputDir = path.join(projectRoot, 'public', 'icons')
const sizes = [16, 32, 96, 192, 512]
const source = await readFile(sourcePath)
const sourceUrl = `data:image/png;base64,${source.toString('base64')}`
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage()
  const rendered = await page.evaluate(async ({ sourceUrl, sizes }) => {
    const image = new Image()
    image.src = sourceUrl
    await image.decode()

    return sizes.map((size) => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.clearRect(0, 0, size, size)
      context.drawImage(image, 0, 0, size, size)
      return {
        size,
        png: canvas.toDataURL('image/png').split(',')[1],
      }
    })
  }, { sourceUrl, sizes })

  await Promise.all(rendered.map(({ size, png }) => writeFile(
    path.join(outputDir, `icon-${size}x${size}.png`),
    Buffer.from(png, 'base64'),
  )))
} finally {
  await browser.close()
}

console.log(`Updated ${sizes.length} application icons from ${path.relative(projectRoot, sourcePath)}`)
