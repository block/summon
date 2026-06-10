import { defineConfig, devices } from '@playwright/test';

const galleryPort = Number(process.env.SUMMON_GALLERY_PORT ?? 5174);
const galleryBaseUrl = `http://127.0.0.1:${galleryPort}`;
const galleryApiPort = Number(process.env.SUMMON_GALLERY_API_PORT ?? 3015);

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: galleryBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @summon-example/surface-gallery dev',
    url: galleryBaseUrl,
    env: {
      ...process.env,
      SUMMON_GALLERY_PORT: String(galleryPort),
      SUMMON_GALLERY_API_TARGET: `http://127.0.0.1:${galleryApiPort}`,
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
