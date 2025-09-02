import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@web', replacement: Bun.fileURLToPath(new URL('../web/src', import.meta.url)) },
      { find: '@api', replacement: Bun.fileURLToPath(new URL('../api/src', import.meta.url)) },
      { find: '@libs', replacement: Bun.fileURLToPath(new URL('../../packages/libs/src', import.meta.url)) },
    ],
  },
  plugins: [
    tailwindcss(),
    vue(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:20000',
    },
  },
})
