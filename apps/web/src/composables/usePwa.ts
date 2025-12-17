import { useRegisterSW } from 'virtual:pwa-register/vue'
import { watch } from 'vue'

export interface PwaStore {
  offlineReady: ReturnType<typeof useRegisterSW>['offlineReady']
  needRefresh: ReturnType<typeof useRegisterSW>['needRefresh']
  updateServiceWorker: ReturnType<typeof useRegisterSW>['updateServiceWorker']
}

let _instance: PwaStore | null = null

// Check for updates every hour
const PERIOD_MS = 60 * 60 * 1000

function registerPeriodicSync(swUrl: string, r: ServiceWorkerRegistration) {
  if (PERIOD_MS <= 0) return

  setInterval(async () => {
    if ('onLine' in navigator && !navigator.onLine) return

    const resp = await fetch(swUrl, {
      cache: 'no-store',
      headers: {
        'cache': 'no-store',
        'cache-control': 'no-cache',
      },
    })

    if (resp?.status === 200) await r.update()
  }, PERIOD_MS)
}

function createPwaStore(): PwaStore {
  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      if (PERIOD_MS <= 0) return
      if (!swUrl || !r) return

      if (r.active?.state === 'activated') {
        registerPeriodicSync(swUrl, r)
      } else if (r.installing) {
        r.installing.addEventListener('statechange', (e) => {
          const sw = e.target as ServiceWorker
          if (sw.state === 'activated') registerPeriodicSync(swUrl, r)
        })
      }
    },
  })

  if (import.meta.env.DEV) {
    watch(offlineReady, (value) => {
      if (value) console.info('[PWA] Application disponible hors ligne')
    })
    watch(needRefresh, (value) => {
      if (value) console.info('[PWA] Nouvelle version disponible (rechargement requis)')
    })
  }

  return { offlineReady, needRefresh, updateServiceWorker }
}

export function usePwa(): PwaStore {
  if (_instance) return _instance
  _instance = createPwaStore()
  return _instance
}
