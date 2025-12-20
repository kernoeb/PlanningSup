/* Shared Vite config helpers (ESM JS)
 * - Path resolvers (root, aliases)
 * - Common plugins (tailwindcss, vue)
 * - Default dev proxy
 *
 * Import from vite configs with:
 *   import { getAliases, getCommonPlugins, getDefaultProxy, getRoot, fromHere } from '../../packages/config/vite/shared.mjs'
 */

import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import type { PluginOption } from 'vite'
import { join } from 'node:path'

const packageJson = await Bun.file(join(import.meta.dirname, '../../../package.json')).json() as { displayName: string, version: string }

/**
 * Resolve a filesystem path from a given import.meta.url and a relative URL segment.
 * Always returns a path string that Vite understands.
 */
export function fromHere(importMetaUrl: string, relative: string) {
  return fileURLToPath(new URL(relative, importMetaUrl))
}

/**
 * Returns the monorepo web app root directory for a given consumer config file.
 * Example (from apps/app/vite.config.ts): getRoot(import.meta.url) -> apps/web/
 */
export function getRoot(importMetaUrl: string) {
  return fromHere(importMetaUrl, '../web/')
}

/**
 * Returns the shared alias list for the monorepo.
 * - @web  -> ../web/src
 * - @api  -> ../api/src
 * - @libs -> ../../packages/libs/src
 */
export function getAliases(importMetaUrl: string) {
  return [
    { find: '@web', replacement: fromHere(importMetaUrl, '../web/src') },
    { find: '@api', replacement: fromHere(importMetaUrl, '../api/src') },
    { find: '@libs', replacement: fromHere(importMetaUrl, '../../packages/libs/src') },
  ]
}

export function getOptimizeDeps() {
  return {
    exclude: ['virtual:pwa-register/vue'],
  }
}

/**
 * Returns the set of plugins that are common across apps.
 * By default includes tailwindcss and vue plugins.
 */
export function getCommonPlugins() {
  const plugins = [
    tailwindcss(),
    vue({
      template: {
        compilerOptions: {
          // Treat cally web components as custom elements
          isCustomElement: tag => tag.startsWith('calendar-'),
        },
      },
    }),
  ] as PluginOption[]
  return plugins
}

/**
 * Returns the default dev proxy shared across apps.
 */
export function getDefaultProxy() {
  return {
    '/api': 'http://localhost:20000',
    '/config.js': 'http://localhost:20000',
    '/robots.txt': 'http://localhost:20000',
    '/sitemap.xml': 'http://localhost:20000',
  }
}


/**
 * Returns the default define variables for the monorepo.
 */
export function getDefaultDefine() {
  return {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_DISPLAY_NAME__: JSON.stringify(packageJson.displayName),
  }
}
