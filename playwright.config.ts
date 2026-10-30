import { defineConfig, devices } from '@playwright/test';

const URL = 'http://localhost:5179';

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: URL, trace: 'retain-on-failure' },
  projects: [{ name: 'android-phone', use: { ...devices['Pixel 7'] } }],
  webServer: { command: 'npx vite --port 5179 --strictPort', url: URL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
