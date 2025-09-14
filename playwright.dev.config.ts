import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false, // Single worker for debugging
  forbidOnly: false, // Allow .only() in dev mode
  retries: 0, // No retries in dev mode
  workers: 1, // Single worker for better debugging
  timeout: 60000, // Longer timeout for debugging
  reporter: [
    ['list'], // Detailed list output
    ['html', { open: 'on-failure' }], // Auto-open HTML report on failure
  ],
  use: {
    baseURL: 'http://localhost:20000',
    trace: 'on', // Always collect traces in dev mode
    screenshot: 'on', // Always take screenshots
    video: 'on', // Always record videos
    headless: false, // Run in headed mode for debugging
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 30000, // Longer timeouts for debugging
    navigationTimeout: 60000,
    // Slow down actions for better visibility
    launchOptions: {
      slowMo: 250,
    },
  },
  // Only Chrome for development
  projects: [
    {
      name: 'chrome-debug',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Additional Chrome flags for debugging
        launchOptions: {
          slowMo: 250,
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor'],
        },
      },
    },
  ],
  webServer: {
    command: 'echo "Application should already be running"',
    url: 'http://localhost:20000',
    reuseExistingServer: true,
    timeout: 10000,
  },
  outputDir: 'test-results-dev/',
  expect: {
    timeout: 15000, // Longer expect timeout for debugging
  },
  // Global setup for development (optional)
  // globalSetup: require.resolve('./test/e2e/global-setup-dev.ts'),
})
