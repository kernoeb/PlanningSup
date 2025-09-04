<script lang="ts" setup>
import PlanningCalendar from '@web/components/calendar/PlanningCalendar.vue'
import AppNavbar from '@web/components/layout/AppNavbar.vue'
import PWABadge from '@web/components/PWABadge.vue'
import { useCurrentPlanning } from '@web/composables/useCurrentPlanning'

import '@schedule-x/theme-default/dist/index.css'
import './styles/schedule-x.css'
import '@schedule-x/timezone-select/index.css'

// Persist and expose current planning
const { fullId } = useCurrentPlanning()
</script>

<template>
  <div>
    <AppNavbar />
    <PlanningCalendar
      :full-id="fullId"
      style="height: calc(100vh - 64px);"
    />
    <PWABadge />
  </div>
</template>
