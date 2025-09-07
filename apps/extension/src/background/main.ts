import browser from 'webextension-polyfill'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
}

// to toggle the sidepanel with the action button in chromium:
// @ts-expect-error missing types
browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

browser.runtime.onInstalled.addListener((): void => {
  console.log('Extension installed')
})
