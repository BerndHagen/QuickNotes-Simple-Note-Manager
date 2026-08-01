const BUILD_ID = '__QUICKNOTES_BUILD_ID__'
const CACHE_VERSION = `v4-${BUILD_ID}`
const SCOPE_URL = new URL('./', self.registration.scope)
const INDEX_URL = new URL('index.html', SCOPE_URL)
const BUILD_MANIFEST_URL = new URL('build-assets.json', SCOPE_URL)
const SCOPE_KEY = SCOPE_URL.pathname
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '') || 'root'
const CACHE_PREFIX = `quicknotes-shell-${SCOPE_KEY}-`
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`
const LEGACY_CACHE_NAMES = new Set(['quicknotes-v2', 'quicknotes-v3'])
const REQUIRED_SHELL_ASSETS = [
  'manifest.json',
  'icons/icon-16x16.png',
  'icons/icon-32x32.png',
  'icons/icon-96x96.png',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
]

function isCacheable(response) {
  return response.status === 200 && (response.type === 'basic' || response.type === 'default')
}

function isWithinScope(url) {
  return url.origin === SCOPE_URL.origin && url.pathname.startsWith(SCOPE_URL.pathname)
}

function shellAssetUrls(html) {
  const urls = new Set(REQUIRED_SHELL_ASSETS.map(asset => new URL(asset, SCOPE_URL).href))
  const attributePattern = /\b(?:href|src)=["']([^"'#]+)["']/gi

  for (const match of html.matchAll(attributePattern)) {
    const url = new URL(match[1], INDEX_URL)
    if (isWithinScope(url) && url.href !== INDEX_URL.href && url.href !== SCOPE_URL.href) {
      urls.add(url.href)
    }
  }

  return [...urls]
}

function buildAssetUrls(manifest) {
  const urls = new Set([BUILD_MANIFEST_URL.href])

  for (const entry of Object.values(manifest)) {
    for (const asset of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
      if (!asset) continue
      const url = new URL(asset, SCOPE_URL)
      if (isWithinScope(url)) urls.add(url.href)
    }
  }

  return [...urls]
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME)
  const [shellResponse, buildManifestResponse] = await Promise.all([
    fetch(new Request(INDEX_URL, { cache: 'reload' })),
    fetch(new Request(BUILD_MANIFEST_URL, { cache: 'reload' })),
  ])
  if (!isCacheable(shellResponse)) {
    throw new Error(`Unable to cache the application shell (${shellResponse.status}).`)
  }
  if (!isCacheable(buildManifestResponse)) {
    throw new Error(`Unable to load the build manifest (${buildManifestResponse.status}).`)
  }

  const responseInit = {
    status: shellResponse.status,
    statusText: shellResponse.statusText,
    headers: shellResponse.headers,
  }
  const html = await shellResponse.text()
  const buildManifest = await buildManifestResponse.json()
  await cache.addAll([
    ...new Set([...shellAssetUrls(html), ...buildAssetUrls(buildManifest)]),
  ])
  await Promise.all([
    cache.put(INDEX_URL, new Response(html, responseInit)),
    cache.put(SCOPE_URL, new Response(html, responseInit)),
  ])
}

async function fetchWithTimeout(request, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(request, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function navigationResponse(request) {
  try {
    const response = await fetchWithTimeout(request)
    const contentType = response.headers.get('content-type') || ''
    if (isCacheable(response) && contentType.includes('text/html')) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(INDEX_URL, response.clone())
      if (new URL(request.url).pathname === SCOPE_URL.pathname) {
        await cache.put(SCOPE_URL, response.clone())
      }
    }
    return response
  } catch {
    const cache = await caches.open(CACHE_NAME)
    return (await cache.match(INDEX_URL)) || new Response(
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>QuickNotes is offline</title><body><h1>QuickNotes is offline</h1><p>Reconnect once to finish installing the application.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
}

async function staticAssetResponse(event) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(event.request)
  const update = fetch(event.request).then(async response => {
    if (isCacheable(response)) await cache.put(event.request, response.clone())
    return response
  })

  if (cached) {
    event.waitUntil(update.catch(() => undefined))
    return cached
  }

  try {
    return await update
  } catch {
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precacheShell())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(cacheName => {
      const superseded = LEGACY_CACHE_NAMES.has(cacheName)
        || (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
      return superseded ? caches.delete(cacheName) : Promise.resolve(false)
    }))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return
  if (request.headers.has('range')) return

  const url = new URL(request.url)
  if (!isWithinScope(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request))
    return
  }

  const cacheableDestinations = new Set(['audio', 'font', 'image', 'manifest', 'script', 'style'])
  const isBuildAsset = url.pathname.startsWith(new URL('assets/', SCOPE_URL).pathname)
  if (cacheableDestinations.has(request.destination) || isBuildAsset) {
    event.respondWith(staticAssetResponse(event))
  }
})
