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

browser.runtime.onMessage.addListener((message: any) => {
  console.log('onMessage', message)
  if (message.type === 'openUrl') {
    browser.tabs.create({ url: message.url })
  }
})

browser.runtime.onMessageExternal.addListener((request: any, _sender: any, sendResponse: any) => {
  console.log('onMessageExternal', request)
  if (request.type === 'authCallback') browser.runtime.sendMessage(request)
  return sendResponse({ received: true })
})
