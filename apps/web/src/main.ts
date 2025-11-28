import { OpenPanel } from '@openpanel/web'
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import 'temporal-polyfill/global'
import '@fontsource-variable/roboto'

const openPanelConfig = globalThis.__APP_CONFIG__?.openPanel

if (openPanelConfig?.clientId) {
  const openPanel = new OpenPanel({
    clientId: openPanelConfig.clientId,
    apiUrl: openPanelConfig.apiUrl,
    trackScreenViews: true,
    trackOutgoingLinks: true,
    trackAttributes: true,
  })

  // Ensure the tracker is kept alive even if unused elsewhere.
  void openPanel
}

createApp(App).mount('#app')
