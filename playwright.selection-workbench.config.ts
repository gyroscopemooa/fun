import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'selection-workbench.browser.spec.ts',
  use: { baseURL: 'http://127.0.0.1:4324', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4324', url: 'http://127.0.0.1:4324/selection-workbench/', reuseExistingServer: false, timeout: 120000, env: { ASTRO_TELEMETRY_DISABLED: '1' } },
});
