import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { useUserPrefsSync } from '@web/composables/useUserPrefsSync'
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

// Stable normalization of colors for comparison/stringify (ensure key order)
function normalizeColors(c: ColorMap) {
  return {
    lecture: c.lecture,
    lab: c.lab,
    tutorial: c.tutorial,
    other: c.other,
  }
}
function encodeColorsToString(c: ColorMap): string {
  return JSON.stringify(normalizeColors(c))
}
function parseAndNormalizeColors(raw: unknown) {
  if (typeof raw !== 'string') return null
  try {
    const obj = JSON.parse(raw as string)
    return normalizeColors({
      lecture: obj.lecture,
      lab: obj.lab,
      tutorial: obj.tutorial,
      other: obj.other,
    } as ColorMap)
  } catch {
    return null
  }
}

/**
 * useSettings
 * - Persists:
 *   - colors[lecture|lab|tutorial|other]: string
 *   - highlightTeacher: boolean (backend-only; affects server response)
 *   - blocklist: string[]
 *   - targetTimezone: string | null
 *   - showWeekends: boolean
 * - Exposes:
 *   - queryParams: Record<string, string> matching backend expectation
 *   - weekNDays: number (7 when showWeekends, otherwise 5)
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

  // 5) Show weekends in week view (client-only)
  // Default false to match current behavior (5-day week)
  const showWeekends = useLocalStorage<boolean>('settings.showWeekends', false)

  // Derived helper for calendar weekOptions.nDays
  const weekNDays = computed(() => (showWeekends.value ? 7 : 5))

  /**
   * Computed query params to be appended to backend requests.
   * Note: Colors are client-side only and are not sent to the backend.
   * Shape:
   * - highlightTeacher=true            (only when true)
   * - blocklist=a,b,c                  (only when non-empty)
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

    return qp
  })

  /**
   * Returns the color for a given event kind, falling back to defaults if missing.
   */
  function getColorFor(kind: EventKind): string {
    return colors.value[kind] ?? DEFAULT_COLORS[kind]
  }

  // Local-first sync to DB for user preferences (debounced, only on actual changes)
  const { syncPref } = useUserPrefsSync()

  // highlightTeacher
  syncPref('highlightTeacher', highlightTeacher, {
    toServer: v => v,
    normalizeLocal: v => v,
    normalizeServer: v => v,
    fromServerToLocal: raw => (typeof raw === 'boolean' ? (raw as boolean) : null),
    setLocal: v => (highlightTeacher.value = v),
    debounce: 10,
  })

  // showWeekends
  syncPref('showWeekends', showWeekends, {
    toServer: v => v,
    normalizeLocal: v => v,
    normalizeServer: v => v,
    fromServerToLocal: raw => (typeof raw === 'boolean' ? (raw as boolean) : null),
    setLocal: v => (showWeekends.value = v),
    debounce: 10,
  })

  // blocklist
  syncPref('blocklist', blocklist, {
    toServer: v => v,
    normalizeLocal: v => v,
    normalizeServer: v => v,
    fromServerToLocal: raw =>
      Array.isArray(raw) && raw.every(x => typeof x === 'string') ? (raw as string[]) : null,
    setLocal: v => (blocklist.value = v),
    debounce: 250,
  })

  // colors (stored in DB as JSON string)
  syncPref('colors', colors, {
    toServer: v => encodeColorsToString(v),
    normalizeLocal: v => normalizeColors(v),
    normalizeServer: raw => parseAndNormalizeColors(raw),
    fromServerToLocal: (raw) => {
      const parsed = parseAndNormalizeColors(raw)
      if (!parsed) return null
      return {
        lecture: parsed.lecture ?? DEFAULT_COLORS.lecture,
        lab: parsed.lab ?? DEFAULT_COLORS.lab,
        tutorial: parsed.tutorial ?? DEFAULT_COLORS.tutorial,
        other: parsed.other ?? DEFAULT_COLORS.other,
      }
    },
    setLocal: v => (colors.value = v),
    debounce: 400,
  })

  return {
    // state
    colors,
    highlightTeacher,
    blocklist,
    targetTimezone,
    showWeekends,

    // derived
    queryParams,
    weekNDays,

    // helpers
    getColorFor,
  }
}
export const useSharedSettings = createSharedComposable(useSettings)
