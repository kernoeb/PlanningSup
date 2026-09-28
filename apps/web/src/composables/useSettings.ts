import type { EventFilters, TimeSlot } from '@libs/event-filters'
import { emptyEventFilters, eventFiltersToQuery, hiddenEventKey, MAX_HIDDEN_EVENTS, normalizeEventFilters } from '@libs/event-filters'
import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { resolveTimezone } from '@web/composables/useTimezone'
import { useUserPrefsSync } from '@web/composables/useUserPrefsSync'
import { computed } from 'vue'

export type EventKind = 'lecture' | 'lab' | 'tutorial' | 'other'
export type ColorMap = Record<EventKind, string>

export interface CustomGroup {
  id: `${string}-${string}-${string}-${string}-${string}` // UUID-v4
  name: string
  plannings: string[]
}

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

function normalizePlanningsForGroups(ids: readonly unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (trimmed.length > 255) continue
    if (!seen.has(trimmed)) {
      seen.add(trimmed)
      out.push(trimmed)
      if (out.length >= 100) break
    }
  }
  return out
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface NormalizedCustomGroup { id: string, name: string, plannings: string[] }
function normalizeCustomGroups(raw: unknown): NormalizedCustomGroup[] {
  if (!Array.isArray(raw)) return []
  const isUuid = (id: string) => UUID_RE.test(id)
  const out: NormalizedCustomGroup[] = []
  const seenIds = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const id = typeof obj.id === 'string' ? obj.id.trim() : ''
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!id || !isUuid(id)) continue
    if (!name || name.length > 80) continue
    if (seenIds.has(id)) continue
    seenIds.add(id)
    const plannings = normalizePlanningsForGroups(Array.isArray(obj.plannings) ? obj.plannings : [])
    out.push({ id, name, plannings })
    if (out.length >= 50) break
  }
  return out
}
function encodeCustomGroupsToString(groups: CustomGroup[]): string {
  // Ensure a stable key order per entry for predictable JSON stringify comparisons.
  const normalized = normalizeCustomGroups(groups).map(g => ({ id: g.id, name: g.name, plannings: g.plannings }))
  return JSON.stringify(normalized)
}
function parseAndNormalizeEventFilters(raw: unknown): EventFilters | null {
  if (typeof raw !== 'string') return null
  try {
    return normalizeEventFilters(JSON.parse(raw || '{}'))
  } catch {
    return null
  }
}

