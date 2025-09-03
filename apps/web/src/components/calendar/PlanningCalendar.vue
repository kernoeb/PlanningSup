<script lang="ts" setup>
import { ScheduleXCalendar } from '@schedule-x/vue'
import { DEFAULT_PLANNING_FULL_ID } from '@web/composables/useCurrentPlanning'
import { usePlanningCalendar } from '@web/composables/usePlanningCalendar'
import { useTimezone } from '@web/composables/useTimezone'
import { toRef } from 'vue'

const props = withDefaults(defineProps<{ fullId?: string }>(), {
  fullId: DEFAULT_PLANNING_FULL_ID,
})

const fullId = toRef(props, 'fullId')
const { timezone } = useTimezone()
const { calendarApp, reload } = usePlanningCalendar({ fullId, timezone })

defineExpose({ reload, fullId })
</script>

<template>
  <ScheduleXCalendar
    v-if="calendarApp"
    :calendar-app="calendarApp"
    style="height: calc(100vh - 82px);"
  />
</template>
