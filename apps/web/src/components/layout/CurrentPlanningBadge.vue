<script lang="ts" setup>
import { RefreshCw as IconRefresh, TriangleAlert as IconWarning, WifiOff as IconWifiOff } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  label: string
  tooltip?: string
  status: 'offline' | 'warning' | 'sync' | null
  statusTooltip?: string
}>()

const badgeEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const cleanupHandle = ref<ReturnType<typeof setTimeout> | null>(null)
const cleanupListener = ref<((event: TransitionEvent) => void) | null>(null)
const animationId = ref(0)

// We apply padding to the INNER content, not the outer badge,
// to ensure layout consistency during the masking animation.
const contentPaddingClass = computed(() => (props.status ? 'pr-7' : 'pr-3'))

const shouldShowTooltip = computed(() => !!props.tooltip && props.tooltip.trim().length > 0)

function formatPx(value: number) {
  return Number(value.toFixed(3))
}

function clearCleanup() {
  if (!cleanupHandle.value) return
  clearTimeout(cleanupHandle.value)
  cleanupHandle.value = null
}

function clearListener() {
  const el = badgeEl.value
  if (!el || !cleanupListener.value) return
  el.removeEventListener('transitionend', cleanupListener.value)
  cleanupListener.value = null
}

function applyStyles(width: number, contentMinWidth: number | null) {
  const el = badgeEl.value
  const content = contentEl.value
  if (!el || !content) return

  el.style.width = `${formatPx(width)}px`

  // By locking the inner content min-width to the larger size during animation,
  // we prevent text reflow/truncation jitter and keep the icon fixed in place relative to the text.
  if (contentMinWidth !== null) {
    content.style.minWidth = `${formatPx(contentMinWidth)}px`
  } else {
    content.style.minWidth = ''
  }
}

/**
 * Measures the width the component WANTS to be based on current props/content.
 */
function measureNaturalWidth() {
  const el = badgeEl.value
  const content = contentEl.value
  if (!el || !content) return null

  const prevWidth = el.style.width
  const prevMinWidth = content.style.minWidth

  // Unlock constraints to measure
  el.style.width = ''
  content.style.minWidth = ''

  const width = el.getBoundingClientRect().width

  // Restore constraints
  el.style.width = prevWidth
  content.style.minWidth = prevMinWidth

  return width
}

function onAnimationEnd(currentId: number, toWidth: number) {
  if (currentId !== animationId.value) return
  clearCleanup()
  clearListener()

  // Finalize state: set explicit width on badge, but remove min-width on content
  // so it remains responsive to window resizing.
  applyStyles(toWidth, null)
}

function animateWidth(fromWidth: number) {
  void nextTick(() => {
    const el = badgeEl.value
    if (!el || el.offsetParent === null) return

    const toWidth = measureNaturalWidth()
    if (toWidth === null) return

    if (Math.abs(toWidth - fromWidth) < 0.5) {
      applyStyles(toWidth, null)
      return
    }

    clearCleanup()
    clearListener()
    animationId.value += 1
    const currentId = animationId.value

    // 1. PREPARE: Lock Badge to OLD width, Lock Content to NEW (Target) width.
    // This effectively "masks" the new content. The icon is rendered but hidden
    // off the right side of the clipped badge.
    const contentTarget = Math.max(fromWidth, toWidth)
    applyStyles(fromWidth, contentTarget)

    // Force reflow
    void el.getBoundingClientRect()

    // 2. ANIMATE: Expand Badge to NEW width.
    // The mask opens up, revealing the stationary icon inside.
    requestAnimationFrame(() => {
      // We keep the inner content locked to the largest size involved in the transition
      // to ensure nothing moves around inside while the frame resizes.
      applyStyles(toWidth, contentTarget)
    })

    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName !== 'width') return
      onAnimationEnd(currentId, toWidth)
    }

    cleanupListener.value = onEnd
    el.addEventListener('transitionend', onEnd)

    cleanupHandle.value = setTimeout(() => {
      onAnimationEnd(currentId, toWidth)
    }, 300)
  })
}

watch(
  [() => props.label, () => props.status, () => props.tooltip],
  () => {
    const el = badgeEl.value
    if (!el || el.offsetParent === null) return
    const fromWidth = el.getBoundingClientRect().width
    animateWidth(fromWidth)
  },
  { flush: 'pre' },
)

onBeforeUnmount(() => {
  clearCleanup()
  clearListener()
})
</script>

<template>
  <div class="flex" :class="shouldShowTooltip ? 'tooltip tooltip-bottom relative before:z-50 after:z-50' : ''" :data-tip="shouldShowTooltip ? tooltip : undefined">
    <!--
      Outer Badge: Acts as the "Window" / Mask.
      - overflow-hidden: Essential for the masking effect.
      - p-0: We move padding to the inner element to ensure strict width control.
      - block: We use block/inline-block logic, flex is moved inside.
    -->
    <span
      id="current-planning-badge"
      ref="badgeEl"
      class="badge p-0 overflow-hidden truncate max-w-50 lg:max-w-88 h-6 block transition-[width] duration-200 will-change-[width] relative"
    >
      <!--
        Inner Content: Holds the Layout.
        - h-full: Fills the badge height.
        - pl-3: Left padding (standard DaisyUI badge padding).
        - contentPaddingClass: Dynamic right padding for the icon.
      -->
      <span
        ref="contentEl"
        class="flex items-center h-full pl-3 w-full"
        :class="contentPaddingClass"
      >
        <span class="truncate">
          {{ label }}
        </span>

        <Transition mode="out-in" name="fade">
          <span
            v-if="status"
            :key="status"
            class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
            :class="statusTooltip ? 'tooltip tooltip-bottom before:z-50 after:z-50' : ''"
            :data-tip="statusTooltip"
          >
            <IconWifiOff v-if="status === 'offline'" class="size-4 text-warning" />
            <IconWarning v-else-if="status === 'warning'" class="size-4 text-warning" />
            <IconRefresh v-else-if="status === 'sync'" class="size-3 animate-spin opacity-50" />
          </span>
        </Transition>
      </span>
    </span>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
