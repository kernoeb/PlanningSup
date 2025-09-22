/* eslint-disable no-console */
import './treeExpander'

// Initialize on load, when page is shown again, and when tab becomes visible
function initOnce() {
  if ((initOnce as any)._done) {
    return
  }

  (initOnce as any)._done = true
  console.info('[vitesse-webext] Content script initialized')
}

if (document.visibilityState !== 'hidden')
  initOnce()

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden')
    initOnce()
})

window.addEventListener('pageshow', () => {
  initOnce()
})

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
;(() => true)()
