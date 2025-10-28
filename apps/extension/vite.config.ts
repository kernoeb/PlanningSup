import { dirname, relative } from 'node:path'
import { defineConfig } from 'vite'

import { getAliases, getCommonPlugins, getOptimizeDeps, getRoot } from '../../packages/config/vite/shared'
import packageJson from './package.json'
import { isDev, port, r } from './scripts/utils'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? `http://localhost:${port}/` : '/dist/',
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
    origin: `http://localhost:${port}`,
  },
  root: getRoot(import.meta.url),
  resolve: {
    alias: getAliases(import.meta.url),
  },
  define: {
    __DEV__: isDev,
    __NAME__: JSON.stringify(packageJson.name),
  },
  plugins: [
    ...getCommonPlugins({ addIgnorePWABadge: true }),

    // rewrite assets to use relative path
    {
      name: 'assets-rewrite',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml(html, { path }) {
        return html.replace(/"\/assets\//g, `"${relative(dirname(path), '/assets')}/`)
      },
    },
  ],
  optimizeDeps: getOptimizeDeps(),
  build: {
    watch: isDev
      ? {}
      : undefined,
    outDir: r('extension/dist'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
    terserOptions: {
      mangle: false,
    },
    rollupOptions: {
      input: {
        sidepanel: r('../web/index.html'),
      },
    },
  },
}))
