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
import { useSettings } from './useSettings'

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

  const settings = useSettings()
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
            lightColors: { main: settings.colors.value.lecture, container: settings.colors.value.lecture, onContainer: '#000000' },
            darkColors: { main: settings.colors.value.lecture, container: settings.colors.value.lecture, onContainer: '#000000' },
          },
          'lab': {
            colorName: 'lab',
            lightColors: { main: settings.colors.value.lab, container: settings.colors.value.lab, onContainer: '#000000' },
            darkColors: { main: settings.colors.value.lab, container: settings.colors.value.lab, onContainer: '#000000' },
          },
          'tutorial': {
            colorName: 'tutorial',
            lightColors: { main: settings.colors.value.tutorial, container: settings.colors.value.tutorial, onContainer: '#000000' },
            darkColors: { main: settings.colors.value.tutorial, container: settings.colors.value.tutorial, onContainer: '#000000' },
          },
          'other': {
            colorName: 'other',
            lightColors: { main: settings.colors.value.other, container: settings.colors.value.other, onContainer: '#000000' },
            darkColors: { main: settings.colors.value.other, container: settings.colors.value.other, onContainer: '#000000' },
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
          // If supported by the calendar library, use event render hooks to add extra grayscale styling to 'no-teacher' events.
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

  // Reinitialize calendar when settings impacting palettes change
  function reinitCalendar() {
    // Drop the instance to rebuild with updated color config
    calendarApp.value = null
    void initOrUpdate()
  }

  // Recreate when color palette changes (deep watch)
  watch(() => settings.colors.value, () => {
    reinitCalendar()
  }, { deep: true })

  // Recreate when highlightTeacher toggles to update 'no-teacher' palette and mapping
  watch(settings.highlightTeacher, () => {
    reinitCalendar()
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
