<script setup lang="ts">
import type { CalendarEvent } from '@schedule-x/calendar'
import { onKeyStroke, useSwipe } from '@vueuse/core'
import { useSharedSettings } from '@web/composables/useSettings'
import { getContrastTextColor } from '@web/utils/calendars'
import {
  Calendar as IconCalendar,
  Clock as IconClock,
  EyeOff as IconEyeOff,
  FileText as IconFileText,
  MapPin as IconMapPin,
  Monitor as IconMonitor,
  X as IconX,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  event: CalendarEvent | null
  planningTitle?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const drawerRef = ref<HTMLDivElement | null>(null)
const confirmModalRef = ref<HTMLDialogElement | null>(null)
const settings = useSharedSettings()

// Type guard for ZonedDateTime
function isZonedDateTime(dt: Temporal.ZonedDateTime | Temporal.PlainDate): dt is Temporal.ZonedDateTime {
  return 'hour' in dt
}

// Format time range (start - end)
const timeRange = computed(() => {
  if (!props.event) return ''
  const { start, end } = props.event
  if (!isZonedDateTime(start) || !isZonedDateTime(end)) return ''
  const formatTime = (dt: Temporal.ZonedDateTime) =>
    `${String(dt.hour).padStart(2, '0')}:${String(dt.minute).padStart(2, '0')}`
  return `${formatTime(start)} - ${formatTime(end)}`
})

// Format date
const formattedDate = computed(() => {
  if (!props.event) return ''
  const { start } = props.event
  const date = isZonedDateTime(start) ? start.toPlainDate() : start
  return date.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
})

// Duration in a readable format
const duration = computed(() => {
  if (!props.event) return ''
  const { start, end } = props.event
  if (!isZonedDateTime(start) || !isZonedDateTime(end)) return ''
  const diffMs = end.epochMilliseconds - start.epochMilliseconds
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0 && minutes > 0) return `${hours}h${minutes}min`
  if (hours > 0) return `${hours}h`
  return `${minutes}min`
})

// Is the event at a remote location?
const isRemote = computed(() => {
  if (!props.event) return false
  return (props.event as any).remoteLocation === true
})

// Event location
const location = computed(() => {
  if (!props.event) return ''
  return (props.event as any).location ?? ''
})

// Event description
const description = computed(() => {
  if (!props.event) return ''
  return (props.event as any).description ?? ''
})

// Category info (from calendar)
const categoryId = computed(() => {
  if (!props.event) return null
  return (props.event as any).calendarId ?? null
})

// Category label
const categoryLabel = computed(() => {
  switch (categoryId.value) {
    case 'lecture': return 'Amphi'
    case 'lab': return 'TP'
    case 'tutorial': return 'TD'
    case 'no-teacher': return 'Sans enseignant'
    default: return 'Autre'
  }
})

// Category background color from settings
const categoryBgColor = computed(() => {
  const id = categoryId.value
  if (!id) return null
  if (id === 'no-teacher') return '#676767'
  if (id === 'lecture') return settings.colors.value.lecture
  if (id === 'lab') return settings.colors.value.lab
  if (id === 'tutorial') return settings.colors.value.tutorial
  return settings.colors.value.other
})

// Category text color (contrast-aware)
const categoryTextColor = computed(() => {
  const bg = categoryBgColor.value
  if (!bg) return '#000000'
  return getContrastTextColor(bg)
})

// Hide event by adding its title to the blocklist
function hideEvent() {
  if (!props.event) return
  const title = props.event.title
  if (title && !settings.blocklist.value.includes(title)) {
    settings.blocklist.value.push(title)
  }
  confirmModalRef.value?.close()
  emit('close')
}

// Show confirmation modal before hiding
function showHideConfirmation() {
  confirmModalRef.value?.showModal()
}

// Close on Escape key
onKeyStroke('Escape', () => {
  if (props.event) emit('close')
})

// Swipe down to close
useSwipe(drawerRef, {
  onSwipeEnd(_, direction) {
    if (direction === 'down') emit('close')
  },
})

