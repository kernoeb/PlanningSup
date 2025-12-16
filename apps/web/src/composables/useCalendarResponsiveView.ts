import type { createCalendar } from '@schedule-x/calendar'
import type { createCalendarControlsPlugin } from '@schedule-x/calendar-controls'
import type { Ref } from 'vue'
import { useLocalStorage, useWindowSize } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

type CalendarApp = ReturnType<typeof createCalendar>
type CalendarControls = ReturnType<typeof createCalendarControlsPlugin>

const RESPONSIVE_BREAKPOINT = 700 // ScheduleX internal breakpoint
export const PLANNING_CALENDAR_VIEW_STORAGE_KEY = 'planning.calendar.view'

type PlanningCalendarView = 'day' | 'week' | 'month-grid' | 'month-agenda'

function normalizePlanningCalendarView(view: unknown): PlanningCalendarView | null {
  if (view === 'day' || view === 'week' || view === 'month-grid' || view === 'month-agenda') return view
  return null
}

/**
 * Tracks the current calendar view and restores the previous desktop view
 * after the ScheduleX internal 700px breakpoint switches to day mode.
 */
export function useCalendarResponsiveView(options: {
  calendarControls: CalendarControls
  calendarApp: Ref<CalendarApp | null>
}) {
  const { calendarControls, calendarApp } = options

  const { width: windowWidth } = useWindowSize()
  const isSmallScreen = computed(() => windowWidth.value < RESPONSIVE_BREAKPOINT)

  const lastDesktopView = useLocalStorage<string | null>(PLANNING_CALENDAR_VIEW_STORAGE_KEY, null, {
    writeDefaults: false,
  })
  const shouldRestoreView = shallowRef(false)
  const canPersistView = shallowRef(false)

  const preferredView = computed<PlanningCalendarView>(() => {
    if (isSmallScreen.value) return 'day'
    return normalizePlanningCalendarView(lastDesktopView.value) ?? 'week'
  })

  // Initialize to a best-guess view even before ScheduleX has mounted.
  // This avoids `null` consumers during bootstrap (e.g. weekOptions sizing).
  const currentView = shallowRef<PlanningCalendarView>(preferredView.value)

  const safeGetView = (): PlanningCalendarView | null => {
    if (!calendarApp.value) return null
    try {
      return normalizePlanningCalendarView(calendarControls.getView())
    } catch {
      return null
    }
  }

  const updateCurrentView = (view?: string | null) => {
    const next = normalizePlanningCalendarView(view) ?? safeGetView() ?? preferredView.value
    currentView.value = next

    // Don't overwrite the "real" view with ScheduleX forced 'day' while below the breakpoint.
    // This keeps the auto day/week switch on resize while still persisting the user's last view.
    if (isSmallScreen.value && next === 'day') return

    // Avoid overwriting persisted view during initial calendar bootstrap (ScheduleX defaults to week).
    if (!canPersistView.value) return

    lastDesktopView.value = next
  }

  // Keep a non-null, best-guess view before the calendar app exists.
  watch([preferredView, calendarApp], ([pref, app]) => {
    if (app) return
    currentView.value = pref
  }, { immediate: true, flush: 'sync' })

  // Restore the persisted desktop view when the calendar becomes available on large screens.
  // (ScheduleX will force 'day' on small screens anyway.)
  const restoredForApp = shallowRef<CalendarApp | null>(null)
  watch([calendarApp, isSmallScreen], ([app, small]) => {
    if (!app) return
    if (small) {
      // Don't mark restored on small screens: we want to restore when coming back to desktop.
      canPersistView.value = true
      return
    }
    if (restoredForApp.value === app) return
    restoredForApp.value = app

    const target = normalizePlanningCalendarView(lastDesktopView.value)
    canPersistView.value = true
    if (!target) return

    const current = safeGetView()
    if (current === target) return

    calendarControls.setView(target)
    updateCurrentView(target)
  }, { immediate: true, flush: 'sync' })

  // Restore the previous large-screen view when leaving the small breakpoint
  watch(isSmallScreen, (isSmall, wasSmall) => {
    if (isSmall) {
      if (!calendarApp.value) return
      // Capture the current view before the calendar forces day mode
      if (wasSmall === false) {
        const view = safeGetView()
        shouldRestoreView.value = !!(view && view !== 'day')
        if (shouldRestoreView.value) lastDesktopView.value = view
        else shouldRestoreView.value = false
      }
      return
    }

    if (wasSmall !== true) return
    if (!calendarApp.value) return

    const current = safeGetView()
    const target = normalizePlanningCalendarView(lastDesktopView.value)
    if (shouldRestoreView.value && current === 'day' && target && target !== 'day') {
      calendarControls.setView(target)
      updateCurrentView(target)
    }

    shouldRestoreView.value = false
  })

  return {
    currentView,
    isSmallScreen,
    preferredView,
    updateCurrentView,
  }
}
