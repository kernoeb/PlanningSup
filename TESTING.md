# Testing Guide

This guide explains how to run all types of tests in the PlanningSup project, which uses **Bun test** for unit and integration tests, and **Playwright** for E2E tests.

## Quick Start

```bash
# Run all unit tests
bun test test/*.test.ts

# Run integration tests (requires Docker)
bun run test:integration

# Run E2E tests (requires Docker)
bun run test:e2e

# Run E2E tests with debugging
bun run test:e2e:debug
```

## Test Types Overview

### 1. Unit Tests 🧪

- **Location**: `test/*.test.ts`
- **Runner**: Bun test
- **Purpose**: Test individual functions and modules in isolation
- **Examples**: `jobs.test.ts`, `plannings.routes.test.ts`, `plannings.schema.test.ts`

### 2. Integration Tests 🔗

- **Location**: `test/integration/*.test.ts`
- **Runner**: Bun test
- **Purpose**: Test API endpoints with real HTTP requests
- **Requirements**: Docker environment with PostgreSQL

### 3. E2E Tests 🌐

- **Location**: `test/e2e/*.spec.ts`
- **Runner**: Playwright
- **Purpose**: Test complete user workflows in a real browser
- **Requirements**: Docker environment + Playwright browsers

## Detailed Test Instructions

### Unit Tests

Unit tests run quickly and don't require any external dependencies:

```bash
# Run all unit tests (glob pattern)
bun test test/*.test.ts

# Run specific test file
bun test test/jobs.test.ts

# Run tests with verbose output
bun test test/jobs.test.ts --verbose

# Run tests in watch mode during development
bun test test/jobs.test.ts --watch

# Run only tests that match a pattern
bun test test/jobs.test.ts --test-name-pattern "quiet hours"
```

**Available unit test files:**

- `test/jobs.test.ts` - Job scheduling and quiet hours functionality
- `test/plannings.routes.test.ts` - API route handlers with mocked dependencies
- `test/plannings.schema.test.ts` - Planning JSON file validation

### Integration Tests

Integration tests require a running application with a real database:

```bash
# Full integration test (builds Docker image, starts services, runs tests)
bun run test:integration

# Run integration tests with existing Docker image (faster for development)
bun run test:integration:local

# Run with verbose output for debugging
bun run test:integration --verbose

# Keep containers running after tests for debugging
bun run test:integration --no-cleanup

# Run integration tests directly (if environment is already running)
bun test test/integration/
```

**Integration test options:**

- `--skip-build` - Skip Docker image build step
- `--docker-image IMAGE` - Use specific Docker image
- `--no-cleanup` - Don't cleanup containers after tests
- `--verbose` - Show detailed output

**What integration tests cover:**

- API endpoint responses (`/api/ping`, `/api/plannings`)
- Planning details and events fetching
- Query parameter handling (timezone, colors, blocklist)
- Error handling for invalid requests
- Database interactions with backup events

### E2E Tests

E2E tests run in real browsers and test complete user workflows:

```bash
# Run E2E tests (Chrome only, fast)
bun run test:e2e

# Run E2E tests with full browser coverage (Chrome + Safari)
bun run test:e2e:safari

# Run E2E tests in headed mode (see browser window)
bun run test:e2e:headed

# Run E2E tests with debugging and verbose output
bun run test:e2e:debug
```

**E2E test options:**

- `--safari` - Include Safari tests (Chrome only by default)
- `--headed` - Run tests in headed mode (for debugging)
- `--verbose` - Show detailed test output
- `--workers NUM` - Number of parallel workers (default: 4)
- `--no-cleanup` - Don't cleanup containers after tests

**What E2E tests cover:**

- Application loading and navigation
- Planning picker functionality
- Calendar interaction and navigation
- Responsive design on mobile/desktop
- Theme switching
- User menu interactions
- Keyboard navigation and accessibility
- Error handling and application stability

### Running Tests in Development

#### Fast Development Workflow

```bash
# 1. Start the development environment once
docker compose -f docker-compose.test.yml up -d

# 2. Run unit tests (no Docker needed)
bun test test/jobs.test.ts --watch

# 3. Run integration tests with existing containers
bun run test:integration:local

# 4. Run E2E tests with existing containers
bun run test:e2e --no-cleanup
```

#### Debugging Failed Tests

```bash
# Run E2E tests in headed mode to see what's happening
bun run test:e2e:debug

# Run integration tests with verbose output
bun run test:integration --verbose --no-cleanup

# Check application logs when tests fail
docker logs planningsup-app-test

# Keep test environment running for manual testing
bun run test:integration --no-cleanup
# Then visit http://localhost:20000 in your browser
```

## Configuration Files

### Bun Test Configuration

- **File**: `bunfig.toml`
- **Purpose**: Configure test timeouts and settings for Bun test

```toml
[test]
timeout = 30000
```

### Playwright Configuration

- **File**: `playwright.config.ts`
- **Purpose**: Configure browsers, test files, and E2E test settings

### Docker Test Environment

- **File**: `docker-compose.test.yml`
- **Purpose**: Define test environment with application and PostgreSQL

## Test Environment Setup

### Prerequisites

1. **Bun**: Install from https://bun.sh
2. **Docker**: Required for integration and E2E tests
3. **Git**: For cloning the repository

### First-Time Setup

