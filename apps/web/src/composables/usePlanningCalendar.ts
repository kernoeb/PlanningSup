import type { ApiEvent } from './usePlanningData'

import type { AllowedTimezones } from './useTimezone'
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

import { onKeyStroke } from '@vueuse/core'
import buildCalendarsUtil from '@web/utils/calendars'
import { shallowRef, watch } from 'vue'
import { usePlanningData } from './usePlanningData'
import { useSettings } from './useSettings'

function mapApiEventToCalendarEvent(
  event: ApiEvent,
  timezone: NonNullable<AllowedTimezones>,
) {
  const start = event.startDate.toTemporalInstant().toZonedDateTimeISO(timezone)
  const end = event.endDate.toTemporalInstant().toZonedDateTimeISO(timezone)

  const srcId = event.sourceFullId ?? 'multi'
  return {
    ...event,
    id: `${srcId}_${event.uid}`.replace(/[^\w-]/g, '_'),
    title: event.summary,
    start,
    end,
    calendarId: event.categoryId,
  }
}

/**
 * usePlanningCalendar
 *
 * Initializes the ScheduleX calendar once and updates its events when the current
 * planning changes. Returns the calendar instance ref and useful plugins.
 *
 * Example:
 * const { calendarApp, reload } = usePlanningCalendar({ timezone })
 */
export function usePlanningCalendar(options: {
  timezone: NonNullable<AllowedTimezones>
}) {
  const { timezone } = options

  const calendarApp = shallowRef<ReturnType<typeof createCalendar> | null>(null)
  const eventsServicePlugin = createEventsServicePlugin()
  const eventModal = createEventModalPlugin()
  const calendarControls = createCalendarControlsPlugin()

  const settings = useSettings()
  const planning = usePlanningData()

  // Keyboard navigation: ArrowRight => next week, ArrowLeft => previous week
  const currentDate = shallowRef(Temporal.Now.zonedDateTimeISO(timezone).toPlainDate())

  onKeyStroke('ArrowRight', (e) => {
    e.preventDefault()
    const nbToAdd = (() => {
      const view = calendarControls.getView()
      if (view === 'month-grid' || view === 'month-agenda') return 30
      else if (view === 'week') return 7
      else return 1
    })()
    currentDate.value = currentDate.value.add({ days: nbToAdd })
    calendarControls.setDate(currentDate.value)
  })

  onKeyStroke('ArrowLeft', (e) => {
    e.preventDefault()
    const nbToSubtract = (() => {
      const view = calendarControls.getView()
      if (view === 'month-grid' || view === 'month-agenda') return 30
      else if (view === 'week') return 7
      else return 1
    })()
    currentDate.value = currentDate.value.subtract({ days: nbToSubtract })
    calendarControls.setDate(currentDate.value)
  })

  function getMappedEvents() {
    return planning.events.value.map(e => mapApiEventToCalendarEvent(e, timezone))
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
        calendars: buildCalendarsUtil(settings.colors.value),
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
  watch(planning.planningFullIds, () => {
    void initOrUpdate()
  })
  watch(planning.events, () => {
    if (calendarApp.value) {
      eventsServicePlugin.set(getMappedEvents())
    }
  })

  // Update calendars palette in place when colors change (no reinit, no flicker)
  watch(
    () => settings.colors.value,
    () => {
      if (!calendarApp.value) return
      calendarControls.setCalendars(buildCalendarsUtil(settings.colors.value))
    },
    { deep: true },
  )

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
