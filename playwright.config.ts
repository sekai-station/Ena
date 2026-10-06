import { defineConfig } from '@playwright/test'

// End-to-end tests (pnpm test:e2e). The default edition is built for production
// and served by `vite preview`; it talks to the mock API in e2e/mock.mjs, so no
// backend is needed. First run on a new machine: pnpm exec playwright install chromium
const API = 'http://127.0.0.1:8787/station/api/v2'
const OUT = 'e2e/.output/intl'

export default defineConfig({
  testDir: 'e2e',
  // The tests share the mock server's state, so they run one at a time, in order
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  reporter: 'list',
  use: { browserName: 'chromium', actionTimeout: 15_000 },
  webServer: [
    { command: 'node e2e/mock.mjs', url: 'http://127.0.0.1:8787/ctl/up' },
    {
      command: `vite build --outDir ${OUT} --emptyOutDir && vite preview --outDir ${OUT} --host 127.0.0.1 --port 5199 --strictPort`,
      url: 'http://127.0.0.1:5199/',
      env: { VITE_API_BASE: API },
      timeout: 180_000,
    },
  ],
})
