// import { bundleStats } from 'rollup-plugin-bundle-stats'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { getAliases, getCommonPlugins, getDefaultProxy } from '../../packages/config/vite/shared.ts'

export default defineConfig({
  resolve: {
    alias: getAliases(import.meta.url),
  },
  plugins: [
    ...getCommonPlugins({ addIgnorePWABadge: false }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
        lang: 'fr',
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
