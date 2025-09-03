<script lang="ts" setup>
import PlanningCalendar from '@web/components/calendar/PlanningCalendar.vue'
import AppNavbar from '@web/components/layout/AppNavbar.vue'
import { useAuth } from '@web/composables/useAuth'
import { useCurrentPlanning } from '@web/composables/useCurrentPlanning'
import 'temporal-polyfill/global'

import '@schedule-x/theme-default/dist/index.css'
import './styles/schedule-x.css'
import '@schedule-x/timezone-select/index.css'

// Persist and expose current planning
const { fullId } = useCurrentPlanning()

// Ensure there's an authenticated session (anonymous if needed)
useAuth()
</script>

<template>
  <div>
    <AppNavbar />
    <PlanningCalendar :full-id="fullId" />
  </div>
</template>
