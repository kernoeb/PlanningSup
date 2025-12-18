// import { bundleStats } from 'rollup-plugin-bundle-stats'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { getAliases, getCommonPlugins, getDefaultProxy } from '../../packages/config/vite/shared.ts'

export default defineConfig({
  resolve: {
    alias: getAliases(import.meta.url),
  },
  define: {
    __PWA_ENABLED__: true,
  },
  plugins: [
    ...getCommonPlugins(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,

      manifest: {
        name: 'PlanningSup',
        short_name: 'PlanningSup',
        description: 'Votre calendrier universitaire, simple, rapide, efficace',
        theme_color: '#000000',
        lang: 'fr',
        screenshots: [
          {
            src: 'screenshots/mobile.png',
            sizes: '612x1016',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: 'screenshots/wide.png',
            sizes: '1541x1016',
            type: 'image/png',
            form_factor: 'wide',
          },
        ],
        icons: [
          {
            purpose: 'maskable',
            src: 'maskable_icon_x48.png',
            sizes: '48x48',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            src: 'maskable_icon_x72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            src: 'maskable_icon_x96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            src: 'maskable_icon_x128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            src: 'maskable_icon_x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            src: 'maskable_icon_x384.png',
            sizes: '384x384',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            src: 'maskable_icon_x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            purpose: 'any',
            src: 'icon.png',
            sizes: '1024x1024',
            type: 'image/png',
          },
        ],
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
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
    proxy: getDefaultProxy(),
  },
})
