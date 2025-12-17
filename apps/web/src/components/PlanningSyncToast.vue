<script lang="ts" setup>
import { usePlanningData } from '@web/composables/usePlanningData'
import { RefreshCw as IconRefresh } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const { syncing, hasEvents, planningFullIds } = usePlanningData()

const shouldBeVisible = computed(() =>
  planningFullIds.value.length > 0
  && syncing.value
  && !hasEvents.value,
)

const isVisible = ref(false)
const showHandle = ref<ReturnType<typeof setTimeout> | null>(null)
const DEBOUNCE_MS = 120

function clearShowHandle() {
  if (!showHandle.value) return
  clearTimeout(showHandle.value)
  showHandle.value = null
}

watch(shouldBeVisible, (visible) => {
  clearShowHandle()

  if (!visible) {
    isVisible.value = false
    return
  }

  showHandle.value = setTimeout(() => {
    showHandle.value = null
    if (shouldBeVisible.value) isVisible.value = true
  }, DEBOUNCE_MS)
}, { immediate: true })

onBeforeUnmount(() => {
  clearShowHandle()
})
</script>

<template>
  <Transition name="sync-toast">
    <div
      v-if="isVisible"
      class="toast toast-bottom z-50 w-full px-20 items-center pointer-events-none md:bottom-4"
    >
      <div
        aria-atomic="true"
        aria-live="polite"
        class="alert alert-soft sync-toast-alert pointer-events-auto flex items-center justify-center gap-2 rounded-2xl border shadow-lg ring-1 ring-base-content/10 text-base-content w-full md:w-lg"
        role="status"
        style="--alert-color: var(--color-base-content);"
      >
        <IconRefresh aria-hidden="true" class="size-4 animate-spin opacity-60" />
        <span class="skeleton skeleton-text text-sm font-medium opacity-70">
          Chargement du planning…
        </span>
      </div>
    </div>
  </Transition>
</template>

<style>
.sync-toast-enter-active,
.sync-toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 220ms ease;
}

.sync-toast-enter-from,
.sync-toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .sync-toast-enter-active,
  .sync-toast-leave-active {
    transition: opacity 180ms ease;
  }

  .sync-toast-enter-from,
  .sync-toast-leave-to {
    transform: none;
    filter: none;
  }
}

.sync-toast-alert {
  border-color: color-mix(in oklab, var(--alert-color) 12%, #0000);
  background-color: color-mix(in oklab, var(--color-base-100) 80%, #0000);
  backdrop-filter: blur(12px);
}

@supports not (backdrop-filter: blur(1px)) {
  .sync-toast-alert {
    background-color: color-mix(in oklab, var(--color-base-100) 95%, #0000);
  }
}
</style>
