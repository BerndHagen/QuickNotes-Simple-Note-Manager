import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const repositoryName = 'QuickNotes-Simple-Note-Manager'

function normalizeBasePath(value) {
  const candidate = value.trim()
  if (!candidate || candidate === '/') return '/'

  const withLeadingSlash = candidate.startsWith('/') ? candidate : `/${candidate}`
  const normalized = withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
  let decoded
  try {
    decoded = decodeURIComponent(normalized)
  } catch {
    throw new Error('VITE_BASE_PATH contains invalid URL encoding.')
  }
  const containsDotSegment = decoded.split('/').some(segment => segment === '.' || segment === '..')
  const containsEncodedSeparator = decoded.includes('//') || /[\\?#]/.test(decoded)
  if (!/^\/[A-Za-z0-9._~/%-]+\/$/.test(normalized) || containsEncodedSeparator || containsDotSegment) {
    throw new Error('VITE_BASE_PATH must be an absolute URL path such as "/notes/" or "/".')
  }
  return normalized
}

function defaultBasePath({ command, isPreview }) {
  if (command === 'serve' && !isPreview) return '/'

  const githubRepository = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
  if (githubRepository) {
    return githubRepository.toLowerCase().endsWith('.github.io') ? '/' : `/${githubRepository}/`
  }

  return `/${repositoryName}/`
}

function deploymentAssetsPlugin(basePath) {
  return {
    name: 'quicknotes-deployment-assets',
    apply: 'build',
    // Vite 8's environment build can invoke closeBundle before Rolldown has
    // written the client output. writeBundle is the first hook where the
    // manifest and copied public assets are guaranteed to exist.
    async writeBundle() {
      const fallbackPath = fileURLToPath(new URL('./dist/404.html', import.meta.url))
      const fallback = await readFile(fallbackPath, 'utf8')
      const marker = '__QUICKNOTES_BASE_PATH__'
      if (!fallback.includes(marker)) {
        throw new Error('The GitHub Pages fallback is missing its base-path marker.')
      }
      await writeFile(fallbackPath, fallback.replaceAll(marker, basePath))

      const buildManifestPath = fileURLToPath(new URL('./dist/build-assets.json', import.meta.url))
      const buildManifest = await readFile(buildManifestPath, 'utf8')
      const buildId = createHash('sha256').update(buildManifest).digest('hex').slice(0, 12)
      const workerPath = fileURLToPath(new URL('./dist/sw.js', import.meta.url))
      const worker = await readFile(workerPath, 'utf8')
      const buildMarker = '__QUICKNOTES_BUILD_ID__'
      if (!worker.includes(buildMarker)) {
        throw new Error('The service worker is missing its build identifier marker.')
      }
      await writeFile(workerPath, worker.replaceAll(buildMarker, buildId))
    },
  }
}

export default defineConfig(configEnvironment => {
  const env = loadEnv(configEnvironment.mode, projectRoot, 'VITE_BASE_PATH')
  const base = normalizeBasePath(
    env.VITE_BASE_PATH || defaultBasePath(configEnvironment),
  )

  return {
    base,
    plugins: [react(), deploymentAssetsPlugin(base)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      manifest: 'build-assets.json',
      sourcemap: false,
      rolldownOptions: {
        output: {
          // The document editor is loaded on demand, but its engine used to
          // land in one 700+ KB chunk. Keep dependency families intact: using
          // maxSize here can cut an inheritance cycle at an unsafe evaluation
          // boundary (a production-only `class extends undefined` failure).
          // Vite 8 uses Rolldown's native codeSplitting API.
          codeSplitting: {
            groups: [
              {
                name: 'editor-foundation',
                test: /node_modules[\\/](@tiptap[\\/](?:core|pm)|prosemirror)/,
                minSize: 20_000,
                priority: 30,
              },
              {
                name: 'editor-extensions',
                test: /node_modules[\\/]@tiptap[\\/](?:extension-|starter-kit)/,
                minSize: 20_000,
                priority: 20,
              },
              {
                name: 'editor-highlighting',
                test: /node_modules[\\/](?:lowlight|highlight\.js)/,
                minSize: 20_000,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    // IndexedDB integration files intentionally exercise the production
    // QuickNotesDB name. Running those files concurrently lets independent
    // fake-indexeddb cleanup hooks erase each other's fixtures and makes the
    // release gate nondeterministic, so keep file execution serial.
    test: {
      fileParallelism: false,
    },
  }
})
