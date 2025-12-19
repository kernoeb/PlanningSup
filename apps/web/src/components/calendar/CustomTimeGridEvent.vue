<script lang="ts" setup>
import type { CalendarEvent } from '@schedule-x/calendar'
import { useSharedSettings } from '@web/composables/useSettings'
import { getSupportedTimezones, resolveTimezone } from '@web/composables/useTimezone'
import { Clock as IconClock, MapPin as IconMapPin } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  calendarEvent: CalendarEvent
}>()

const settings = useSharedSettings()
const allowedTimezones = getSupportedTimezones()
const timezone = computed(() => resolveTimezone(settings.targetTimezone.value, allowedTimezones))

const format = (time: Temporal.PlainTime) => time.toLocaleString([], { hour: '2-digit', minute: '2-digit' })

function toTime(t: Temporal.ZonedDateTime | Temporal.PlainDate): Temporal.PlainTime {
  if (t instanceof Temporal.ZonedDateTime) {
    // Convert to the user's configured timezone, then extract time
    return t.withTimeZone(timezone.value).toPlainTime()
  }
  // PlainDate has no time info
  return Temporal.PlainTime.from('00:00')
}

const eventTime = computed(() => {
  const { start, end } = props.calendarEvent
  return `${format(toTime(start))} – ${format(toTime(end))}`
})

const eventLocation = computed(() => props.calendarEvent.location)
const eventDescription = computed(() => props.calendarEvent.description)
</script>

<template>
  <div class="sx__time-grid-event-title">
    {{ calendarEvent.title }}
  </div>
  <div
    v-if="eventLocation || eventDescription"
    class="sx__time-grid-event-location text-gray-800"
  >
    <div v-if="eventLocation" class="flex items-center">
      <IconMapPin class="mr-1" :size="13" />{{ eventLocation }}
    </div>
    <div v-if="eventLocation && eventDescription" class="mx-1">
      ·
    </div>
    <div v-if="eventDescription">
      {{ eventDescription }}
    </div>
  </div>
  <div class="sx__time-grid-event-time text-gray-800">
    <div class="flex items-center">
      <IconClock class="mr-1" :size="13" />{{ eventTime }}
    </div>
  </div>
</template>
