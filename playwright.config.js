// Playwright settings for UI checks (PRD requirement 93).
// Run with: npm run test:ui
// UI checks are not part of `npm test` and do not run in the pre-commit hook.

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.UI_TEST_PORT) || 8766;

export default defineConfig({
  testDir: './tests-ui',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Starts the browser-mode web server for the checks, and stops it afterwards.
  webServer: {
    command: 'node tools/serve.js',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
