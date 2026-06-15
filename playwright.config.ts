import { defineConfig, devices } from '@playwright/test';

const safetyPort = Number(process.env.SUMMON_SAFETY_PORT ?? 5173);
const safetyBaseUrl = `http://127.0.0.1:${safetyPort}`;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: safetyBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: `pnpm --filter @summon-internal/demo dev --host 127.0.0.1 --port ${safetyPort} --strictPort`,
    url: `${safetyBaseUrl}/generate`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
