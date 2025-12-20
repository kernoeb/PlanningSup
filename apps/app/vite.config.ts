import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { getAliases, getCommonPlugins, getDefaultDefine, getOptimizeDeps } from '../../packages/config/vite/shared'

const host = Bun.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  root: import.meta.dirname,
  optimizeDeps: getOptimizeDeps(),
  resolve: {
    alias: [
      ...getAliases(import.meta.url),
      { find: 'virtual:pwa-register/vue', replacement: fileURLToPath(new URL('../web/src/utils/pwa/register-stub.ts', import.meta.url)) },
    ],
  },
  define: {
    ...getDefaultDefine(),
    __PWA_ENABLED__: false,
  },
  plugins: getCommonPlugins(),
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
})
