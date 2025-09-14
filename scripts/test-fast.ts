#!/usr/bin/env bun

import { $ } from "bun";

// Types for configuration
interface TestConfig {
  safari: boolean;
  cleanup: boolean;
  verbose: boolean;
  headed: boolean;
  workers: number;
  help: boolean;
}

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
} as const;

// Parse command line arguments
function parseArgs(): TestConfig {
  const config: TestConfig = {
    safari: false,
    cleanup: true,
    verbose: false,
    headed: false,
    workers: 4,
    help: false
  };

  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--safari':
        config.safari = true;
        break;
      case '--no-cleanup':
        config.cleanup = false;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--headed':
        config.headed = false;
        break;
      case '--workers':
        config.workers = parseInt(args[++i]) || 4;
        break;
      case '--help':
        config.help = true;
        break;
      default:
        console.error(`Unknown option ${args[i]}`);
        console.error("Use --help for usage information");
        process.exit(1);
    }
  }

  return config;
}

// Logging functions
function log(message: string): void {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`${colors.green}[${timestamp}]${colors.reset} ${message}`);
}

function warn(message: string): void {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`${colors.yellow}[${timestamp}]${colors.reset} ${message}`);
}

function error(message: string): void {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`${colors.red}[${timestamp}]${colors.reset} ${message}`);
}

function info(message: string): void {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`${colors.blue}[${timestamp}]${colors.reset} ${message}`);
}

// Show help message
function showHelp(): void {
  console.log("Usage: bun scripts/test-fast.ts [options]");
  console.log("");
  console.log("Fast E2E Test Runner - Optimized for speed and efficiency");
  console.log("");
  console.log("Options:");
  console.log("  --safari           Include Safari tests (Chrome only by default)");
  console.log("  --no-cleanup       Don't cleanup containers after tests");
  console.log("  --verbose          Show detailed output");
  console.log("  --headed           Run tests in headed mode (for debugging)");
  console.log("  --workers NUM      Number of parallel workers (default: 4)");
  console.log("  --help             Show this help message");
  console.log("");
  console.log("Performance optimizations:");
  console.log("  - Runs Chrome only by default (use --safari for full browser coverage)");
  console.log("  - Increased parallel workers for faster execution");
  console.log("  - Optimized test helpers with reduced waiting times");
  console.log("  - Smart container reuse to avoid startup overhead");
}

// Cleanup function
async function cleanup(shouldCleanup: boolean): Promise<void> {
  if (shouldCleanup) {
    log("Cleaning up test containers...");
    try {
      await $`docker compose -f docker-compose.test.yml down -v --remove-orphans`.quiet();
    } catch (err) {
      // Ignore cleanup errors
    }
  } else {
    warn("Skipping cleanup (--no-cleanup specified)");
  }
}

// Check if containers are already running
async function checkContainersRunning(): Promise<boolean> {
  try {
    const result = await $`docker compose -f docker-compose.test.yml ps`.quiet();
    return result.text().includes("healthy");
  } catch {
    return false;
  }
}

