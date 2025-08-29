import { onMessage, sendMessage } from 'webext-bridge/background'

// @ts-expect-error - sidePanel is available in Chromium but not typed in polyfill
browser.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error))

// @ts-expect-error - onPanelOpened is available in Chromium but not typed in polyfill
;(browser.sidePanel as any)?.onPanelOpened?.addListener?.(async (_info: any) => {
  // Lazily prepare offscreen document so clipboard is ready when used
  try {
    await setupOffscreenDocument()
  }
  catch (e) {
    console.warn('sidePanel open prep failed:', e)
  }
})

let creating: Promise<void> | null

async function canUseOffscreen(): Promise<boolean> {
  const hasOffscreen = !!(browser as any)?.offscreen?.createDocument
  const hasGetContexts = typeof (browser.runtime as any)?.getContexts === 'function'
  return hasOffscreen && hasGetContexts
}

async function setupOffscreenDocument(): Promise<boolean> {
  const supported = await canUseOffscreen()
  if (!supported)
    return false

  const path = 'dist/offscreen/index.html'
  const offscreenUrl = browser.runtime.getURL(path) as string
  // getContexts not in types in some channels
  const existingContexts = await (browser.runtime as any).getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  })

  if (existingContexts.length > 0)
    return true

  if (creating)
    await creating

  // @ts-expect-error offscreen not in types in some channels
  creating = (browser.offscreen.createDocument({
    url: path,
    reasons: ['CLIPBOARD'],
    justification: 'Clipboard access for copying generated JSON',
  }) as unknown as Promise<void>)

  await creating
  creating = null
  return true
}

onMessage('copy-to-clipboard', async ({ data }: { data: { text: string } }) => {
  const canUse = await setupOffscreenDocument()

  if (canUse) {
    try {
      const result = await sendMessage('copy-to-clipboard', data, 'offscreen')
      return result
    }
    catch (e) {
      console.warn('Offscreen copy failed, falling back to page context:', e)
      // fall through to fallback below
    }
  }

  // Fallback: attempt clipboard write in the page context via scripting
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (!tabId)
      return { success: false, error: 'No active tab to perform clipboard write.' }

    const injectionResults = await browser.scripting.executeScript({
      target: { tabId },
      func: (text: string) => {
        const attemptExecCommand = () => {
          const el = document.createElement('textarea')
          el.value = text
          el.style.position = 'fixed'
          el.style.left = '-9999px'
          document.body.appendChild(el)
          el.focus()
          el.select()
          const ok = document.execCommand('copy')
          el.remove()
          return ok
        }

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text)
              .then(() => true)
              .catch(() => attemptExecCommand())
          }
          else {
            return attemptExecCommand()
          }
        }
        catch {
          return attemptExecCommand()
        }
      },
      args: [data.text],
    }) as Array<{ result?: unknown }>

    const success = Array.isArray(injectionResults) && !!injectionResults[0]?.result
    return success ? { success: true } : { success: false, error: 'Clipboard copy failed in page context.' }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})
