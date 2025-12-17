/// <reference types="vite/client" />

declare const __PWA_ENABLED__: boolean | undefined

declare module 'virtual:pwa-register/vue' {
  import type { Ref } from 'vue'

  export interface RegisterSWOptions {
    immediate?: boolean
    onRegisteredSW?: (swUrl: string, r?: ServiceWorkerRegistration) => void
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    offlineReady: Ref<boolean>
    needRefresh: Ref<boolean>
    updateServiceWorker: () => Promise<void> | void
  }
}
/// <reference types="vite-plugin-pwa/vue" />
/// <reference types="vite-plugin-pwa/client" />