// Start test environment
async function startTestEnvironment(): Promise<number> {
  info("🔄 Starting test environment...");
  const startTime = Date.now();

  try {
    await $`docker compose -f docker-compose.test.yml up -d --build`;

    // Wait for health check with optimized timeout
    log("Waiting for services to be ready...");

    const maxWaitTime = 45000; // 45 seconds
    const startWait = Date.now();

    while (Date.now() - startWait < maxWaitTime) {
      const result = await $`docker compose -f docker-compose.test.yml ps`.quiet();
      if (result.text().includes("healthy")) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final check
    const finalCheck = await $`docker compose -f docker-compose.test.yml ps`.quiet();
    if (!finalCheck.text().includes("healthy")) {
      error("Services failed to start within 45 seconds");
      const logs = await $`docker compose -f docker-compose.test.yml logs`.quiet();
      console.log(logs.text());
      process.exit(1);
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    log(`✅ Test environment ready in ${duration}s`);
    return duration;
  } catch (err) {
    error("Failed to start test environment");
    console.error(err);
    process.exit(1);
  }
}

// Health check
async function healthCheck(): Promise<void> {
  info("Verifying application health...");

  const maxAttempts = 15;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch("http://localhost:20000/api/ping");
      if (response.ok) {
        const text = await response.text();
        if (text.includes("pong")) {
          log("✅ Application is healthy");
          return;
        }
      }
    } catch {
      // Continue trying
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  error("Application health check failed");
  try {
    const logs = await $`docker compose -f docker-compose.test.yml logs app-test`.quiet();
    console.log(logs.text());
  } catch {
    // Ignore log errors
  }
  process.exit(1);
}

// Install Playwright browsers
async function ensurePlaywrightBrowsers(): Promise<void> {
  const browserFile = ".playwright-browsers-installed";

  try {
    const fileExists = await Bun.file(browserFile).exists();
    const playwrightExists = await $`which playwright`.quiet().then(() => true).catch(() => false);

    if (!fileExists || !playwrightExists) {
      info("Installing/updating Playwright browsers...");
      await $`bunx playwright install chromium webkit`;
      await Bun.write(browserFile, "");
    } else {
      info("✅ Playwright browsers already installed");
    }
  } catch (err) {
    warn("Failed to check/install Playwright browsers, continuing...");
  }
}

// Run tests
async function runTests(config: TestConfig): Promise<{ success: boolean; duration: number }> {
  // Determine which projects to run
  const projects = config.safari
    ? ["desktop", "desktop-safari", "mobile", "mobile-safari"]
    : ["desktop", "mobile"];

  if (config.safari) {
    info("🌐 Running tests on Chrome + Safari (full browser coverage)");
  } else {
    info("⚡ Running tests on Chrome only (fast mode)");
  }

  // Set environment variables
  process.env.BASE_URL = "http://localhost:20000";
  process.env.RUN_SAFARI = config.safari.toString();

  // Configure Playwright options
  const playwrightOpts = [];

  if (config.verbose) {
    playwrightOpts.push("--reporter=list");
  } else {
    playwrightOpts.push("--reporter=dot");
  }

  if (!config.headed) {
    // Headless is default, no flag needed
  } else {
    playwrightOpts.push("--headed");
  }

  playwrightOpts.push(`--workers=${config.workers}`);

  // Add project selections
  for (const project of projects) {
    playwrightOpts.push(`--project=${project}`);
  }

  log("🧪 Running optimized E2E tests...");
  info("Configuration:");
  info(`  Workers: ${config.workers}`);
  info(`  Projects: ${projects.join(", ")}`);
  info(`  Headless: ${!config.headed}`);
  info(`  Verbose: ${config.verbose}`);

  const testStart = Date.now();

  try {
    await $`bunx playwright test --config playwright.config.ts ${playwrightOpts}`;
    const testEnd = Date.now();
    const duration = Math.round((testEnd - testStart) / 1000);

    return { success: true, duration };
  } catch (err) {
    const testEnd = Date.now();
    const duration = Math.round((testEnd - testStart) / 1000);

    return { success: false, duration };
  }
}

// Main function
async function main(): Promise<void> {
  console.log("🚀 Fast E2E Test Runner");
  console.log("=======================");

  const config = parseArgs();

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  // Setup cleanup handler
  process.on('exit', () => cleanup(config.cleanup));
  process.on('SIGINT', () => {
    cleanup(config.cleanup).finally(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    cleanup(config.cleanup).finally(() => process.exit(1));
  });

  let startupTime = 0;

  // Check if containers are already running
  if (await checkContainersRunning()) {
    log("✅ Test environment already running, skipping startup");
  } else {
    startupTime = await startTestEnvironment();
  }

  // Health check
  await healthCheck();

  // Install browsers
  await ensurePlaywrightBrowsers();

  // Run tests
  const { success, duration: testTime } = await runTests(config);

  if (success) {
    log("🎉 All E2E tests passed!");
    info("Performance Summary:");
    info(`  Startup time: ${startupTime}s`);
    info(`  Test execution: ${testTime}s`);
    info(`  Total time: ${startupTime + testTime}s`);

    // Performance tips
    if (!config.safari) {
      info("💡 Tip: Add --safari flag for full browser coverage when needed");
    }

    if (config.workers < 4) {
      info(`💡 Tip: Increase --workers for faster execution (current: ${config.workers})`);
    }

    process.exit(0);
  } else {
    error("💥 Some E2E tests failed");
    error(`Execution time: ${testTime}s`);

    if (!config.verbose) {
      warn("💡 Run with --verbose flag to see detailed test output");
    }

    if (!config.headed) {
      warn("💡 Run with --headed flag for visual debugging");
    }

    warn("🔍 Check test-results/ directory for screenshots and videos");

    process.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  main().catch((err) => {
    error("Script failed with error:");
    console.error(err);
    process.exit(1);
  });
}
