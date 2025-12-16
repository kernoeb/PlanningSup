import type { Events, PlanningWithEvents } from '@libs'
import type { Ref } from 'vue'
import { client } from '@libs'
import { useIntervalFn, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useSharedSettings } from './useSettings'
import { useSharedSyncedCurrentPlanning } from './useSyncedCurrentPlanning'

export type EventWithFullId = Events[number] & { fullId: string }

export interface PlanningDataStore {
  planningFullIds: Ref<string[]>
  titles: Ref<Record<string, string>>
  events: Ref<EventWithFullId[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
}

/**
 * Singleton store for planning data (titles + events) bound to the selected plannings.
 *
 * - When multiple plannings are selected, fetch all in parallel.
 * - Concatenate events from successful responses.
 * - Partial failures are reported in `error` while still rendering successful data.
 */
let _instance: PlanningDataStore | null = null

function createPlanningDataStore(): PlanningDataStore {
  const { planningFullIds } = useSharedSyncedCurrentPlanning()
  const settings = useSharedSettings()

  const titles = ref<Record<string, string>>({})
  const events = ref<EventWithFullId[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Prevent race conditions when selection changes quickly
  let requestToken = 0

  // Background refresh management
  const focused = useWindowFocus()
  const lastRefreshAt = ref<number>(0) // epoch ms of last attempted refresh
  const BACKGROUND_COOLDOWN_MS = 60_000 // 60s cool-down for background triggers
  const NATURAL_INTERVAL_MS = 60_000 * 5 // 5 minutes

  async function maybeBackgroundRefresh(trigger: string) {
    // Avoid overlapping requests
    if (loading.value) return
    // Enforce cool-down
    const now = Date.now()
    if (now - lastRefreshAt.value < BACKGROUND_COOLDOWN_MS) return
    await refresh(`bg:${trigger}`)
  }

  async function refresh(_reason: string = 'manual') {
    const fullIds = [...planningFullIds.value]

    if (fullIds.length === 0) {
      titles.value = {}
      events.value = []
      error.value = null
      return
    }

    lastRefreshAt.value = Date.now()
    loading.value = true
    error.value = null
    const token = ++requestToken

    try {
      const results = await Promise.allSettled(
        fullIds.map(fullId =>
          client.api.plannings({ fullId }).get({
            query: {
              events: 'true',
              ...settings.queryParams.value,
            },
          }),
        ),
      )

      // Ignore outdated responses
      if (token !== requestToken) return

      const successes: Array<PlanningWithEvents> = []
      const errors: string[] = []
      const titlesMap: Record<string, string> = {}

      for (let i = 0; i < fullIds.length; i++) {
        const id = fullIds[i]!
        const res = results[i]
        if (!res) {
          errors.push(`${id}: missing response`)
          continue
        }

        if (res.status === 'fulfilled') {
          const data = res.value?.data
          if (!data) {
            errors.push(`${id}: invalid response`)
            continue
          }

          // Titles should not depend on whether events loaded successfully.
          if ('fullId' in data && 'title' in data && typeof data.fullId === 'string' && typeof data.title === 'string') {
            titlesMap[data.fullId] = data.title
          }

          // Only append events when they exist (some API responses can have `events: null` while still exposing a title).
          if ('events' in data && data.events) successes.push(data as PlanningWithEvents)
          else if ('status' in data && data.status === 'error' && typeof data.title === 'string') errors.push(`${id}: ${data.title}`)
          else errors.push(`${id}: no events`)
        } else {
          const msg = res.reason instanceof Error ? res.reason.message : String(res.reason)
          errors.push(`${id}: ${msg}`)
        }
      }

      // Titles - build map of fullId -> title (includes responses with `events: null`).
      titles.value = titlesMap

      // Events (concatenate)
      events.value = successes.length > 0
        ? successes.flatMap(s => (s.events || []).map(e => ({ ...e, fullId: s.fullId })))
        : []

      // Partial failures shouldn't wipe out data from successes; surface an error note
      error.value = errors.length > 0
        ? `Some plannings failed to load (${errors.length}). Details: ${errors.join(' | ')}`
        : null
    } catch (e: unknown) {
      if (token !== requestToken) return
      error.value = e instanceof Error ? e.message : String(e)
      titles.value = {}
      events.value = []
    } finally {
      if (token === requestToken) loading.value = false
    }
  }

  // Natural background refresh every 5 minutes
  const { pause, resume } = useIntervalFn(() => {
    void maybeBackgroundRefresh('interval')
  }, NATURAL_INTERVAL_MS)

  // Start/stop the interval depending on whether we have a valid selection
  watch(planningFullIds, () => {
    const hasSelection = (planningFullIds.value ?? []).some(s => !!s && s.trim().length > 0)
    if (hasSelection) resume()
    else pause()
  }, { immediate: true })

  // Trigger background refresh on window focus (respects 60s cooldown and no overlap)
  watch(focused, (isFocused) => {
    if (isFocused) void maybeBackgroundRefresh('focus')
  })

  // Auto-load and reload on planning selection or settings changes
  watch(planningFullIds, () => {
    void refresh('planningFullIds')
  }, { immediate: true })
  watch(settings.queryParams, () => {
    void refresh('settings.queryParams')
  })

  return {
    planningFullIds,
    titles,
    events,
    loading,
    error,
    refresh,
  }
}

export function usePlanningData(): PlanningDataStore {
  if (_instance) return _instance
  _instance = createPlanningDataStore()
  return _instance
}
