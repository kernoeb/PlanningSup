<script lang="ts" setup>
import type { CalendarConfig } from '@schedule-x/calendar'
import { authClient, client } from '@libs'
import {
  createCalendar,
  createViewDay,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
} from '@schedule-x/calendar'

import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls'
import { createCurrentTimePlugin } from '@schedule-x/current-time'
import { createEventModalPlugin } from '@schedule-x/event-modal'
import { createEventsServicePlugin } from '@schedule-x/events-service'
// import { createTimezoneSelectPlugin, translations as timezoneTranslations } from '@schedule-x/timezone-select'
import { mergeLocales, translations } from '@schedule-x/translations'
import { ScheduleXCalendar } from '@schedule-x/vue'

import { ref, shallowRef, watch } from 'vue'

import 'temporal-polyfill/global'

import '@schedule-x/theme-default/dist/index.css'
import './styles/schedule-x.css'
import '@schedule-x/timezone-select/index.css'

const session = authClient.useSession()
watch(() => session.value.isPending, (isPending) => {
  if (!isPending && !session.value.data) {
    authClient.signIn.anonymous().catch(console.error)
  }
}, { immediate: true })

const calendarApp = shallowRef<ReturnType<typeof createCalendar> | null>(null)
const eventsServicePlugin = createEventsServicePlugin()
const eventModal = createEventModalPlugin()
const calendarControls = createCalendarControlsPlugin()

type AllowedTimezones = CalendarConfig['timezone']
const fallback: AllowedTimezones = 'Europe/Paris'
const allowedTimezones = new Set(Intl.supportedValuesOf('timeZone'))

function isAllowedTimezone(tz: string): tz is NonNullable<AllowedTimezones> {
  return allowedTimezones.has(tz)
}

const timezone: NonNullable<AllowedTimezones> = (() => {
  const potential = Temporal.Now.timeZoneId() // string
  return (isAllowedTimezone(potential) ? potential : fallback) || fallback
})()

// Make the planning id reactive so you can change it and reload events
const fullId = ref('iut-de-vannes.butdutinfo.1ereannee.gr1a.gr1a1')

async function loadAndSetEvents() {
  const { data } = await client.api.plannings({ fullId: fullId.value }).get({
    query: { events: 'true' },
  })

  if (data && 'events' in data && data.events) {
    const mapped = data.events.map(event => ({
      ...event,
      id: `${fullId.value}_${event.uid}`.replace(/[^\w-]/g, '_'),
      title: event.summary,
      start: event.startDate.toTemporalInstant().toZonedDateTimeISO(timezone),
      end: event.endDate.toTemporalInstant().toZonedDateTimeISO(timezone),
      calendarId: event.categoryId,
    }))

    if (!calendarApp.value) {
      // First time: create the calendar with initial events
      calendarApp.value = createCalendar({
        views: [
          createViewDay(),
          createViewWeek(),
          createViewMonthGrid(),
          createViewMonthAgenda(),
        ],
        locale: 'fr-FR',
        isDark: true,
        timezone,
        showWeekNumbers: true,
        dayBoundaries: { start: '07:00', end: '20:00' },
        weekOptions: {
          nDays: 5,
          gridHeight: 800,
        },
        calendars: {
          'lecture': {
            colorName: 'lecture',
            lightColors: { main: '#efd6d8', container: '#efd6d8', onContainer: '#ffffff' },
            darkColors: { main: '#efd6d8', container: '#efd6d8', onContainer: '#000000' },
          },
          'lab': {
            colorName: 'lab',
            lightColors: { main: '#bbe0ff', container: '#bbe0ff', onContainer: '#ffffff' },
            darkColors: { main: '#bbe0ff', container: '#bbe0ff', onContainer: '#000000' },
          },
          'tutorial': {
            colorName: 'tutorial',
            lightColors: { main: '#d4fbcc', container: '#d4fbcc', onContainer: '#ffffff' },
            darkColors: { main: '#d4fbcc', container: '#d4fbcc', onContainer: '#000000' },
          },
          'other': {
            colorName: 'other',
            lightColors: { main: '#EDDD6E', container: '#EDDD6E', onContainer: '#ffffff' },
            darkColors: { main: '#EDDD6E', container: '#EDDD6E', onContainer: '#000000' },
          },
          'no-teacher': {
            colorName: 'no-teacher',
            lightColors: { main: '#676767', container: '#676767', onContainer: '#ffffff' },
            darkColors: { main: '#676767', container: '#676767', onContainer: '#000000' },
          },
        },
        events: mapped,
        plugins: [
          calendarControls,
          eventsServicePlugin,
          eventModal,
          // createTimezoneSelectPlugin(),
          createCurrentTimePlugin(),
        ],
        translations: mergeLocales(
          translations,
          // timezoneTranslations,
        ),
      })
    } else {
      // Calendar already exists: dynamically replace all events
      eventsServicePlugin.set(mapped)
    }
  }
}

// If you change fullId somewhere (e.g., UI or code), this reloads the events
watch(fullId, () => {
  if (calendarApp.value) loadAndSetEvents()
})

// Initial load
loadAndSetEvents()
</script>

<template>
  <div>
    <div class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <a class="btn btn-ghost text-xl">PlanningSup</a>
      </div>
      <div class="flex-none">
        <div class="dropdown dropdown-end">
          <div class="btn btn-ghost btn-circle" role="button" tabindex="0">
            <div class="indicator">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /> </svg>
              <span class="badge badge-sm indicator-item">8</span>
            </div>
          </div>
          <div
            class="card card-compact dropdown-content bg-base-100 z-1 mt-3 w-52 shadow"
            tabindex="0"
          >
            <div class="card-body">
              <span class="text-lg font-bold">8 Items</span>
              <span class="text-info">Subtotal: $999</span>
              <div class="card-actions">
                <button class="btn btn-primary btn-block">
                  View cart
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="dropdown dropdown-end">
          <div class="btn btn-ghost btn-circle avatar" role="button" tabindex="0">
            <div class="w-10 rounded-full">
              <img
                alt="Tailwind CSS Navbar component"
                src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
              >
            </div>
          </div>
          <ul
            class="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow"
            tabindex="0"
          >
            <li>
              <a class="justify-between">
                Profile
                <span class="badge">New</span>
              </a>
            </li>
            <li><a>Settings</a></li>
            <li><a>Logout</a></li>
          </ul>
        </div>
      </div>
    </div>
    <ScheduleXCalendar
      v-if="calendarApp"
      :calendar-app="calendarApp"
      style="height: calc(100vh - 4rem);"
    />
  </div>
</template>
