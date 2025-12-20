import { init as initPlausible } from '@plausible-analytics/tracker'
import { createApp } from 'vue'

import App from './App.vue'

import { runCookieMigrationOnce } from './utils/cookie-migration'
import { getPlausibleAnalyticsProps } from './utils/plausible'

import './style.css'
import 'temporal-polyfill/global'
import '@fontsource-variable/roboto'

const plausibleConfig = globalThis.__APP_CONFIG__?.plausible

if (plausibleConfig?.domain) {
  initPlausible({
    domain: plausibleConfig.domain,
    endpoint: plausibleConfig.endpoint,
    customProperties: getPlausibleAnalyticsProps,
  })
}

// PWA is only enabled in the web build via a Vite define flag.
if (typeof __PWA_ENABLED__ !== 'undefined' && __PWA_ENABLED__) {
  void import('./utils/pwa').then(m => m.initPwa())
}

async function bootstrap() {
  // Migrate legacy cookies from the old Nuxt app to the new localStorage-based settings.
  // Must run before the app mounts so composables read the migrated values on first render.
  try {
    await runCookieMigrationOnce()
  } catch (err) {
    console.warn('[cookie-migration] Failed (continuing without migration):', err)
  }
  createApp(App).mount('#app')
}

void bootstrap()
