<script lang="ts" setup>
import PlanningCalendar from '@web/components/calendar/PlanningCalendar.vue'
import AppNavbar from '@web/components/layout/AppNavbar.vue'
import PWABadge from '@web/components/PWABadge.vue'

// Schedule X theme and app-specific overrides (timezone-select CSS intentionally omitted)
import '@schedule-x/theme-default/dist/index.css'
import './styles/schedule-x.css'
</script>

<template>
  <div>
    <AppNavbar />
    <PlanningCalendar
      style="height: calc(100dvh - 64px);"
    />
    <PWABadge />
  </div>
</template>
