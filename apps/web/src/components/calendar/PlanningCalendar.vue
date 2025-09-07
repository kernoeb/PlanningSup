<script lang="ts" setup>
import { ScheduleXCalendar } from '@schedule-x/vue'
import { useSwipe } from '@vueuse/core'
import { usePlanningCalendar } from '@web/composables/usePlanningCalendar'
import { useSharedTheme } from '@web/composables/useTheme'
import { useTimezone } from '@web/composables/useTimezone'
import { useTemplateRef } from 'vue'

const { timezone } = useTimezone()
const { calendarApp, reload, nextPeriod, prevPeriod, nbHours, loading } = usePlanningCalendar({ timezone })
const { isDark: uiIsDark } = useSharedTheme()

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
      class="h-full"
    >
      <template #headerContentLeftAppend>
        <span v-if="loading" class="loading loading-spinner loading-sm" />
        <div v-else-if="nbHours != null" class="text-xs text-gray-500 block h-full">
          {{ nbHours }}
        </div>
      </template>
    </ScheduleXCalendar>
  </div>
</template>
