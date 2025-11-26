import type { CalendarEvent } from '@schedule-x/calendar'
import type { Ref } from 'vue'
import type { EventWithFullId } from './usePlanningData'
import type { AllowedTimezones } from './useTimezone'

import { createCalendar, createViewDay, createViewMonthAgenda, createViewMonthGrid, createViewWeek } from '@schedule-x/calendar'
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls'
import { createCurrentTimePlugin } from '@schedule-x/current-time'
import { createEventModalPlugin } from '@schedule-x/event-modal'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import { mergeLocales, translations } from '@schedule-x/translations'

import { onKeyStroke } from '@vueuse/core'

import buildCalendarsUtil from '@web/utils/calendars'
import { computed, ref, shallowRef, unref, watch } from 'vue'
import { usePlanningData } from './usePlanningData'
import { useSharedSettings } from './useSettings'
import { useSharedTheme } from './useTheme'

function mapApiEventToCalendarEvent(
  event: EventWithFullId,
  timezone: NonNullable<AllowedTimezones>,
) {
  const start = event.startDate.toTemporalInstant().toZonedDateTimeISO(timezone)
  const end = event.endDate.toTemporalInstant().toZonedDateTimeISO(timezone)

  const id = `${event.fullId}_${event.uid}`.replace(/[^\w-]/g, '_') // valid HTML id (querySelector)
  return {
    ...event,
    id,
    title: event.summary,
    start,
    end,
    calendarId: event.categoryId,
  } satisfies CalendarEvent
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
  timezone: Ref<NonNullable<AllowedTimezones>>
}) {
  const timezoneRef = options.timezone
  const timezoneValue = computed(() => unref(timezoneRef))

  const calendarApp = shallowRef<ReturnType<typeof createCalendar> | null>(null)
  const eventsServicePlugin = createEventsServicePlugin()
  const eventModal = createEventModalPlugin()
  const calendarControls = createCalendarControlsPlugin()

  const settings = useSharedSettings()
  const planning = usePlanningData()
  const { isDark: uiIsDark } = useSharedTheme()

  // On view change, update our ref
  const currentView = ref<ReturnType<typeof calendarControls.getView> | null>(null)

  // Keyboard navigation: ArrowRight => next week, ArrowLeft => previous week
  const currentDate = shallowRef(Temporal.Now.zonedDateTimeISO(timezoneValue.value).toPlainDate())

  const loading = computed(() => planning.loading.value)

  function nextPeriod() {
    if (!calendarApp.value) return
    const view = currentView.value
    if (!view) return null
    const days
      = view === 'month-grid' || view === 'month-agenda'
        ? 30
        : view === 'week'
          ? 7
          : 1
    currentDate.value = currentDate.value.add({ days })
    calendarControls.setDate(currentDate.value)
  }

  function prevPeriod() {
    if (!calendarApp.value) return
    const view = currentView.value
    if (!view) return null
    const days
      = view === 'month-grid' || view === 'month-agenda'
        ? 30
        : view === 'week'
          ? 7
          : 1
    currentDate.value = currentDate.value.subtract({ days })
    calendarControls.setDate(currentDate.value)
  }

  onKeyStroke('ArrowRight', (e) => {
    e.preventDefault()
    nextPeriod()
  }, { dedupe: true })

  onKeyStroke('ArrowLeft', (e) => {
    e.preventDefault()
    prevPeriod()
  }, { dedupe: true })

  function getMappedEvents(tz: NonNullable<AllowedTimezones>) {
    return planning.events.value.map(e => mapApiEventToCalendarEvent(e, tz))
  }

  function getWeekOptions() {
    return {
      nDays: settings.weekNDays.value,
      gridHeight: 800,
      eventWidth: 98,
    }
  }

  function initOrUpdate(forceRecreate = false) {
    const timezone = timezoneValue.value
    const mappedEvents = getMappedEvents(timezone)

    // Only initialize calendar if we have planning data or are forcing recreation
    const hasData = planning.planningFullIds.value?.length > 0
    if ((!calendarApp.value && hasData) || forceRecreate) {
      // Preserve current state (view and date) when recreating
      const isRecreate = !!calendarApp.value
      const prevView = isRecreate ? calendarControls.getView() : undefined
      const prevDate = isRecreate ? currentDate.value : undefined

      // Determine initial selected date (skip weekend if weekends are hidden)
      let initialSelectedDate = currentDate.value
      if (!isRecreate && settings.showWeekends.value === false) {
        const dow = initialSelectedDate.dayOfWeek // 1 = Monday ... 7 = Sunday
        if (dow === 6) initialSelectedDate = initialSelectedDate.add({ days: 2 }) // Saturday -> Monday
        else if (dow === 7) initialSelectedDate = initialSelectedDate.add({ days: 1 }) // Sunday -> Monday
        currentDate.value = initialSelectedDate
      }

      calendarApp.value = createCalendar({
        views: [
          createViewDay(),
          createViewWeek(),
          createViewMonthGrid(),
          createViewMonthAgenda(),
        ],
        locale: 'fr-FR',
        isDark: uiIsDark.value,
        timezone,
        selectedDate: initialSelectedDate,
        showWeekNumbers: true,
        dayBoundaries: { start: '07:00', end: '20:00' },
        weekOptions: getWeekOptions(),
        calendars: buildCalendarsUtil(settings.colors.value),
        events: mappedEvents,
        plugins: [
          calendarControls,
          eventsServicePlugin,
          eventModal,
          createCurrentTimePlugin(),
        ],
        translations: mergeLocales(translations),
        callbacks: {
          onRangeUpdate: () => {
            currentView.value = calendarControls.getView()
          },
        },
      })

      currentView.value = calendarControls.getView()

      // Restore previous state if available
      if (prevView) calendarControls.setView?.(prevView)
      if (isRecreate && prevDate) calendarControls.setDate?.(prevDate)
    } else {
      eventsServicePlugin.set(mappedEvents)
    }
  }

  // Sync on planning change and when new events arrive
  watch(planning.planningFullIds, () => {
    void initOrUpdate()
  }, { immediate: true })

  watch(planning.events, () => {
    if (calendarApp.value) {
      eventsServicePlugin.set(getMappedEvents(timezoneValue.value))
    }
  })

  // Update calendars palette in place when colors change
  watch(() => settings.colors.value, () => {
    if (!calendarApp.value) return
    calendarControls.setCalendars(buildCalendarsUtil(settings.colors.value))
  }, { deep: true })

  // Update calendar when theme darkness changes
  watch(uiIsDark, (isDark) => {
    calendarApp.value?.setTheme(isDark ? 'dark' : 'light')
  })

  // Update calendar when the number of days in week view changes
  watch(() => settings.weekNDays.value, () => {
    calendarControls.setWeekOptions(getWeekOptions())
  })

  // Update calendar when timezone changes
  watch(timezoneValue, () => {
    calendarControls.setTimezone(timezoneValue.value)
  })

  // Manual reload if needed by UI
  function reload() {
    void planning.refresh()
  }

  // Calendar initializes when planning data is available via the watch

  // Humanized cumulated event duration for the current view range
  const nbHours = computed<string | null>(() => {
    const events = planning.events.value ?? []
    if (!events.length) return null

    // Resolve current range [startMs, endMs]
    const view = currentView.value
    if (!view) return null

    const cd = currentDate.value
    const N_DAYS = settings.weekNDays.value
    let rangeStartMs = 0
    let rangeEndMs = 0

    const toMsRangeForPlainDate = (pd: any) => {
      const y = pd.year as number
      const m = pd.month as number
      const d = pd.day as number
      const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
      const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
      return [start, end] as const
    }

    if (view === 'day') {
      [rangeStartMs, rangeEndMs] = toMsRangeForPlainDate(cd)
    } else if (view === 'week') {
      const dow = (cd as any).dayOfWeek as number // 1 = Monday ... 7 = Sunday
      const startOfWeek = cd.subtract({ days: dow - 1 })
      const endOfWeek = startOfWeek.add({ days: N_DAYS - 1 })
      const weekStart = new Date(startOfWeek.year, startOfWeek.month - 1, startOfWeek.day, 0, 0, 0, 0).getTime()
      const weekEnd = new Date(endOfWeek.year, endOfWeek.month - 1, endOfWeek.day, 23, 59, 59, 999).getTime()
      rangeStartMs = weekStart
      rangeEndMs = weekEnd
    } else if (view === 'month-grid' || view === 'month-agenda') {
      const firstOfMonth = cd.with({ day: 1 })
      const nextMonth = firstOfMonth.add({ months: 1 })
      const lastOfMonth = nextMonth.subtract({ days: 1 })
      const monthStart = new Date(firstOfMonth.year, firstOfMonth.month - 1, firstOfMonth.day, 0, 0, 0, 0).getTime()
      const monthEnd = new Date(lastOfMonth.year, lastOfMonth.month - 1, lastOfMonth.day, 23, 59, 59, 999).getTime()
      rangeStartMs = monthStart
      rangeEndMs = monthEnd
    } else {
      [rangeStartMs, rangeEndMs] = toMsRangeForPlainDate(cd)
    }

    // Collect overlapping event intervals within range, clipped to range
    const intervals: Array<{ s: number, e: number }> = []
    for (const ev of events) {
      const s = ev.startDate instanceof Date ? ev.startDate.getTime() : new Date(ev.startDate as any).getTime()
      const e = ev.endDate instanceof Date ? ev.endDate.getTime() : new Date(ev.endDate as any).getTime()
      const start = Math.max(s, rangeStartMs)
      const end = Math.min(e, rangeEndMs)
      if (end > start) intervals.push({ s: start, e: end })
    }

    if (intervals.length === 0) return null

    // Merge overlapping intervals (union) and sum durations
    intervals.sort((a, b) => a.s - b.s)
    let totalMs = 0
    let curS = intervals[0]!.s
    let curE = intervals[0]!.e
    for (let i = 1; i < intervals.length; i++) {
      const { s, e } = intervals[i]!
      if (s <= curE) {
        curE = Math.max(curE, e)
      } else {
        totalMs += (curE - curS)
        curS = s
        curE = e
      }
    }
    totalMs += (curE - curS)

    if (totalMs <= 0) return null

    const totalMinutes = Math.round(totalMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0 && minutes > 0) return `${hours}h${minutes}m`
    if (hours > 0) return `${hours}h`
    return `${minutes}m`
  })

  return {
    calendarApp,
    calendarControls,
    eventsServicePlugin,
    eventModal,
    nbHours,
    nextPeriod,
    prevPeriod,
    reload,
    loading,
  }
}
