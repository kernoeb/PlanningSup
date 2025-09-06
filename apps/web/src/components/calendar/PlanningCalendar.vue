<script lang="ts" setup>
import { ScheduleXCalendar } from '@schedule-x/vue'
import { useSwipe } from '@vueuse/core'
import { usePlanningCalendar } from '@web/composables/usePlanningCalendar'
import { useTheme } from '@web/composables/useTheme'
import { useTimezone } from '@web/composables/useTimezone'
import { useTemplateRef } from 'vue'

const { timezone } = useTimezone()
const { calendarApp, reload, nextPeriod, prevPeriod } = usePlanningCalendar({ timezone })
const { isDark: uiIsDark } = useTheme()

const el = useTemplateRef('calendarSwipeEl')
useSwipe(el, {
  onSwipeEnd(_, direction) {
    if (direction === 'left') nextPeriod()
    else if (direction === 'right') prevPeriod()
  },
})
defineExpose({ reload })
</script>

<template>
  <div ref="calendarSwipeEl">
    <ScheduleXCalendar
      v-if="calendarApp"
      :key="uiIsDark ? 'dark' : 'light'"
      :calendar-app="calendarApp"
    />
  </div>
</template>
