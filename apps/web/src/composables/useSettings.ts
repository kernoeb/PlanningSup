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
 *   - highlightTeacher: boolean (backend-only; affects server response)
 *   - blocklist: string[]
 *   - targetTimezone: string | null
 * - Exposes:
 *   - queryParams: Record<string, string> matching backend expectation
 *   - getColorFor(kind)
 *   - highlightTeacher is backend-only (no client-side dimming)
 *   - colors are client-side only (not included in query params)
 */
export function useSettings() {
  // 1) Calendar event colors (object)
  const colors = useLocalStorage<ColorMap>('settings.colors', getDefaultColors(), {
    mergeDefaults: true,
  })

  // 2) Highlight events with teacher (backend-only flag; affects server response)
  const highlightTeacher = useLocalStorage<boolean>('settings.highlightTeacher', false)

  // 3) Blocklist (array of strings)
  const blocklist = useLocalStorage<string[]>('settings.blocklist', [])

  // 4) Target timezone (IANA string or null)
  const targetTimezone = useLocalStorage<string | null>('settings.targetTimezone', null)
  // Normalize empty string to null for robustness (e.g., when cleared from UI)
  if (targetTimezone.value === '') targetTimezone.value = null

  /**
   * Computed query params to be appended to backend requests.
   * Note: Colors are client-side only and are not sent to the backend.
   * Shape:
   * - highlightTeacher=true            (only when true)
   * - blocklist=a,b,c                  (only when non-empty)
   * - browserTimezone=Europe/Paris     (only when targetTimezone is set)
   * - targetTimezone=UTC               (only when targetTimezone is set)
   */
  const queryParams = computed<Record<string, string>>(() => {
    const qp: Record<string, string> = {}

    // Colors are applied client-side via ScheduleX palettes; not sent to backend.

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

  }
}