```bash
# Clone the repository
git clone https://github.com/your-org/planningsup.git
cd planningsup

# Install dependencies
bun install

# Run unit tests to verify setup
bun test test/jobs.test.ts

# Test Docker environment
bun run test:integration
```

### Playwright Browser Installation

Playwright browsers are automatically installed when running E2E tests, but you can install them manually:

```bash
# Install Playwright browsers
bunx playwright install

# Install only Chromium (faster)
bunx playwright install chromium

# Install with system dependencies (Linux)
bunx playwright install --with-deps
```

## Continuous Integration

### GitHub Actions

The project includes GitHub Actions workflows that run tests automatically:

1. **Docker Build & Test** (`docker-publish.yml`)
   - Builds Docker image
   - Runs integration tests with Bun test
   - Runs E2E tests with Playwright
   - Publishes Docker image only if tests pass

2. **Extension Build** (`extension-build.yml`)
   - Builds browser extension
   - Runs linting and type checking

### Test Results

- **Integration tests**: Results shown in GitHub Actions logs
- **E2E tests**: Screenshots and videos uploaded as artifacts on failure
- **Test reports**: Available in workflow artifacts

## Troubleshooting

### Common Issues

#### Unit Tests

```bash
# Issue: "Module not found" errors
# Solution: Ensure all dependencies are installed
bun install

# Issue: Type errors in tests
# Solution: Run type checking
bun run typecheck

# Issue: Tests running E2E files with Bun
# Solution: Use .test.ts glob pattern to exclude .spec.ts files
bun test test/*.test.ts
```

#### Integration Tests

```bash
# Issue: "Application failed to start"
# Solution: Check Docker logs
docker logs planningsup-app-test

# Issue: Database connection errors
# Solution: Ensure PostgreSQL is running
docker compose -f docker-compose.test.yml ps

# Issue: Port already in use
# Solution: Stop existing containers
docker compose -f docker-compose.test.yml down
```

#### E2E Tests

```bash
# Issue: "Browser not found"
# Solution: Install Playwright browsers
bunx playwright install

# Issue: Tests timing out
# Solution: Increase workers or run in headed mode
bun run test:e2e --workers 2 --headed

# Issue: "Cannot connect to application"
# Solution: Verify test environment is running
curl http://localhost:20000/api/ping
```

### Getting Help

1. **Check logs**: Always check Docker logs for application issues
2. **Run in debug mode**: Use `--verbose` and `--headed` flags
3. **Isolate the issue**: Run specific test files to narrow down problems
4. **Clean slate**: Stop all containers and restart

```bash
# Clean up everything and start fresh
docker compose -f docker-compose.test.yml down -v --remove-orphans
bun run test:integration
```

## Best Practices

### Writing Tests

1. **Unit tests**: Test functions in isolation with mocked dependencies
2. **Integration tests**: Test API endpoints with real HTTP requests
3. **E2E tests**: Test complete user workflows, not individual functions

### Test Organization

- Keep test files close to the code they test
- Use descriptive test names that explain what is being tested
- Group related tests using `describe` blocks
- Use `beforeAll`/`afterAll` for setup/cleanup

### Performance

1. **Run unit tests frequently** (they're fast)
2. **Run integration tests before commits** (medium speed)
3. **Run E2E tests before pushes** (slower but comprehensive)
4. **Use parallel execution** for faster E2E tests

### CI/CD Integration

- All tests must pass before merging PRs
- Integration and E2E tests run automatically on push
- Test artifacts (screenshots, videos) are preserved for debugging
- Docker images are only published after successful tests

## Test Scripts Reference

| Script               | Command                          | Purpose                                    |
| -------------------- | -------------------------------- | ------------------------------------------ |
| Unit tests           | `bun test test/*.test.ts`        | Fast unit tests                            |
| Integration (full)   | `bun run test:integration`       | Full integration test suite                |
| Integration (local)  | `bun run test:integration:local` | Use existing Docker image                  |
| Integration (direct) | `bun test test/integration/`     | Run tests directly if environment is ready |
| E2E (fast)           | `bun run test:e2e`               | Chrome-only E2E tests                      |
| E2E (full)           | `bun run test:e2e:safari`        | All browsers E2E tests                     |
| E2E (debug)          | `bun run test:e2e:debug`         | Headed mode with verbose output            |

## Important Notes

### Bun Test Limitations

- **No glob ignore patterns**: Bun test doesn't support `--ignore-pattern` flag
- **Use filename patterns**: Use `*.test.ts` to target unit tests and exclude `*.spec.ts` E2E tests
- **E2E files are incompatible**: Never run `.spec.ts` files with `bun test` - they're Playwright tests

### Correct vs Incorrect Commands

✅ **Correct:**

```bash
# Unit tests - glob pattern
bun test test/*.test.ts

# Integration tests - directory path
bun test test/integration/

# E2E tests - use scripts
bun run test:e2e
```

❌ **Incorrect:**

```bash
# This doesn't work - no ignore-pattern flag
bun test test/ --ignore-pattern="**/e2e/**"

# This doesn't work - tries to run Playwright tests with Bun
bun test test/

# This doesn't work - quoted globs don't expand properly
bun test "test/*.test.ts"
```

---

For more detailed information about specific test types, see the test files in the `test/` directory or check the GitHub Actions workflows in `.github/workflows/`.
