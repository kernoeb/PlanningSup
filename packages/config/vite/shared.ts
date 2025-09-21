/* Shared Vite config helpers (ESM JS)
 * - Path resolvers (root, aliases)
 * - Common plugins (tailwindcss, vue)
 * - Ignore-PWA-badge plugin
 * - Default dev proxy
 *
 * Import from vite configs with:
 *   import { getAliases, getCommonPlugins, getDefaultProxy, getRoot, fromHere } from '../../packages/config/vite/shared.mjs'
 */

import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import type { PluginOption } from 'vite'

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
 * Plugin that stubs out the PWABadge component.
 * Useful for environments that are not PWAs (e.g., Tauri app, browser extension).
 */
export function ignorePWABadgePlugin(name = 'ignore-pwa-badge') {
  console.log('Applying ignore-PWA-badge plugin')
  return {
    name,
    resolveId(id: string) {
      if (id.includes('PWABadge.vue')) return id
      return null
    },
    load(id: string) {
      if (id.includes('PWABadge.vue')) return '<template></template>'
      return null
    },
  }
}

/**
 * Returns the set of plugins that are common across apps.
 * By default includes tailwindcss and vue plugins.
 * Optionally adds the ignore-PWA-badge plugin (enabled by default).
 */
export function getCommonPlugins(options: { addIgnorePWABadge?: boolean } = {}) {
  const plugins = [tailwindcss(), vue()] as PluginOption[]
  if (options.addIgnorePWABadge) plugins.push(ignorePWABadgePlugin())
  return plugins
}

/**
 * Returns the default dev proxy shared across apps.
 */
export function getDefaultProxy() {
  return {
    '/api': 'http://localhost:20000',
    '/config.js': 'http://localhost:20000',
  }
}
