// SPDX-License-Identifier: MIT
// Playwright config for the verification harness.
//   GAME_URL   build under test (default: the root build served by tools/serve.js)
//   PORT       port of the bundled static server (default 4173)
//   REPORT_JSON  where the JSON report is written (default test-results/results.json)
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4173);
const GAME_URL = process.env.GAME_URL || `http://127.0.0.1:${PORT}/index.html`;

module.exports = defineConfig({
  testDir: './harness/tests',
  timeout: 30_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['json', { outputFile: process.env.REPORT_JSON || 'test-results/results.json' }]],
  use: { baseURL: GAME_URL, browserName: 'chromium', headless: true },
  webServer: {
    command: 'node tools/serve.js',
    url: `http://127.0.0.1:${PORT}/index.html`,
    env: { PORT: String(PORT) },
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
