<script lang="ts" setup>
import type { CalendarEvent } from '@schedule-x/calendar'
import { useSharedSettings } from '@web/composables/useSettings'
import { getSupportedTimezones, resolveTimezone } from '@web/composables/useTimezone'
import { useViewport } from '@web/composables/useViewport'
import { Info as IconInfo, MapPin as IconMapPin } from 'lucide-vue-next'
import { computed, inject } from 'vue'

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
</script>

<template>
  <div
    class="sx__time-grid-event-title flex items-center justify-between"
    :class="{ 'sm:justify-normal': currentView === 'day' && !isSmallScreen }"
  >
    <div class="truncate">
      {{ calendarEvent.title }}
    </div>
    <div
      v-if="currentView === 'week' ? (windowWidth >= 1000) : true"
      class="ml-1 shrink-0 badge badge-xs bg-current/5 text-current/80 border-0"
      :class="{ 'ml-1': currentView === 'day' && !isSmallScreen }"
    >
      {{ eventTime }}
    </div>
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
