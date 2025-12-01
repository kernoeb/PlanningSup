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

createApp(App).mount('#app')
