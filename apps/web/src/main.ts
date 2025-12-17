import { init as initPlausible } from '@plausible-analytics/tracker'
import { createApp } from 'vue'
import App from './App.vue'

import './style.css'
import 'temporal-polyfill/global'
import '@fontsource-variable/roboto'

const plausibleConfig = globalThis.__APP_CONFIG__?.plausible

if (plausibleConfig?.domain) {
  initPlausible({
    domain: plausibleConfig.domain,
    endpoint: plausibleConfig.endpoint,
  })
}

// PWA is only enabled in the web build via a Vite define flag.
if (typeof __PWA_ENABLED__ !== 'undefined' && __PWA_ENABLED__) {
  void import('./pwa').then(m => m.initPwa())
}

createApp(App).mount('#app')
