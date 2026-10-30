import { defineConfig, devices } from '@playwright/test';

const PF = '--port';
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
  // PREVIEW=1 tests the production build (run npm run build first).
  webServer: { command: process.env.PREVIEW ? 'npx vite preview ' + PF + ' 5179 --strictPort' : 'npx vite ' + PF + ' 5179 --strictPort', url: URL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
