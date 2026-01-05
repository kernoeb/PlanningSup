<script lang="ts" setup>
import { useSharedPlanningState } from '@web/composables/useSharedPlanningUrl'
import { Link as IconLink } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const { loadedFromUrlCount, clearLoadedCount } = useSharedPlanningState()

const isVisible = ref(false)
const displayCount = ref(0)

const message = computed(() => {
  if (displayCount.value === 1) {
    return '1 planning chargé depuis le lien'
  }
  return `${displayCount.value} plannings chargés depuis le lien`
})

// Auto-hide after 10 seconds
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

watch(loadedFromUrlCount, (count) => {
  clearHideTimeout()

  if (count > 0) {
    displayCount.value = count
    isVisible.value = true

    hideTimeout = setTimeout(() => {
      hide()
    }, 10_000)
  }
}, { immediate: true })
</script>

<template>
  <Transition name="share-toast">
    <div
      v-if="isVisible"
      class="toast toast-bottom z-50 w-full px-8 items-center pointer-events-none md:bottom-4"
    >
      <div
        aria-atomic="true"
        aria-live="polite"
        class="alert alert-soft share-toast-alert pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border shadow-lg ring-1 ring-base-content/10 text-base-content w-full md:w-lg"
        role="status"
        style="--alert-color: var(--color-primary);"
      >
        <div class="flex items-center gap-2">
          <IconLink aria-hidden="true" class="size-4 opacity-70" />
          <span class="text-sm font-medium">
            {{ message }}
          </span>
        </div>
        <button
          aria-label="Fermer"
          class="btn btn-ghost btn-xs"
          type="button"
          @click="hide"
        >
          OK
        </button>
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
  border-color: color-mix(in oklab, var(--alert-color) 20%, #0000);
  background-color: color-mix(in oklab, var(--color-base-100) 80%, #0000);
  backdrop-filter: blur(12px);
}

@supports not (backdrop-filter: blur(1px)) {
  .share-toast-alert {
    background-color: color-mix(in oklab, var(--color-base-100) 95%, #0000);
  }
}
</style>
