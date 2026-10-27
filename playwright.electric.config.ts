import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './src/features/electric-practical/tests', testMatch: 'ui.spec.ts', fullyParallel: false, workers: 1, retries: 0,
  timeout: 90000, expect: { timeout: 10000 }, outputDir: 'test-results/electric',
  reporter: [['list'], ['json', { outputFile: 'docs/electric-practical/evidence/e2e-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4337', locale: 'ko-KR', trace: 'retain-on-failure', screenshot: 'only-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1100 } } }],
  webServer: { command: `npm run ${process.env.ELECTRIC_PREVIEW ? 'preview' : 'dev'} -- ${process.env.ELECTRIC_PREVIEW ? '--outDir .electric-preview' : ''} --host 127.0.0.1 --port 4337`, url: 'http://127.0.0.1:4337/tools/electric-practical', reuseExistingServer: !process.env.CI && !process.env.ELECTRIC_PREVIEW, timeout: 120000 },
});
