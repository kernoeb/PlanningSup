import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // Reduced retries
  workers: process.env.CI ? 2 : 4, // Increased parallel workers
  timeout: 20000, // Reduced from default 30s
  reporter: process.env.CI ? [
    ['html'],
    ['list'],
    ['github'],
  ] : [
    ['html'],
    ['list'],
  ],
  use: {
    // Prefer explicit IPv4 loopback to avoid environments where `localhost`
    // resolves to IPv6 (::1) but the app only listens on 127.0.0.1.
    baseURL: 'http://127.0.0.1:20000',
    trace: 'retain-on-failure', // Only on failure, not first retry
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10000, // Reduced from 15s
    navigationTimeout: 20000, // Reduced from 30s
    serviceWorkers: 'allow', // Enable service worker support for PWA testing
  },
  // Optimized browser projects - focus on Chrome for speed
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },
      },
    },
    // Run Safari tests only in CI or when specifically needed
    ...(process.env.RUN_SAFARI ? [
      {
        name: 'desktop-safari',
        use: {
          ...devices['Desktop Safari'],
          viewport: { width: 1280, height: 720 },
        },
      },
      {
        name: 'mobile-safari',
        use: {
          ...devices['iPhone 13'],
          viewport: { width: 390, height: 844 },
        },
      },
    ] : []),
  ],
  webServer: {
    // Keep a long-lived process so Playwright's webServer harness doesn't fail
    // with "exited early" when the app is already running (e.g. via Docker).
    command: 'bash -lc "curl -fsS http://127.0.0.1:20000/api/ping >/dev/null && tail -f /dev/null"',
    url: 'http://127.0.0.1:20000',
    reuseExistingServer: true,
    timeout: 5000, // Reduced timeout
  },
  outputDir: 'test-results/',
  expect: {
    timeout: 5000, // Reduced from 10s
  },
})
