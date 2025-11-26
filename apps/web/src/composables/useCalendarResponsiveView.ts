import type { createCalendar } from '@schedule-x/calendar'
import type { createCalendarControlsPlugin } from '@schedule-x/calendar-controls'
import type { Ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

type CalendarApp = ReturnType<typeof createCalendar>
type CalendarControls = ReturnType<typeof createCalendarControlsPlugin>

const RESPONSIVE_BREAKPOINT = 700 // ScheduleX internal breakpoint

/**
 * Tracks the current calendar view and restores the previous desktop view
 * after the ScheduleX internal 700px breakpoint switches to day mode.
 */
export function useCalendarResponsiveView(options: {
  calendarControls: CalendarControls
  calendarApp: Ref<CalendarApp | null>
}) {
  const { calendarControls, calendarApp } = options

  const currentView = shallowRef<string | null>(null)
  const lastDesktopView = shallowRef<string | null>(null)
  const shouldRestoreView = shallowRef(false)

  const { width: windowWidth } = useWindowSize()
  const isSmallScreen = computed(() => windowWidth.value < RESPONSIVE_BREAKPOINT)

  const updateCurrentView = (view?: string | null) => {
    currentView.value = view ?? calendarControls.getView() ?? null
  }

  // Keep track of the last desktop-friendly view (not forced to day by small screens)
  watch([currentView, isSmallScreen], ([view, small]) => {
    if (!small && view && view !== 'day') lastDesktopView.value = view
  })

  // Restore the previous large-screen view when leaving the small breakpoint
  watch(isSmallScreen, (isSmall, wasSmall) => {
    if (isSmall) {
      // Capture the current view before the calendar forces day mode
      if (wasSmall === false) {
        const view = calendarControls.getView()
        shouldRestoreView.value = !!(view && view !== 'day')
        if (shouldRestoreView.value) lastDesktopView.value = view
        else shouldRestoreView.value = false
      }
      return
    }

    if (wasSmall !== true) return
    if (!calendarApp.value) return

    const current = calendarControls.getView()
    const target = lastDesktopView.value
    if (shouldRestoreView.value && current === 'day' && target && target !== 'day') {
      calendarControls.setView(target)
    }

    shouldRestoreView.value = false
  })

  return {
    currentView,
    isSmallScreen,
    updateCurrentView,
  }
}
