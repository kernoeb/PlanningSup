import { ref } from 'vue'

// Stub for non-PWA builds (Tauri app, browser extension).
export function useRegisterSW() {
  return {
    offlineReady: ref(false),
    needRefresh: ref(false),
    updateServiceWorker: () => {},
  }
}
