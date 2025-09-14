<script lang="ts" setup>
import { ScheduleXCalendar } from '@schedule-x/vue'
import { refDebounced, useSwipe } from '@vueuse/core'
import { usePlanningCalendar } from '@web/composables/usePlanningCalendar'
import { useSharedTheme } from '@web/composables/useTheme'
import { useTimezone } from '@web/composables/useTimezone'
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
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

// To avoid first animation
const loadingDebounced = refDebounced(loading, 200)

defineExpose({ reload })
</script>

<template>
  <div id="planning-calendar-container" ref="calendarSwipeEl" :class="{ 'is-dark': uiIsDark, 'sx-animations-enabled': !loadingDebounced }">
    <ScheduleXCalendar
      v-if="calendarApp"
      :calendar-app="calendarApp"
      class="h-full"
      data-calendar-id="schedule-x-calendar"
    >
      <template #headerContentLeftAppend>
        <span v-if="loading" id="calendar-loading-spinner" class="loading loading-spinner loading-sm" />
        <div v-else-if="nbHours != null" id="calendar-hours-display" class="text-xs text-gray-500 block h-full">
          {{ nbHours }}
        </div>
      </template>
    </ScheduleXCalendar>

    <div id="mobile-calendar-navigation" class="fixed bottom-4 left-1/2 transform -translate-x-1/2 join z-50 md:hidden">
      <button id="calendar-prev-period" class="btn join-item" @click="prevPeriod">
        <ArrowLeft :size="20" />
      </button>
      <button id="calendar-next-period" class="btn join-item" @click="nextPeriod">
        <ArrowRight :size="20" />
      </button>
    </div>
  </div>
</template>