// Focus trap and body scroll lock when open
watch(() => props.event, (event) => {
  if (event) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div
        v-if="event"
        class="fixed inset-0 bg-black/50 z-40"
        @click="emit('close')"
      />
    </Transition>

    <Transition name="drawer">
      <div
        v-if="event"
        ref="drawerRef"
        :aria-labelledby="event ? 'event-modal-title' : undefined"
        aria-modal="true"
        class="fixed bottom-0 left-0 right-0 z-1000 bg-base-100 rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
        role="dialog"
      >
        <!-- Drag handle -->
        <div class="sticky top-0 bg-base-100 pt-3 pb-2 rounded-t-3xl">
          <div class="w-12 h-1.5 bg-base-300 rounded-full mx-auto" />
        </div>

        <!-- Header with close button -->
        <div class="px-5 pb-3 flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <!-- Planning source (important context) -->
            <p v-if="planningTitle" class="text-sm text-base-content/60 mb-1">
              {{ planningTitle }}
            </p>

            <!-- Title with category badge -->
            <div class="flex items-center gap-2 flex-wrap">
              <h2 id="event-modal-title" class="text-xl font-bold leading-tight">
                {{ event.title }}
              </h2>
              <span
                v-if="categoryBgColor"
                class="badge badge-soft"
                :style="{ backgroundColor: categoryBgColor, color: categoryTextColor }"
              >
                {{ categoryLabel }}
              </span>
            </div>
          </div>

          <button
            aria-label="Fermer"
            class="btn btn-ghost btn-sm btn-circle flex-shrink-0"
            @click="emit('close')"
          >
            <IconX :size="20" />
          </button>
        </div>

        <!-- Content -->
        <div class="px-5 pb-6 space-y-4">
          <!-- Date and time -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center flex-shrink-0">
              <IconCalendar class="text-base-content/70" :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium capitalize leading-tight">
                {{ formattedDate }}
              </p>
              <div class="flex items-center gap-1.5 text-sm text-base-content/60 mt-0.5">
                <IconClock class="flex-shrink-0" :size="14" />
                <span>{{ timeRange }}</span>
                <span class="text-base-content/40">·</span>
                <span>{{ duration }}</span>
              </div>
            </div>
          </div>

          <!-- Location -->
          <div v-if="location" class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center flex-shrink-0">
              <IconMonitor v-if="isRemote" class="text-info" :size="20" />
              <IconMapPin v-else class="text-base-content/70" :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium leading-tight">
                {{ location }}
              </p>
              <p v-if="isRemote" class="text-sm text-info mt-0.5">
                Cours à distance
              </p>
            </div>
          </div>

          <!-- Description -->
          <div v-if="description" class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center flex-shrink-0">
              <IconFileText class="text-base-content/70" :size="20" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-base-content/70 whitespace-pre-wrap break-words leading-relaxed">
                {{ description }}
              </p>
            </div>
          </div>

          <!-- Hide event action -->
          <div class="pt-2 border-t border-base-200">
            <button
              class="btn btn-ghost btn-sm text-base-content/60 gap-2"
              @click="showHideConfirmation"
            >
              <IconEyeOff :size="16" />
              Cacher ce type de cours
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Hide confirmation modal -->
    <dialog ref="confirmModalRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">
          Cacher ce type de cours ?
        </h3>
        <p class="py-4">
          Tous les cours nommés <strong>{{ event?.title }}</strong> seront cachés de votre calendrier.
        </p>
        <p class="text-sm text-base-content/60">
          Vous pourrez les réafficher depuis les paramètres, dans la section "Liste de blocage".
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost">
              Annuler
            </button>
          </form>
          <button class="btn btn-primary" @click="hideEvent">
            Cacher
          </button>
        </div>
      </div>
      <form class="modal-backdrop" method="dialog">
        <button>close</button>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
/* Backdrop transition */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* Drawer slide-up transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
}
</style>
