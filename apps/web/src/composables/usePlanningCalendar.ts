import type { CalendarConfig } from '@schedule-x/calendar'
import type { Ref } from 'vue'
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
import { mergeLocales, translations } from '@schedule-x/translations'
import { shallowRef, watch } from 'vue'
import { useCurrentPlanning } from './useCurrentPlanning'
import { usePlanningData } from './usePlanningData'

type AllowedTimezones = CalendarConfig['timezone']

interface ApiEvent {
  uid: string
  summary: string
  startDate: unknown
  endDate: unknown
  categoryId: string
}

function mapApiEventToCalendarEvent(
  event: ApiEvent,
  fullId: string,
  timezone: NonNullable<AllowedTimezones>,
) {
  const start = (event.startDate as any).toTemporalInstant().toZonedDateTimeISO(timezone)
  const end = (event.endDate as any).toTemporalInstant().toZonedDateTimeISO(timezone)

  return {
    ...event,
    id: `${fullId}_${event.uid}`.replace(/[^\w-]/g, '_'),
    title: event.summary,
    start,
    end,
    calendarId: event.categoryId,
  }
}

/**
 * usePlanningCalendar
 *
 * Initializes the ScheduleX calendar once and updates its events whenever the provided
 * planning `fullId` changes. Returns the calendar instance ref and useful plugins.
 *
 * Example:
 * const fullId = ref('some-planning-id')
 * const { calendarApp, reload } = usePlanningCalendar({ fullId, timezone })
 */
export function usePlanningCalendar(options: {
  fullId: Ref<string>
  timezone: NonNullable<AllowedTimezones>
}) {
  const { fullId: propFullId, timezone } = options

  const calendarApp = shallowRef<ReturnType<typeof createCalendar> | null>(null)
  const eventsServicePlugin = createEventsServicePlugin()
  const eventModal = createEventModalPlugin()
  const calendarControls = createCalendarControlsPlugin()

  const planning = usePlanningData()
  const { setCurrentPlanning } = useCurrentPlanning()
  watch(propFullId, id => setCurrentPlanning(id), { immediate: true })

  function getMappedEvents() {
    return planning.events.value.map(e => mapApiEventToCalendarEvent(e, planning.fullId.value, timezone))
  }

  function initOrUpdate() {
    const mapped = getMappedEvents()
    if (!calendarApp.value) {
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
        weekOptions: { nDays: 5, gridHeight: 800 },
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
          createCurrentTimePlugin(),
        ],
        translations: mergeLocales(translations),
      })
    } else {
      eventsServicePlugin.set(mapped)
    }
  }

  // Sync on planning change and when new events arrive
  watch(planning.fullId, () => {
    void initOrUpdate()
  })
  watch(planning.events, () => {
    if (calendarApp.value) {
      eventsServicePlugin.set(getMappedEvents())
    }
  })

  // Manual reload if needed by UI
  function reload() {
    void planning.refresh()
  }

  // Initial load
  void initOrUpdate()

  return {
    calendarApp,
    calendarControls,
    eventsServicePlugin,
    eventModal,
    reload,
  }
}
