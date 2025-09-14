# GitHub Workflows Documentation

This directory contains GitHub Actions workflows for automating builds and deployments.

## Workflows

### 1. Docker Build and Test (`docker-publish.yml`)

- **Purpose**: Builds Docker images, runs integration tests, and publishes images only if tests pass
- **Triggers**: Push to main branch, tags, and pull requests
- **Outputs**: Docker images published to GitHub Container Registry (only after successful tests)
- **Testing**: Includes Bun test integration tests and Playwright E2E tests with PostgreSQL 17

### 2. Extension Build (`extension-build.yml`)

- **Purpose**: Builds the browser extension for Chrome and Firefox
- **Triggers**:
  - Push to `main` or `develop` branches (when extension files change)
  - Pull requests to `main` or `develop` branches (when extension files change)
  - Manual workflow dispatch
- **Outputs**: GitHub artifacts containing built extensions

## Docker Build and Test Workflow

### Integration Testing

The Docker workflow now includes comprehensive integration testing:

1. **Build Phase**
   - Builds Docker image locally (without pushing)
   - Sets up PostgreSQL 17 service for database tests
   - Starts application container for testing

2. **Test Phase**
   - **Bun Test Integration Tests**: API endpoint testing
   - **Playwright E2E Tests**: Browser-based UI testing
   - **Basic API Validation**: Curl-based endpoint checks

3. **Publish Phase**
   - Only pushes Docker image if all tests pass
   - Prevents broken images from being published
   - Includes build provenance attestation

### Test Configuration

- **Bun Test**: Uses `bunfig.toml` configuration with integration tests in `test/integration/`
- **Playwright**: Uses `playwright.config.ts` for E2E tests in `test/e2e/`
- **Test Files**: Located in `test/integration/` and `test/e2e/`
- **Application URL**: `http://localhost:20000`
- **Database**: PostgreSQL 17 with test credentials

### Benefits

- **Quality Assurance**: No broken images published
- **Efficiency**: Single workflow, no duplicate builds
- **Fast Feedback**: Tests run immediately after build
- **Comprehensive Coverage**: API + UI + Database integration

## Extension Build Workflow

### What it does

1. **Environment Setup**
   - Sets up Bun runtime using version from `.bun-version` file
   - Installs dependencies with caching
   - Verifies extension directory structure

2. **Quality Checks**
   - TypeScript type checking
   - ESLint code linting

3. **Build Process**
   - Builds the extension for production
   - Creates platform-specific packages:
     - `.crx` file for Chrome/Chromium browsers
     - `.xpi` file for Firefox
     - `.zip` file for manual installation

4. **Artifact Creation**
   - Uploads built extensions as GitHub artifacts
   - Includes source code and build logs
   - Artifacts are retained for 90 days (30 days for source)

### Artifacts Created

Each workflow run creates the following artifacts:

- `planningsup-chrome-extension-{run-number}-{sha}` - Chrome extension (.crx)
- `planningsup-firefox-extension-{run-number}-{sha}` - Firefox extension (.xpi)
- `planningsup-extension-zip-{run-number}-{sha}` - Generic ZIP package
- `planningsup-extension-source-{run-number}-{sha}` - Built source code

### Manual Workflow Triggers

The extension build workflow can be manually triggered with additional options:

1. Go to **Actions** tab in the GitHub repository
2. Select **Extension Build** workflow
3. Click **Run workflow**
4. Options:
   - `create_release`: Creates a GitHub release with the built extensions

### Installation Instructions

#### Chrome/Chromium

1. Download the `.crx` file from the artifacts
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Drag and drop the `.crx` file onto the extensions page

#### Firefox

1. Download the `.xpi` file from the artifacts
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon (⚙️) and select "Install Add-on From File"
4. Select the downloaded `.xpi` file

#### Manual Installation (Any Browser)

1. Download the `.zip` file from the artifacts
2. Extract the ZIP file to a folder
3. Open your browser's extension management page
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

### Development

#### Local Building

To build the extension locally:

```bash
cd apps/extension
bun install
bun run build
bun run pack
```

#### File Structure

```
apps/extension/
├── extension/          # Built extension files
├── scripts/           # Build scripts
├── src/              # Source code
├── package.json      # Extension configuration
└── vite.config.mts   # Build configuration
```

#### Environment Variables

- `NODE_ENV`: Set to `production` for builds
- `EXTENSION`: Set to `firefox` for Firefox-specific builds
- `VITE_BACKEND_URL`: Backend API URL (development only)

#### Version Consistency

The project uses a `.bun-version` file to ensure consistent Bun versions across:

- GitHub Actions workflows (extension build and Docker build)
- Docker images
- Local development environments

To update the Bun version, simply edit the `.bun-version` file:

```bash
# Update your local Bun
bun upgrade

# Update the version file
echo "1.3.0" > .bun-version
```

Both workflows and Docker builds will automatically use the new version.

### Troubleshooting

#### Build Failures

1. **Type Errors**: Check the TypeScript output in the workflow logs
2. **Lint Errors**: Review ESLint output and fix code style issues
3. **Missing Dependencies**: Verify `bun.lock` is up to date

#### Artifact Issues

1. **Missing Artifacts**: Check if the build completed successfully
2. **Large File Sizes**: Consider optimizing dependencies or splitting code
3. **Browser Compatibility**: Test the extension in the target browser

#### Workflow Triggers

The workflow only runs when files in these paths change:

- `apps/extension/**`
- `packages/**`
- `package.json`
- `bun.lock`
- `.bun-version`
- `.github/workflows/extension-build.yml`

### Security

- Artifacts are automatically cleaned up after retention period
- Fork PRs have restricted permissions
- No sensitive information is exposed in logs
- Extensions are built in isolated environments

### Performance

- Dependency caching reduces build times
- Concurrent packaging for multiple formats
- Optimized artifact compression
- Build summary provides quick status overview
- Version consistency eliminates environment-related build issues

## Contributing

When modifying workflows:

1. Test changes in a fork first
2. Verify artifact creation works correctly
3. Check that all quality gates pass
4. Update this documentation if needed

For extension-specific changes, see `apps/extension/README.md`.
