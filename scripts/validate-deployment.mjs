/* global URL, caches, clearTimeout, console, navigator, process, setTimeout, window */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(projectRoot, 'dist')
const results = []

async function check(name, callback) {
  try {
    await callback()
    results.push({ name, passed: true })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, passed: false, error })
    console.error(`FAIL ${name}`)
    console.error(`     ${error.message}`)
  }
}

function extractAttribute(html, selectorPattern, attribute) {
  const tag = html.match(selectorPattern)?.[0]
  return tag?.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'))?.[1]
}

function getPngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex')
  assert.equal(signature, '89504e470d0a1a0a', 'file is not a PNG')
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', 'PNG has no IHDR header')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function contentType(filePath) {
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  }
  return types[path.extname(filePath)] || 'application/octet-stream'
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function startStaticServer(basePath) {
  const notFoundPath = path.join(distRoot, '404.html')
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://127.0.0.1')
      const decodedPath = decodeURIComponent(requestUrl.pathname)
      let relativePath = null

      if (decodedPath === basePath.slice(0, -1)) {
        response.writeHead(308, { Location: basePath })
        response.end()
        return
      }

      if (decodedPath.startsWith(basePath)) {
        relativePath = decodedPath.slice(basePath.length)
      }

      let filePath = relativePath === null
        ? null
        : path.resolve(distRoot, relativePath || 'index.html')

      if (filePath && !filePath.startsWith(`${distRoot}${path.sep}`)) filePath = null
      if (filePath && await fileExists(filePath) && (await stat(filePath)).isDirectory()) {
        filePath = path.join(filePath, 'index.html')
      }

      const found = filePath && await fileExists(filePath) && (await stat(filePath)).isFile()
      const responsePath = found ? filePath : notFoundPath
      response.writeHead(found ? 200 : 404, {
        'Cache-Control': 'no-store',
        'Content-Type': contentType(responsePath),
      })
      createReadStream(responsePath).pipe(response)
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(error.message)
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.closeAllConnections()
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}

