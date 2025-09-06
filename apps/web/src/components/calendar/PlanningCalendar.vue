<script lang="ts" setup>
import { ScheduleXCalendar } from '@schedule-x/vue'
import { usePlanningCalendar } from '@web/composables/usePlanningCalendar'
import { useTheme } from '@web/composables/useTheme'
import { useTimezone } from '@web/composables/useTimezone'

const { timezone } = useTimezone()
const { calendarApp, reload } = usePlanningCalendar({ timezone })
const { isDark: uiIsDark } = useTheme()

defineExpose({ reload })
</script>

<template>
  <ScheduleXCalendar
    v-if="calendarApp"
    :key="uiIsDark ? 'dark' : 'light'"
    :calendar-app="calendarApp"
  />
</template>
