import type { Events, PlanningWithEvents } from '@libs'
import type { Ref } from 'vue'
import { client } from '@libs'
import { useIntervalFn, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useSettings } from './useSettings'
import { useSyncedCurrentPlanning } from './useSyncedCurrentPlanning'

export type EventWithFullId = Events[number] & { fullId: string }

export interface PlanningDataStore {
  planningFullIds: Ref<string[]>
  title: Ref<string>
  events: Ref<EventWithFullId[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
}

/**
 * Singleton store for planning data (title + events) bound to the selected plannings.
 *
 * - When multiple plannings are selected, fetch all in parallel.
 * - Concatenate events from successful responses.
 * - Partial failures are reported in `error` while still rendering successful data.
 */
let _instance: PlanningDataStore | null = null

function createPlanningDataStore(): PlanningDataStore {
  const { planningFullIds } = useSyncedCurrentPlanning()
  const settings = useSettings()

  const title = ref<string>('')
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

  async function maybeBackgroundRefresh() {
    // Avoid overlapping requests
    if (loading.value) return
    // Enforce cool-down
    const now = Date.now()
    if (now - lastRefreshAt.value < BACKGROUND_COOLDOWN_MS) return
    await refresh()
  }

  async function refresh() {
    const fullIds = [...planningFullIds.value]

    if (fullIds.length === 0) {
      title.value = ''
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

      for (let i = 0; i < fullIds.length; i++) {
        const id = fullIds[i]!
        const res = results[i]
        if (!res) {
          errors.push(`${id}: missing response`)
          continue
        }

        if (res.status === 'fulfilled') {
          const data = res.value?.data
          if (data && 'events' in data && data.events) successes.push(data)
          else errors.push(`${id}: invalid response`)
        } else {
          const msg = res.reason instanceof Error ? res.reason.message : String(res.reason)
          errors.push(`${id}: ${msg}`)
        }
      }

      // Titles
      if (successes.length === 0) {
        title.value = fullIds.join(' + ')
      } else if (successes.length === 1) {
        title.value = successes[0]!.title
      } else {
        title.value = successes.map(s => s.title).join(' + ')
      }

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
      title.value = fullIds.join(' + ')
      events.value = []
    } finally {
      if (token === requestToken) loading.value = false
    }
  }

  // Natural background refresh every 5 minutes
  const { pause, resume } = useIntervalFn(() => {
    void maybeBackgroundRefresh()
  }, NATURAL_INTERVAL_MS)

  // Start/stop the interval depending on whether we have a valid selection
  watch(planningFullIds, () => {
    const hasSelection = (planningFullIds.value ?? []).some(s => !!s && s.trim().length > 0)
    if (hasSelection) resume()
    else pause()
  }, { immediate: true })

  // Trigger background refresh on window focus (respects 60s cooldown and no overlap)
  watch(focused, (isFocused) => {
    if (isFocused) void maybeBackgroundRefresh()
  })

  // Auto-load and reload on planning selection or settings changes
  watch(planningFullIds, () => {
    void refresh()
  }, { immediate: true })
  watch(settings.queryParams, () => {
    void refresh()
  })

  return {
    planningFullIds,
    title,
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
