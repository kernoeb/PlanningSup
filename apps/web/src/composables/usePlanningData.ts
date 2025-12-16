import type { Events, PlanningWithEvents } from '@libs'
import type { Ref } from 'vue'
import { client } from '@libs'
import { useIntervalFn, useOnline, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useSharedSettings } from './useSettings'
import { useSharedSyncedCurrentPlanning } from './useSyncedCurrentPlanning'

export type EventWithFullId = Events[number] & { fullId: string }

export interface NetworkFailure {
  fullId: string
  title: string
  timestamp: number | null // last backup timestamp
}

export interface PlanningDataStore {
  planningFullIds: Ref<string[]>
  titles: Ref<Record<string, string>>
  events: Ref<EventWithFullId[]>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  error: Ref<string | null>
  networkFailures: Ref<NetworkFailure[]>
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
  const isOnline = useOnline()

  const titles = ref<Record<string, string>>({})
  const events = ref<EventWithFullId[]>([])
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const networkFailures = ref<NetworkFailure[]>([])

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

  /**
   * Process API response and extract planning data.
   */
  function processResponse(
    fullId: string,
    res: PromiseSettledResult<Awaited<ReturnType<ReturnType<typeof client.api.plannings>['get']>>> | undefined,
  ): { success: PlanningWithEvents | null, title: string | null, error: string | null, timestamp: number | null } {
    if (!res) {
      return { success: null, title: null, error: `${fullId}: missing response`, timestamp: null }
    }

    if (res.status === 'rejected') {
      const msg = res.reason instanceof Error ? res.reason.message : String(res.reason)
      return { success: null, title: null, error: `${fullId}: ${msg}`, timestamp: null }
    }

    const data = res.value?.data
    if (!data) {
      return { success: null, title: null, error: `${fullId}: invalid response`, timestamp: null }
    }

    const title = ('fullId' in data && 'title' in data && typeof data.fullId === 'string' && typeof data.title === 'string')
      ? data.title
      : null

    const timestamp = ('timestamp' in data && typeof data.timestamp === 'number') ? data.timestamp : null

    if ('events' in data && data.events) {
      return { success: data as PlanningWithEvents, title, error: null, timestamp }
    }

    if ('status' in data && data.status === 'error') {
      return { success: null, title, error: `${fullId}: no events available`, timestamp }
    }

    return { success: null, title, error: `${fullId}: no events`, timestamp }
  }

  async function refresh(_reason: string = 'manual') {
    const fullIds = [...planningFullIds.value]

    if (fullIds.length === 0) {
      titles.value = {}
      events.value = []
      error.value = null
      networkFailures.value = []
      refreshing.value = false
      return
    }

    lastRefreshAt.value = Date.now()
    loading.value = true
    refreshing.value = false
    error.value = null
    networkFailures.value = []
    const token = ++requestToken

    try {
      const dbSuccesses: Array<PlanningWithEvents> = []
      const dbErrors: string[] = []
      const titlesMap: Record<string, string> = {}
      const dbTimestamps: Record<string, number | null> = {}

      // Phase 1: Fast database-only fetch (parallel) - skip when offline
      if (isOnline.value) {
        const dbResults = await Promise.allSettled(
          fullIds.map(fullId =>
            client.api.plannings({ fullId }).get({
              query: {
                events: 'true',
                onlyDb: 'true',
                ...settings.queryParams.value,
              },
            }),
          ),
        )

        // Ignore outdated responses
        if (token !== requestToken) return

        for (let i = 0; i < fullIds.length; i++) {
          const id = fullIds[i]!
          const { success, title, error: err, timestamp } = processResponse(id, dbResults[i])

          if (title) titlesMap[id] = title
          if (success) dbSuccesses.push(success)
          else if (err) dbErrors.push(err)
          dbTimestamps[id] = timestamp
        }

        // Update UI immediately with database data
        titles.value = { ...titlesMap }
        events.value = dbSuccesses.length > 0
          ? dbSuccesses.flatMap(s => (s.events || []).map(e => ({ ...e, fullId: s.fullId })))
          : []
      }

      // Mark loading as done after DB phase, start refreshing phase
      loading.value = false
      refreshing.value = true

      // Phase 2: Network fetch (parallel, update UI as each completes)
      const failures: NetworkFailure[] = []
      let completedCount = 0

      function replaceEventsForPlanning(fullId: string, newEvents: Events) {
        // Remove old events for this planningId and add new ones
        const otherEvents = events.value.filter(e => e.fullId !== fullId)
        const newEventsWithFullId = newEvents.map(e => ({ ...e, fullId }))
        events.value = [...otherEvents, ...newEventsWithFullId]
      }

      function handleNetworkResult(fullId: string, res: Awaited<ReturnType<ReturnType<typeof client.api.plannings>['get']>> | null, err?: unknown) {
        if (token !== requestToken) return

        if (err || !res) {
          failures.push({
            fullId,
            title: titlesMap[fullId] || fullId,
            timestamp: dbTimestamps[fullId] ?? null,
          })
          networkFailures.value = [...failures]
        } else {
          const { success, title, timestamp } = processResponse(fullId, { status: 'fulfilled', value: res })

          if (title) {
            titlesMap[fullId] = title
            titles.value = { ...titlesMap }
          }

          if (success) {
            const isFromNetwork = 'source' in success && success.source === 'network'
            if (isFromNetwork) {
              // Directly replace events for this planning
              replaceEventsForPlanning(fullId, success.events || [])
            } else {
              failures.push({
                fullId,
                title: title || fullId,
                timestamp,
              })
              networkFailures.value = [...failures]
            }
          } else {
            failures.push({
              fullId,
              title: title || fullId,
              timestamp: dbTimestamps[fullId] ?? null,
            })
            networkFailures.value = [...failures]
          }
        }

        completedCount++
        if (completedCount === fullIds.length) {
          if (token !== requestToken) return
          refreshing.value = false

          if (dbErrors.length === fullIds.length && failures.length === fullIds.length) {
            error.value = `All plannings failed to load. Details: ${dbErrors.join(' | ')}`
          } else {
            error.value = null
          }
        }
      }

      // Fire all network requests in parallel
      for (const fullId of fullIds) {
        client.api.plannings({ fullId }).get({
          query: {
            events: 'true',
            ...settings.queryParams.value,
          },
        }).then(res => handleNetworkResult(fullId, res)).catch(err => handleNetworkResult(fullId, null, err))
      }
    } catch (e: unknown) {
      if (token !== requestToken) return
      error.value = e instanceof Error ? e.message : String(e)
      titles.value = {}
      events.value = []
      refreshing.value = false
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
    refreshing,
    error,
    networkFailures,
    refresh,
  }
}

export function usePlanningData(): PlanningDataStore {
  if (_instance) return _instance
  _instance = createPlanningDataStore()
  return _instance
}
