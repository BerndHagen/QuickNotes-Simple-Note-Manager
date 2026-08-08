import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.E2E_PORT || 5210
const EXTERNAL_BASE = process.env.E2E_BASE_URL?.trim()
const BASE = EXTERNAL_BASE || `http://localhost:${PORT}/QuickNotes-Simple-Note-Manager/`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // GitHub's headless Chromium process can occasionally terminate before a
  // page is created. One CI-only retry starts a fresh worker/browser while
  // preserving every assertion and the first-attempt trace.
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile-webkit\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-webkit',
      testMatch: /mobile-webkit\.spec\.js/,
      use: { ...devices['iPhone 13'] },
    },
  ],
  // Serves the production build from `dist/`, so run `npm run build` first.
  // An already-running server on PORT is reused.
  webServer: EXTERNAL_BASE
    ? undefined
    : {
        command: `npm run preview -- --port ${PORT} --strictPort`,
        url: BASE,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
