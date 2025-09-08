<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { computed, ref, watch } from 'vue'

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
  if (offlineReady.value) return 'Application disponible hors ligne'
  if (needRefresh.value) return 'Nouvelle version disponible !'
  return ''
})

const alertClass = computed(() => needRefresh.value ? 'alert-warning' : 'alert-neutral')

function close() {
  offlineReady.value = false
  needRefresh.value = false
}

watch([offlineReady], (offlineReady) => {
  if (offlineReady) {
    setTimeout(() => {
      close()
    }, 2500) // auto close after 2.5 seconds
  }
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="offlineReady || needRefresh"
      class="toast toast-bottom toast-center z-50"
      style="max-width: calc(100dvw - 100px);"
    >
      <div
        aria-atomic="true"
        aria-live="polite"
        class="alert flex flex-col"
        :class="alertClass"
        role="alert"
      >
        <span id="toast-message" class="flex-1">
          {{ title }}
        </span>
        <div v-if="needRefresh" class="flex gap-2 w-full">
          <button
            class="btn btn-neutral btn-sm flex-1"
            type="button"
            @click="updateServiceWorker()"
          >
            Recharger
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