await access(distRoot)
const html = await readFile(path.join(distRoot, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(path.join(distRoot, 'manifest.json'), 'utf8'))
const buildManifestText = await readFile(path.join(distRoot, 'build-assets.json'), 'utf8')
const buildManifest = JSON.parse(buildManifestText)
const worker = await readFile(path.join(distRoot, 'sw.js'), 'utf8')
const modulePath = extractAttribute(html, /<script\b(?=[^>]*\btype=["']module["'])[^>]*>/i, 'src')
assert.ok(modulePath, 'production HTML has no module entry point')
const basePath = new URL(modulePath, 'https://deployment.invalid').pathname.replace(/assets\/[^/]+$/, '')

await check('manifest uses deployment-relative identity and launch URLs', () => {
  assert.equal(manifest.id, './')
  assert.equal(manifest.start_url, './')
  assert.equal(manifest.scope, './')
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `${icon.src} is coupled to one host path`)
    assert.equal(icon.purpose, 'any', `${icon.src} is not a dedicated maskable icon`)
  }
  for (const shortcut of manifest.shortcuts || []) {
    assert.ok(!shortcut.url.startsWith('/'), `${shortcut.url} is coupled to one host path`)
  }
})

await check('manifest icon declarations match valid PNG files', async () => {
  const icons = [
    ...manifest.icons,
    ...(manifest.shortcuts || []).flatMap(shortcut => shortcut.icons || []),
  ]
  for (const icon of icons) {
    const iconPath = path.resolve(path.join(distRoot, path.dirname('manifest.json')), icon.src)
    assert.ok(iconPath.startsWith(`${distRoot}${path.sep}`), `${icon.src} resolves outside dist`)
    const dimensions = getPngDimensions(await readFile(iconPath))
    assert.equal(`${dimensions.width}x${dimensions.height}`, icon.sizes, `${icon.src} size is incorrect`)
    assert.equal(icon.type, 'image/png')
  }
})

await check('HTML metadata and shell assets use the configured base path', async () => {
  assert.match(html, /http-equiv=["']Content-Security-Policy["']/i)
  const manifestPath = extractAttribute(html, /<link\b(?=[^>]*\brel=["']manifest["'])[^>]*>/i, 'href')
  const shellPath = extractAttribute(html, /<script\b(?=[^>]*\bsrc=["'][^"']*app-shell\.js["'])[^>]*>/i, 'src')
  assert.equal(manifestPath, `${basePath}manifest.json`)
  assert.equal(shellPath, `${basePath}app-shell.js`)
  await access(path.join(distRoot, 'app-shell.js'))
  assert.ok(!html.includes('__QUICKNOTES_BASE_PATH__'))
})

await check('build manifest references files contained in the deployment', async () => {
  const assets = new Set()
  for (const entry of Object.values(buildManifest)) {
    for (const asset of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
      if (asset) assets.add(asset)
    }
  }
  assert.ok(assets.size, 'build manifest contains no assets')
  for (const asset of assets) {
    const assetPath = path.resolve(distRoot, asset)
    assert.ok(assetPath.startsWith(`${distRoot}${path.sep}`), `${asset} resolves outside dist`)
    await access(assetPath)
  }
})

await check('service worker cache revision matches the generated build', () => {
  const buildId = createHash('sha256').update(buildManifestText).digest('hex').slice(0, 12)
  assert.ok(!worker.includes('__QUICKNOTES_BUILD_ID__'))
  assert.match(worker, new RegExp(`const BUILD_ID = ['"]${buildId}['"]`))
})

await check('GitHub Pages fallback restores path, query, and fragment', async () => {
  const server = await startStaticServer(basePath)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const page = await context.newPage()
    const targetPath = `${basePath}folder/deep-note`
    await page.goto(`${server.origin}${targetPath}?share=abc%26def&mode=readonly#details`, {
      waitUntil: 'networkidle',
    })
    await page.waitForFunction(
      expectedPath => window.location.pathname === expectedPath,
      targetPath,
      { timeout: 5_000 },
    )
    const location = await page.evaluate(() => ({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    }))
    assert.deepEqual(location, {
      pathname: targetPath,
      search: '?share=abc%26def&mode=readonly',
      hash: '#details',
    })
    assert.ok(await page.locator('#root > *').count(), 'application did not render after fallback')
    await context.close()
  } finally {
    await browser.close()
    await server.close()
  }
})

await check('installed application reloads with only service-worker storage available', async () => {
  const server = await startStaticServer(basePath)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'allow' })
    const page = await context.newPage()
    const failedAssets = []
    const browserMessages = []
    page.on('console', message => {
      if (message.type() === 'warning' || message.type() === 'error') {
        browserMessages.push(message.text())
      }
    })
    page.on('requestfailed', request => {
      if (request.url().includes('/assets/')) failedAssets.push(request.url())
    })

    await page.goto(`${server.origin}${basePath}`, { waitUntil: 'networkidle' })
    assert.ok(await page.locator('#root > *').count(), 'application did not render online')
    try {
      await page.evaluate(async () => {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('service worker did not become ready')), 10_000)
          }),
        ])
        if (!navigator.serviceWorker.controller) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('service worker did not claim the page')), 10_000)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              clearTimeout(timeout)
              resolve()
            }, { once: true })
          })
        }
      })
    } catch (error) {
      const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations())
        .map(registration => ({
          scope: registration.scope,
          active: registration.active?.state,
          installing: registration.installing?.state,
          waiting: registration.waiting?.state,
        })))
      throw new Error(`${error.message}; registrations=${JSON.stringify(registrations)}; console=${JSON.stringify(browserMessages)}`)
    }

    const cachedPaths = await page.evaluate(async () => {
      const paths = []
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName)
        paths.push(...(await cache.keys()).map(request => new URL(request.url).pathname))
      }
      return paths
    })
    const requiredAssets = new Set(
      Object.values(buildManifest).flatMap(entry => [
        entry.file,
        ...(entry.css || []),
        ...(entry.assets || []),
      ]).filter(Boolean).map(asset => new URL(asset, `https://deployment.invalid${basePath}`).pathname),
    )
    requiredAssets.add(`${basePath}build-assets.json`)
    for (const assetPath of requiredAssets) {
      assert.ok(cachedPaths.includes(assetPath), `${assetPath} was not precached`)
    }

    const session = await context.newCDPSession(page)
    await session.send('Network.clearBrowserCache')
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('#root > *').first().waitFor()
    assert.deepEqual(failedAssets, [])
    assert.deepEqual(
      browserMessages.filter(message => /content security policy|refused to/i.test(message)),
      [],
    )
    await context.close()
  } finally {
    await browser.close()
    await server.close()
  }
})

const failures = results.filter(result => !result.passed)
console.log(`\n${results.length - failures.length}/${results.length} deployment checks passed.`)
if (failures.length) process.exitCode = 1
