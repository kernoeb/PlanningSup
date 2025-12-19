import { usePwa } from '@web/composables/usePwa'

export type PwaStore = import('@web/composables/usePwa').PwaStore

interface PwaGlobal {
  __PWA__?: PwaStore
}

export function getPwa() {
  return (globalThis as PwaGlobal).__PWA__
}

export function setPwa(pwa: PwaStore) {
  (globalThis as PwaGlobal).__PWA__ = pwa
}

export function initPwa() {
  const pwa = usePwa()
  setPwa(pwa)

  if (import.meta.env.DEV) {
    // @ts-expect-error - for debugging purposes
    globalThis.__pwa = {
      reload: () => pwa.updateServiceWorker(),
      offlineReady: (value?: boolean) => {
        if (typeof value === 'boolean') pwa.offlineReady.value = value
        return pwa.offlineReady.value
      },
      needRefresh: (value?: boolean) => {
        if (typeof value === 'boolean') pwa.needRefresh.value = value
        return pwa.needRefresh.value
      },
    }
  }
}
