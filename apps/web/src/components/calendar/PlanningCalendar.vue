<script lang="ts" setup>
import { ScheduleXCalendar } from '@schedule-x/vue'
import { usePlanningCalendar } from '@web/composables/usePlanningCalendar'
import { useTimezone } from '@web/composables/useTimezone'

const { timezone } = useTimezone()
const { calendarApp, reload } = usePlanningCalendar({ timezone })

defineExpose({ reload })
</script>

<template>
  <ScheduleXCalendar
    v-if="calendarApp"
    :calendar-app="calendarApp"
  />
</template>
