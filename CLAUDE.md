# PlanningSup Development Guide

## Commands
- **Development**: `npm run dev` - Start dev server with Docker
- **Build**: `npm run build` - Build project
- **Lint**: `npm run lint` - Run ESLint on js, vue and mjs files
- **Test**: `npm run test` - Run all tests
- **Single Test**: `npx mocha --exit test/calendar.test.js` - Run specific test file
- **Real-world Tests**: `npm run real-world-test` - Run Playwright tests
- **Docker Development**: `npm run dev-test` - Start test environment

## Code Style
- **Framework**: Vue.js (Nuxt 2) + Vuetify
- **Imports**: Standard ES modules, group by type
- **Component Names**: PascalCase, multi-word (`DialogSettings.vue`)
- **Variable Names**: camelCase
- **Types**: Uses JSDoc comments for type hints, TypeScript definitions in `@types` folder
- **Error Handling**: Use try/catch blocks, return appropriate status codes in API routes
- **Vue Component Structure**: Template -> Script -> Style (scoped)
- **ESLint**: Follows `eslint:recommended`, `standard`, `plugin:vue/recommended`, and `plugin:nuxt/recommended`
- **Testing**: Mocha for backend, Playwright for E2E

## Git Workflow
- Commit messages follow semantic format: `type: description`
- Create feature branches from main