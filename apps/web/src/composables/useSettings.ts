import { useLocalStorage } from '@vueuse/core'
import { detectBrowserTimezone } from '@web/composables/useTimezone'
import { computed } from 'vue'

export type EventKind = 'lecture' | 'lab' | 'tutorial' | 'other'
export type ColorMap = Record<EventKind, string>

/**
 * Default color palette for planning event kinds.
 * These are Tailwind-like hex values to play nicely with DaisyUI themes.
 */
const DEFAULT_COLORS: ColorMap = {
  lecture: '#efd6d8',
  lab: '#bbe0ff',
  tutorial: '#d4fbcc',
  other: '#EDDD6E',
}

/**
 * Returns a fresh copy of the default colors.
 */
export function getDefaultColors(): ColorMap {
  return { ...DEFAULT_COLORS }
}

/**
 * Helper to detect the browser IANA timezone.
 * Delegates to shared detectBrowserTimezone from useTimezone.
 */
function getBrowserTimezone(): string | null {
  return detectBrowserTimezone()
}

/**
 * useSettings
 * - Persists:
 *   - colors[lecture|lab|tutorial|other]: string
 *   - highlightTeacher: boolean
 *   - blocklist: string[]
 *   - targetTimezone: string | null
 * - Exposes:
 *   - queryParams: Record<string, string> matching backend expectation
 *   - getColorFor(kind)
 *   - shouldDimEvent(hasTeacher)
 */
export function useSettings() {
  // 1) Calendar event colors (object)
  const colors = useLocalStorage<ColorMap>('settings.colors', getDefaultColors(), {
    mergeDefaults: true,
  })

  // 2) Highlight events with teacher (boolean)
  const highlightTeacher = useLocalStorage<boolean>('settings.highlightTeacher', false)

  // 3) Blocklist (array of strings)
  const blocklist = useLocalStorage<string[]>('settings.blocklist', [])

  // 4) Target timezone (IANA string or null)
  const targetTimezone = useLocalStorage<string | null>('settings.targetTimezone', null)
  // Normalize empty string to null for robustness (e.g., when cleared from UI)
  if (targetTimezone.value === '') targetTimezone.value = null

  /**
   * Computed query params to be appended to backend requests.
   * Shape:
   * - colors[lecture]=#xxxxxx
   * - colors[lab]=#xxxxxx
   * - colors[tutorial]=#xxxxxx
   * - colors[other]=#xxxxxx
   * - highlightTeacher=true            (only when true)
   * - blocklist=a,b,c                  (only when non-empty)
   * - browserTimezone=Europe/Paris     (only when targetTimezone is set)
   * - targetTimezone=UTC               (only when targetTimezone is set)
   */
  const queryParams = computed<Record<string, string>>(() => {
    const qp: Record<string, string> = {}

    qp['colors[lecture]'] = colors.value.lecture
    qp['colors[lab]'] = colors.value.lab
    qp['colors[tutorial]'] = colors.value.tutorial
    qp['colors[other]'] = colors.value.other

    if (highlightTeacher.value) {
      qp.highlightTeacher = 'true'
    }

    if (blocklist.value.length > 0) {
      qp.blocklist = blocklist.value.join(',')
    }

    // Include timezone query params only when a target timezone is selected
    if (targetTimezone.value) {
      const browserTz = getBrowserTimezone()
      if (browserTz) {
        qp.browserTimezone = browserTz
        qp.targetTimezone = targetTimezone.value
      }
    }

    return qp
  })

  /**
   * Returns the color for a given event kind, falling back to defaults if missing.
   */
  function getColorFor(kind: EventKind): string {
    return colors.value[kind] ?? DEFAULT_COLORS[kind]
  }

  /**
   * Returns true if an event should be visually dimmed (grayed) based on settings and presence of a teacher.
   * - When highlightTeacher is enabled, events WITHOUT teacher should be dimmed.
   */
  function shouldDimEvent(hasTeacher: boolean): boolean {
    return highlightTeacher.value && !hasTeacher
  }

  return {
    // state
    colors,
    highlightTeacher,
    blocklist,
    targetTimezone,

    // derived
    queryParams,

    // helpers
    getColorFor,
    shouldDimEvent,
  }
}
