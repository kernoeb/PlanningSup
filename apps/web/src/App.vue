<script lang="ts" setup>
import PlanningCalendar from '@web/components/calendar/PlanningCalendar.vue'
import AppNavbar from '@web/components/layout/AppNavbar.vue'
import NetworkFailureToast from '@web/components/NetworkFailureToast.vue'
import PlanningSyncToast from '@web/components/PlanningSyncToast.vue'
import SharedPlanningToast from '@web/components/share/SharedPlanningToast.vue'

import { useSharedPlanningUrl } from '@web/composables/useSharedPlanningUrl'
import { useSharedTheme } from '@web/composables/useTheme'
import { defineAsyncComponent } from 'vue'

// Schedule X theme and app-specific overrides (timezone-select CSS intentionally omitted)
import '@schedule-x/theme-default/dist/index.css'
import './styles/schedule-x.css'

const LazyBouncing = defineAsyncComponent(() => import('@web/components/misc/Bouncing.vue'))

// Ensure global side-effects from theme management (html[data-theme], favicon sync, etc.) run early.
useSharedTheme()

// Initialize planning selection from URL query parameter if present
useSharedPlanningUrl()
</script>

<template>
  <div id="planningsup-app">
    <AppNavbar />
    <PlanningCalendar class="planning-calendar" />
    <PlanningSyncToast />
    <NetworkFailureToast />
    <SharedPlanningToast />
    <LazyBouncing />
  </div>
</template>

<style scoped>
.planning-calendar {
  height: calc(100dvh - 64px);
}
</style>
