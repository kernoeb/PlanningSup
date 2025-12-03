#!/usr/bin/env bun

import { $ } from "bun";

/**
 * Integration Test Runner for Auth-Enabled tests.
 *
 * This script runs integration tests with AUTH_ENABLED=true using
 * docker-compose.test-auth.yml on port 20001.
 *
 * Usage:
 *   bun scripts/test-integration-auth.ts [options]
 *
 * Options:
 *   --skip-build       Skip Docker image build step
 *   --no-cleanup       Don't cleanup containers after tests
 *   --verbose          Show detailed output
 *   --help             Show help message
 */

// Types for configuration
interface IntegrationTestConfig {
  skipBuild: boolean;
  cleanup: boolean;
  verbose: boolean;
  help: boolean;
}

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
} as const;

const COMPOSE_FILE = 'docker-compose.test-auth.yml';
const TEST_FILE = 'test/integration/auth.routes.enabled.test.ts';
const BASE_URL = 'http://localhost:20001';

// Parse command line arguments
function parseArgs(): IntegrationTestConfig {
  const config: IntegrationTestConfig = {
    skipBuild: false,
    cleanup: true,
    verbose: false,
    help: false
  };

  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--skip-build':
        config.skipBuild = true;
        break;
      case '--no-cleanup':
        config.cleanup = false;
        break;
      case '--verbose':
        config.verbose = true;
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

function header(message: string): void {
  console.log(`${colors.magenta}${message}${colors.reset}`);
}

// Show help message
function showHelp(): void {
  console.log("Usage: bun scripts/test-integration-auth.ts [options]");
  console.log("");
  console.log("Integration Test Runner for Auth-Enabled Tests");
  console.log("Tests BetterAuth routes with AUTH_ENABLED=true");
  console.log("");
  console.log("Options:");
  console.log("  --skip-build       Skip Docker image build step");
  console.log("  --no-cleanup       Don't cleanup containers after tests");
  console.log("  --verbose          Show detailed output");
  console.log("  --help             Show this help message");
  console.log("");
  console.log("Examples:");
  console.log("  bun scripts/test-integration-auth.ts");
  console.log("  bun scripts/test-integration-auth.ts --skip-build");
  console.log("  bun scripts/test-integration-auth.ts --verbose --no-cleanup");
}

// Cleanup function
async function cleanup(shouldCleanup: boolean): Promise<void> {
  if (shouldCleanup) {
    log("Cleaning up auth test containers...");
    try {
      await $`docker compose -f ${COMPOSE_FILE} down -v --remove-orphans`.quiet();
    } catch {
      // Ignore cleanup errors
    }
  } else {
    warn("Skipping cleanup (--no-cleanup specified)");
  }
}

// Check if containers are already running
async function checkContainersRunning(): Promise<boolean> {
  try {
    const result = await $`docker compose -f ${COMPOSE_FILE} ps`.quiet();
    return result.text().includes("healthy");
  } catch {
    return false;
  }
}

// Build Docker image if needed
async function buildDockerImage(config: IntegrationTestConfig): Promise<void> {
  if (config.skipBuild) {
    info("Skipping Docker build (--skip-build specified)");
    return;
  }

  info("Building Docker image for auth-enabled integration tests...");
  try {
    await $`docker compose -f ${COMPOSE_FILE} build`;
    log("✅ Docker image built successfully");
  } catch (err) {
    error("Failed to build Docker image");
    console.error(err);
    process.exit(1);
  }
}

// Start test environment
async function startTestEnvironment(): Promise<number> {
  info("🔄 Starting auth-enabled test environment...");
  const startTime = Date.now();

  try {
    await $`docker compose -f ${COMPOSE_FILE} up -d`;

    // Wait for health check
    log("Waiting for services to be ready...");

    const maxWaitTime = 60000; // 60 seconds
    const startWait = Date.now();

    while (Date.now() - startWait < maxWaitTime) {
      const result = await $`docker compose -f ${COMPOSE_FILE} ps`.quiet();
      if (result.text().includes("healthy")) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final check
    const finalCheck = await $`docker compose -f ${COMPOSE_FILE} ps`.quiet();
    if (!finalCheck.text().includes("healthy")) {
      error("Services failed to start within 60 seconds");
      const logs = await $`docker compose -f ${COMPOSE_FILE} logs`.quiet();
      console.log(logs.text());
      process.exit(1);
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    log(`✅ Auth-enabled test environment ready in ${duration}s`);
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

  const maxAttempts = 20;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BASE_URL}/api/ping`);
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
    const logs = await $`docker compose -f ${COMPOSE_FILE} logs app-test-auth`.quiet();
    console.log(logs.text());
  } catch {
    // Ignore log errors
  }
  process.exit(1);
}

// Verify auth is enabled
async function verifyAuthEnabled(): Promise<void> {
  info("Verifying AUTH_ENABLED=true in runtime config...");

  try {
    const response = await fetch(`${BASE_URL}/config.js`);
    if (!response.ok) {
      error("Failed to fetch /config.js");
      process.exit(1);
    }

    const text = await response.text();
    if (!text.includes('"authEnabled":true') && !text.includes('authEnabled:true')) {
      error("AUTH_ENABLED is not true in /config.js!");
      error("Config content:");
      console.log(text);
      process.exit(1);
    }

    log("✅ AUTH_ENABLED=true confirmed");
  } catch (err) {
    error("Failed to verify auth enabled");
    console.error(err);
    process.exit(1);
  }
}

// Run integration tests using Bun test
async function runIntegrationTests(config: IntegrationTestConfig): Promise<{ success: boolean; duration: number }> {
  log("🧪 Running auth-enabled integration tests with Bun test...");

  // Set up environment variables
  process.env.BASE_URL = BASE_URL;

  const testStart = Date.now();

  try {
    const testArgs = [
      "test",
      "--timeout", "30000",
      TEST_FILE
    ];

    if (config.verbose) {
      testArgs.push("--verbose");
    }

    await $`bun ${testArgs}`;

    const testEnd = Date.now();
    const duration = Math.round((testEnd - testStart) / 1000);

    return { success: true, duration };
  } catch {
    const testEnd = Date.now();
    const duration = Math.round((testEnd - testStart) / 1000);

    return { success: false, duration };
  }
}

// Main function
async function main(): Promise<void> {
  header("🔐 Auth-Enabled Integration Test Runner");
  console.log("==========================================");

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

  // Build Docker image if needed
  await buildDockerImage(config);

  // Check if containers are already running
  if (await checkContainersRunning()) {
    log("✅ Auth-enabled test environment already running, skipping startup");
  } else {
    startupTime = await startTestEnvironment();
  }

  // Health check
  await healthCheck();

  // Verify auth is enabled
  await verifyAuthEnabled();

  // Run integration tests
  const { success, duration: testTime } = await runIntegrationTests(config);

  if (success) {
    log("🎉 All auth-enabled integration tests passed!");
    info("Performance Summary:");
    info(`  Startup time: ${startupTime}s`);
    info(`  Test execution: ${testTime}s`);
    info(`  Total time: ${startupTime + testTime}s`);

    process.exit(0);
  } else {
    error("💥 Some auth-enabled integration tests failed");
    error(`Execution time: ${testTime}s`);

    if (!config.verbose) {
      warn("💡 Run with --verbose flag to see detailed test output");
    }

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
