<script lang="ts" setup>
import { useOnline } from '@vueuse/core'
import { usePlanningData } from '@web/composables/usePlanningData'
import { TriangleAlert as IconWarning, WifiOff as IconWifiOff, X as IconX } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const { networkFailures, planningFullIds } = usePlanningData()
const isOnline = useOnline()

const hasNetworkFailures = computed(() => networkFailures.value.length > 0)
const shouldShowToast = computed(() => !isOnline.value || hasNetworkFailures.value)
const showToast = ref(false)
const dismissed = ref(false)

function formatBackupTime(timestamp: number | null): string {
  if (!timestamp) return 'inconnu'
  const date = new Date(timestamp)
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dismiss() {
  showToast.value = false
  dismissed.value = true
}

// Show toast when offline or network failures occur (but only if not dismissed)
watch(shouldShowToast, (should) => {
  if (should && !dismissed.value) {
    showToast.value = true
  } else if (!should) {
    showToast.value = false
    dismissed.value = false
  }
}, { immediate: true })

// Reset dismissed state when planning selection changes
watch(planningFullIds, () => {
  dismissed.value = false
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="showToast && shouldShowToast"
      class="toast toast-bottom toast-center z-50"
      style="max-width: calc(100dvw - 32px);"
    >
      <div
        aria-atomic="true"
        aria-live="polite"
        class="alert alert-warning flex flex-col items-start gap-2 shadow-lg"
        role="alert"
      >
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <IconWifiOff v-if="!isOnline" class="size-5" />
            <IconWarning v-else class="size-5" />
            <span class="font-semibold">{{ !isOnline ? 'Vous êtes hors ligne' : 'Données hors ligne' }}</span>
          </div>
          <button
            aria-label="Fermer"
            class="btn btn-ghost btn-xs btn-circle"
            type="button"
            @click="dismiss"
          >
            <IconX class="size-4" />
          </button>
        </div>
        <div class="text-sm">
          <template v-if="!isOnline">
            <p>
              Votre appareil n'est pas connecté à internet. Les données affichées peuvent ne pas être à jour.
            </p>
          </template>
          <template v-else-if="hasNetworkFailures">
            <p class="mb-1">
              Les plannings suivants n'ont pas pu être mis à jour :
            </p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="failure in networkFailures" :key="failure.fullId" class="truncate">
                <span class="font-medium">{{ failure.title }}</span>
                <span class="opacity-70 text-xs ml-1">(dernière mise à jour : {{ formatBackupTime(failure.timestamp) }})</span>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>
