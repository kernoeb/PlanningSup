import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
// import { bundleStats } from 'rollup-plugin-bundle-stats'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

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
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: 'PlanningSup',
        short_name: 'PlanningSup',
        description: 'Un planning simple et efficace pour les étudiants',
        theme_color: '#000000',
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },

      devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    }),
    // bundleStats(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:20000',
    },
  },
})