function parseAndNormalizeCustomGroups(raw: unknown): NormalizedCustomGroup[] | null {
  if (typeof raw !== 'string') return null
  try {
    return normalizeCustomGroups(JSON.parse(raw || '[]'))
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
 *   - mergeDuplicates: boolean
 *   - customGroups: CustomGroup[] (synced as a JSON string in user prefs)
 *   - eventFilters: EventFilters (teachers, rooms, time slots, hidden courses; synced as a JSON string)
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
  const targetTimezone = useLocalStorage<string | null>('settings.targetTimezone', null, {
    // Store raw strings (no JSON quotes) for nicer localStorage UX and easy inspection.
    // - null => '' (empty string)
    // - '' => null
    serializer: {
      read: (raw: string) => {
        const v = (raw ?? '').trim()
        return v.length ? v : null
      },
      write: (value: string | null) => (value ?? '').trim(),
    },
  })

  // 5) Show weekends in week view (client-only)
  // Default false to match current behavior (5-day week)
  const showWeekends = useLocalStorage<boolean>('settings.showWeekends', false)

  // 6) Merge duplicate events across plannings (client-only)
  const mergeDuplicates = useLocalStorage<boolean>('settings.mergeDuplicates', true)

  // 7) Save custom planning groups
  const customGroups = useLocalStorage<CustomGroup[]>('settings.customGroups', [])

  // 8) Course filters, applied by the API like the blocklist
  const eventFilters = useLocalStorage<EventFilters>('settings.eventFilters', emptyEventFilters(), {
    mergeDefaults: true,
  })

  // Derived helper for calendar weekOptions.nDays
  const weekNDays = computed(() => (showWeekends.value ? 7 : 5))

  /**
   * Filter params, shared by the events requests and the ICS link.
   * Time slots are written in the timezone the calendar shows.
   */
  const filterParams = computed<Record<string, string>>(() => {
    const qp: Record<string, string> = {}
    if (blocklist.value.length > 0) {
      qp.blocklist = blocklist.value.join(',')
    }
    return { ...qp, ...eventFiltersToQuery(normalizeEventFilters(eventFilters.value), resolveTimezone(targetTimezone.value)) }
  })

  /**
   * Computed query params to be appended to backend requests.
   * Note: Colors are client-side only and are not sent to the backend.
   * Shape:
   * - highlightTeacher=true            (only when true)
   * - blocklist, teachers, rooms, slots, tz, hidden (see filterParams)
   */
  const queryParams = computed<Record<string, string>>(() => {
    const qp: Record<string, string> = {}

    // Colors are applied client-side via ScheduleX palettes; not sent to backend.

    if (highlightTeacher.value) {
      qp.highlightTeacher = 'true'
    }

    return { ...qp, ...filterParams.value }
  })

  /**
   * Returns the color for a given event kind, falling back to defaults if missing.
   */
  function getColorFor(kind: EventKind): string {
    return colors.value[kind] ?? DEFAULT_COLORS[kind]
  }

  /**
   * Add a Custom Group
   */
  function addCustomGroup({ name, plannings }: { name: string, plannings: string[] }) {
    const customGroup: CustomGroup = {
      id: crypto.randomUUID(),
      name,
      plannings,
    }
    customGroups.value.push(customGroup)
  }

  function addTimeSlot(slot: TimeSlot) {
    eventFilters.value = normalizeEventFilters({ ...eventFilters.value, slots: [...eventFilters.value.slots, slot] })
  }

  // Past hidden courses are dropped here, so the list and the ICS link stay short.
  function hideEventOnce(event: { title: string, start: Date }) {
    const now = Date.now()
    const key = hiddenEventKey(event.title, event.start)
    const hidden = eventFilters.value.hidden.filter(h => h.key !== key && Date.parse(h.start) >= now - 24 * 60 * 60 * 1000)
    hidden.push({ key, title: event.title, start: event.start.toISOString() })
    eventFilters.value = { ...eventFilters.value, hidden: hidden.slice(-MAX_HIDDEN_EVENTS) }
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

  // mergeDuplicates (client-side behavior but kept in user prefs for consistency)
  syncPref('mergeDuplicates', mergeDuplicates, {
    toServer: v => v,
    normalizeLocal: v => v,
    normalizeServer: v => v,
    fromServerToLocal: raw => (typeof raw === 'boolean' ? (raw as boolean) : null),
    setLocal: v => (mergeDuplicates.value = v),
    debounce: 50,
  })

  // customGroups (client-side behavior but kept in user prefs for consistency)
  syncPref('customGroups', customGroups, {
    toServer: v => encodeCustomGroupsToString(v),
    normalizeLocal: v => normalizeCustomGroups(v),
    normalizeServer: raw => parseAndNormalizeCustomGroups(raw),
    fromServerToLocal: (raw) => {
      const parsed = parseAndNormalizeCustomGroups(raw)
      if (!parsed) return null
      return parsed.map(g => ({
        id: g.id as CustomGroup['id'],
        name: g.name,
        plannings: g.plannings,
      }))
    },
    setLocal: v => (customGroups.value = v),
    debounce: 50,
  })

  // eventFilters (stored in DB as JSON string)
  syncPref('eventFilters', eventFilters, {
    toServer: v => JSON.stringify(normalizeEventFilters(v)),
    normalizeLocal: v => normalizeEventFilters(v),
    normalizeServer: raw => parseAndNormalizeEventFilters(raw),
    fromServerToLocal: raw => parseAndNormalizeEventFilters(raw),
    setLocal: v => (eventFilters.value = v),
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
    mergeDuplicates,
    customGroups,
    eventFilters,

    // derived
    filterParams,
    queryParams,
    weekNDays,

    // helpers
    getColorFor,
    addCustomGroup,
    addTimeSlot,
    hideEventOnce,
  }
}
export const useSharedSettings = createSharedComposable(useSettings)
