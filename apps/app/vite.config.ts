import { defineConfig } from 'vite'
import { getAliases, getCommonPlugins, getOptimizeDeps } from '../../packages/config/vite/shared'

const host = Bun.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  root: import.meta.dirname,
  optimizeDeps: getOptimizeDeps(),
  resolve: {
    alias: getAliases(import.meta.url),
  },
  plugins: getCommonPlugins({ addIgnorePWABadge: true }),
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
