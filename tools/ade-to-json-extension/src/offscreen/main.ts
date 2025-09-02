import { onMessage } from 'webext-bridge/window'

onMessage('copy-to-clipboard', ({ data }: { data: { text: string } }) => {
  const container = document.getElementById('copy-container') as HTMLDivElement
  if (!container) {
    console.error('Container not found in offscreen document.')
    return { success: false, error: 'Offscreen container not found.' }
  }

  try {
    container.textContent = data.text
    const range = document.createRange()
    range.selectNodeContents(container)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
    const success = document.execCommand('copy')
    if (!success)
      throw new Error('document.execCommand returned false')

    return { success: true }
  }
  catch (error) {
    console.error('Failed to copy in offscreen document:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
  finally {
    // Clean up selection
    const selection = window.getSelection()
    if (selection)
      selection.removeAllRanges()
  }
})
