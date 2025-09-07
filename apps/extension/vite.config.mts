import { dirname, relative } from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { isDev, port, r } from './scripts/utils'
import packageJson from './package.json'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? `http://localhost:${port}/` : '/dist/',
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
    origin: `http://localhost:${port}`,
  },
  root: r('../web/'),
  resolve: {
    alias: [
      { find: '@web', replacement: Bun.fileURLToPath(new URL('../web/src', import.meta.url)) },
      { find: '@api', replacement: Bun.fileURLToPath(new URL('../api/src', import.meta.url)) },
      { find: '@libs', replacement: Bun.fileURLToPath(new URL('../../packages/libs/src', import.meta.url)) },
    ],
  },
  define: {
    __DEV__: isDev,
    __NAME__: JSON.stringify(packageJson.name),
  },
  plugins: [
    tailwindcss(),
    vue(),

    // ignore PWA badge component
    // since the extension cannot be a PWA
    {
      name: 'ignore-pwa-badge',
      resolveId(id) {
        if (id.includes('PWABadge.vue')) return id
      },
      load(id) {
        if (id.includes('PWABadge.vue')) return '<template></template>'
      },
    },

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
  optimizeDeps: {
    include: [
      'vue',
      '@vueuse/core',
      'webextension-polyfill',
    ],
  },
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
