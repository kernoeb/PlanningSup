<script lang="ts" setup>
import { useCurrentPlanning } from '@web/composables/useCurrentPlanning'
import { useSharedPlanningState } from '@web/composables/useSharedPlanningUrl'
import { Link as IconLink, Undo2 as IconUndo } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const { loadedFromUrlCount, previousPlannings, clearLoadedCount } = useSharedPlanningState()
const { setPlanningFullIds } = useCurrentPlanning()

const isVisible = ref(false)
const displayCount = ref(0)
const canUndo = ref(false)

const message = computed(() => {
  if (displayCount.value === 1) {
    return '1 planning chargé depuis le lien'
  }
  return `${displayCount.value} plannings chargés depuis le lien`
})

// Auto-hide after 6 seconds
let hideTimeout: ReturnType<typeof setTimeout> | null = null

function clearHideTimeout() {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
}

function hide() {
  clearHideTimeout()
  isVisible.value = false
  clearLoadedCount()
}

function undo() {
  clearHideTimeout()
  setPlanningFullIds(previousPlannings.value)
  isVisible.value = false
  clearLoadedCount()
}

watch(loadedFromUrlCount, (count) => {
  clearHideTimeout()

  if (count > 0) {
    displayCount.value = count
    canUndo.value = previousPlannings.value.length > 0
    isVisible.value = true

    hideTimeout = setTimeout(() => {
      hide()
    }, 6000)
  }
}, { immediate: true })
</script>

<template>
  <Transition name="share-toast">
    <div
      v-if="isVisible"
      class="toast toast-bottom z-50 w-full px-4 items-center pointer-events-none bottom-20 sm:bottom-4 md:px-8"
    >
      <div
        aria-atomic="true"
        aria-live="polite"
        class="alert share-toast-alert pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border shadow-lg text-primary-content w-full md:w-lg"
        role="status"
      >
        <div class="flex items-center gap-2">
          <IconLink aria-hidden="true" class="size-4" />
          <span class="text-sm font-medium">
            {{ message }}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            v-if="canUndo"
            class="btn btn-ghost btn-sm text-primary-content hover:bg-primary-content/20"
            type="button"
            @click="undo"
          >
            <IconUndo class="size-4" />
            Annuler
          </button>
          <button
            aria-label="Fermer"
            class="btn btn-ghost btn-sm text-primary-content hover:bg-primary-content/20"
            type="button"
            @click="hide"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.share-toast-enter-active,
.share-toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 220ms ease;
}

.share-toast-enter-from,
.share-toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .share-toast-enter-active,
  .share-toast-leave-active {
    transition: opacity 180ms ease;
  }

  .share-toast-enter-from,
  .share-toast-leave-to {
    transform: none;
    filter: none;
  }
}

.share-toast-alert {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}
</style>
