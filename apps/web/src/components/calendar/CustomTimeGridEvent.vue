<script lang="ts" setup>
import type { CalendarEvent } from '@schedule-x/calendar'
import { Clock as IconClock, Info as IconInfo, MapPin as IconMapPin } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import { useSharedSettings } from '@web/composables/useSettings'
import { getSupportedTimezones, resolveTimezone } from '@web/composables/useTimezone'
import { useViewport } from '@web/composables/useViewport'
import { computed, inject, shallowRef } from 'vue'

const props = defineProps<{ calendarEvent: CalendarEvent }>()

const settings = useSharedSettings()
const { isSmallScreen, windowWidth } = useViewport()

const currentView = inject<string>('currentView')

const allowedTimezones = getSupportedTimezones()
const timezone = computed(() => resolveTimezone(settings.targetTimezone.value, allowedTimezones))

function format(t: Temporal.PlainTime) {
  return t.toLocaleString([], { hour: '2-digit', minute: '2-digit' })
}

function toTime(t: Temporal.ZonedDateTime | Temporal.PlainDate) {
  if (t instanceof Temporal.ZonedDateTime) return t.withTimeZone(timezone.value).toPlainTime()
  return Temporal.PlainTime.from('00:00')
}

const eventTime = computed(() => {
  const { start, end } = props.calendarEvent
  return `${format(toTime(start))} ‐ ${format(toTime(end))}`
})

const eventLocation = computed(() => props.calendarEvent.location)
const eventDescription = computed(() => props.calendarEvent.description)

// The card clips its overflow, so the tooltip lives in <body>, placed over the badge.
const timeTooltipRect = shallowRef<DOMRect | null>(null)
function showTimeTooltip(e: Event) {
  timeTooltipRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect()
}
function hideTimeTooltip() {
  timeTooltipRect.value = null
}
useEventListener('scroll', hideTimeTooltip, { capture: true, passive: true })
</script>

<template>
  <div
    class="sx__time-grid-event-title flex items-center justify-between"
    :class="{ 'sm:justify-normal': currentView === 'day' && !isSmallScreen }"
  >
    <div class="truncate">
      {{ calendarEvent.title }}
    </div>
    <template v-if="currentView === 'week' ? (windowWidth >= 1000) : true">
      <div
        class="event-time-badge ml-1 shrink-0 badge badge-xs bg-current/5 text-current/80 border-0"
        :class="{ 'ml-1': currentView === 'day' && !isSmallScreen }"
      >
        {{ eventTime }}
      </div>
      <div
        :aria-label="eventTime"
        class="event-time-icon ml-1 shrink-0 badge badge-xs bg-current/5 text-current/80 border-0 px-1"
        @mouseenter="showTimeTooltip"
        @mouseleave="hideTimeTooltip"
      >
        <IconClock aria-hidden="true" :size="10" />
      </div>
      <Teleport v-if="timeTooltipRect" to="body">
        <div
          class="tooltip tooltip-open tooltip-top pointer-events-none fixed z-50"
          :data-tip="eventTime"
          :style="{ left: `${timeTooltipRect.left}px`, top: `${timeTooltipRect.top}px`, width: `${timeTooltipRect.width}px`, height: `${timeTooltipRect.height}px` }"
        />
      </Teleport>
    </template>
  </div>

  <div
    v-if="eventLocation"
    class="flex items-center opacity-90 text-xs"
  >
    <IconMapPin class="mr-1 shrink-0" :size="11" />
    <span class="truncate">
      {{ eventLocation }}
    </span>
  </div>

  <div
    v-if="eventDescription"
    class="flex items-center opacity-90 text-xs"
  >
    <IconInfo class="mr-1 shrink-0" :size="11" />
    <span class="truncate">
      {{ eventDescription }}
    </span>
  </div>
</template>
