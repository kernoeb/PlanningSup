import type { App } from '@api/api'
import { treaty } from '@elysiajs/eden'
import { isTauri } from '@tauri-apps/api/core'

const isTauriApp = isTauri()
console.log('Is Tauri app:', isTauriApp)

const fetcher = isTauriApp
  ? await import('@tauri-apps/plugin-http').then(m => m.fetch) as typeof fetch
  : fetch

console.log('Using fetcher:', isTauriApp ? 'Tauri HTTP' : 'Native fetch')
const url = import.meta.env.VITE_BACKEND_URL || window.location.origin
console.log('Backend URL:', url)

export const client = treaty<App>(url, {
  fetcher,
})
