<script lang="ts" setup>
import { usePlanningData } from '@web/composables/usePlanningData'
import { TriangleAlert as IconWarning, X as IconX } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const { networkFailures, planningFullIds } = usePlanningData()

const hasNetworkFailures = computed(() => networkFailures.value.length > 0)
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

// Show toast when network failures occur (but only if not dismissed)
watch(networkFailures, (failures) => {
  if (failures.length > 0 && !dismissed.value) {
    showToast.value = true
  } else if (failures.length === 0) {
    showToast.value = false
    dismissed.value = false
  }
})

// Reset dismissed state when planning selection changes
watch(planningFullIds, () => {
  dismissed.value = false
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="showToast && hasNetworkFailures"
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
            <IconWarning class="size-5" />
            <span class="font-semibold">Données hors ligne</span>
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
          <p class="mb-1">
            Les plannings suivants n'ont pas pu être mis à jour :
          </p>
          <ul class="list-disc list-inside space-y-0.5">
            <li v-for="failure in networkFailures" :key="failure.fullId" class="truncate">
              <span class="font-medium">{{ failure.title }}</span>
              <span class="opacity-70 text-xs ml-1">(dernière mise à jour : {{ formatBackupTime(failure.timestamp) }})</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Transition>
</template>
