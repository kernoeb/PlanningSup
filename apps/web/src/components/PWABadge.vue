<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { computed, ref } from 'vue'

// check for updates every hour
const period = 60 * 60 * 1000

const swActivated = ref(false)

/**
 * This function will register a periodic sync check every hour, you can modify the interval as needed.
 */
function registerPeriodicSync(swUrl: string, r: ServiceWorkerRegistration) {
  if (period <= 0) return

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
  }, period)
}

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    if (period <= 0) return
    if (r?.active?.state === 'activated') {
      swActivated.value = true
      registerPeriodicSync(swUrl, r)
    } else if (r?.installing) {
      r.installing.addEventListener('statechange', (e) => {
        const sw = e.target as ServiceWorker
        swActivated.value = sw.state === 'activated'
        if (swActivated.value) registerPeriodicSync(swUrl, r)
      })
    }
  },
})

const title = computed(() => {
  if (offlineReady.value) return 'Application prête pour le mode hors ligne'
  if (needRefresh.value) return 'Nouveau contenu disponible. Cliquez sur "Recharger" pour mettre à jour.'
  return ''
})

const alertClass = computed(() => needRefresh.value ? 'alert-warning' : 'alert-neutral')

function close() {
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <div v-if="offlineReady || needRefresh" class="toast toast-end toast-bottom">
    <div aria-atomic="true" aria-live="polite" class="alert" :class="alertClass" role="alert">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        <span id="toast-message" class="flex-1">
          {{ title }}
        </span>
        <div class="flex gap-2">
          <button
            v-if="needRefresh"
            class="btn btn-neutral btn-sm"
            type="button"
            @click="updateServiceWorker()"
          >
            Recharger
          </button>
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            @click="close"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
