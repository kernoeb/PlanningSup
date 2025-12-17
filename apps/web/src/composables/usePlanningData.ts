import type { Events, PlanningWithEvents } from '@libs'
import type { Ref } from 'vue'
import { client } from '@libs'
import { useIntervalFn, useOnline, useWindowFocus } from '@vueuse/core'
import { mergeSortedPlanningEventsDeterministically, sortPlanningEventsDeterministically } from '@web/utils/sort-planning-events'
import { computed, ref, watch } from 'vue'
import { useSharedSettings } from './useSettings'
import { useSharedSyncedCurrentPlanning } from './useSyncedCurrentPlanning'

export type EventWithFullId = Events[number] & { fullId: string }

export type FailureReason = 'network_error' | 'no_data' | 'empty_schedule'

export interface NetworkFailure {
  fullId: string
  title: string
  refreshedAt: number | null
  reason: FailureReason | null
}

export interface PlanningDataStore {
  planningFullIds: Ref<string[]>
  titles: Ref<Record<string, string>>
  events: Ref<EventWithFullId[]>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  syncing: Ref<boolean>
  hasEvents: Ref<boolean>
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
  const eventsByFullId = ref<Record<string, EventWithFullId[]>>({})
  const events = computed(() => {
    const fullIds = planningFullIds.value ?? []
    return mergeSortedPlanningEventsDeterministically(eventsByFullId.value, fullIds)
  })
  const loading = ref(false)
  const refreshing = ref(false)
  const syncing = computed(() => loading.value || refreshing.value)
  const hasEvents = computed(() => (events.value?.length ?? 0) > 0)
  const error = ref<string | null>(null)
  const networkFailures = ref<NetworkFailure[]>([])

  const debugEnabled = computed(() => {
    if (!import.meta.env.DEV) return false
    try {
      return localStorage.getItem('planning:debug') === '1'
    } catch {
      return false
    }
  })

  function debugLog(message: string, details?: Record<string, unknown>) {
    if (!debugEnabled.value) return
    console.debug(`[planning-data] ${message}`, details ?? {})
  }

  function debugOrderSnapshot(message: string, currentPlanningOrder: readonly string[]) {
    if (!debugEnabled.value) return

    const byId = eventsByFullId.value
    const counts = Object.fromEntries(currentPlanningOrder.map(id => [id, byId[id]?.length ?? 0]))

    const globalHead = events.value.slice(0, 30).map(e =>
      `${e.fullId}|${e.uid}|${String(e.startDate)}|${String(e.endDate)}`,
    )

    const head: string[] = []
    for (const id of currentPlanningOrder) {
      for (const e of byId[id] ?? []) {
        head.push(`${id}|${e.uid}|${String(e.startDate)}|${String(e.endDate)}`)
        if (head.length >= 20) break
      }
      if (head.length >= 20) break
    }

    debugLog(message, {
      planningOrder: [...currentPlanningOrder],
      counts,
      headByPlanning: head,
      headGlobal: globalHead,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    })
  }

  // Prevent race conditions when selection changes quickly
  let requestToken = 0
  // Track which plannings have already been hydrated into memory (DB or network).
  // For these, refreshes should be network-first to avoid UI jumping back to DB snapshots.
  const hydratedFullIds = new Set<string>()

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
  ): { success: PlanningWithEvents | null, title: string | null, error: string | null, refreshedAt: number | null, reason: FailureReason | null } {
    if (!res) {
      return { success: null, title: null, error: `${fullId}: missing response`, refreshedAt: null, reason: 'no_data' }
    }

    if (res.status === 'rejected') {
      const msg = res.reason instanceof Error ? res.reason.message : String(res.reason)
      return { success: null, title: null, error: `${fullId}: ${msg}`, refreshedAt: null, reason: 'network_error' }
    }

    const data = res.value?.data
    if (!data) {
      return { success: null, title: null, error: `${fullId}: invalid response`, refreshedAt: null, reason: 'no_data' }
    }

    const title = ('fullId' in data && 'title' in data && typeof data.fullId === 'string' && typeof data.title === 'string')
      ? data.title
      : null

    // Backward-compatible: keep accepting `timestamp` while the API migrates to `refreshedAt`.
    const refreshedAt = ('refreshedAt' in data && typeof data.refreshedAt === 'number')
      ? data.refreshedAt
      : ('timestamp' in data && typeof data.timestamp === 'number')
          ? data.timestamp
          : null
    const reason = ('reason' in data && typeof data.reason === 'string') ? data.reason as FailureReason : null

    if ('events' in data && data.events) {
      return { success: data as PlanningWithEvents, title, error: null, refreshedAt, reason }
    }

    if ('status' in data && data.status === 'error') {
      return { success: null, title, error: `${fullId}: no events available`, refreshedAt, reason: reason || 'no_data' }
    }

    return { success: null, title, error: `${fullId}: no events`, refreshedAt, reason: reason || 'no_data' }
  }

  function pruneToSelection(fullIds: string[]) {
    const set = new Set(fullIds)
    eventsByFullId.value = Object.fromEntries(Object.entries(eventsByFullId.value).filter(([id]) => set.has(id)))
    titles.value = Object.fromEntries(Object.entries(titles.value).filter(([id]) => set.has(id)))
  }

  async function refresh(_reason: string = 'manual') {
    const fullIds = [...planningFullIds.value]

    if (fullIds.length === 0) {
      titles.value = {}
      eventsByFullId.value = {}
      error.value = null
      networkFailures.value = []
      refreshing.value = false
      return
    }

    pruneToSelection(fullIds)
    debugOrderSnapshot(`refresh:start reason=${_reason}`, fullIds)

    lastRefreshAt.value = Date.now()
    const hasAnyDataInMemory = Object.keys(eventsByFullId.value).length > 0 || Object.keys(titles.value).length > 0
    const needsDbHydrationIds = fullIds.filter(id => !hydratedFullIds.has(id))
    const shouldHydrateFromDb = isOnline.value && needsDbHydrationIds.length > 0

    loading.value = !hasAnyDataInMemory && shouldHydrateFromDb
    refreshing.value = !loading.value
    error.value = null
    networkFailures.value = []
    const token = ++requestToken

    try {
      const dbSuccesses: Array<PlanningWithEvents> = []
      const dbErrors: string[] = []
      const titlesMap: Record<string, string> = { ...titles.value }
      const dbRefreshedAt: Record<string, number | null> = {}

      // Phase 1: Fast database-only fetch (parallel) - skip when offline
      if (shouldHydrateFromDb) {
        debugLog('db:fetch:start', { fullIds: needsDbHydrationIds })
        const dbResults = await Promise.allSettled(
          needsDbHydrationIds.map(fullId =>
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

        const nextEventsByFullId: Record<string, EventWithFullId[]> = { ...eventsByFullId.value }

        for (let i = 0; i < needsDbHydrationIds.length; i++) {
          const id = needsDbHydrationIds[i]!
          const { success, title, error: err, refreshedAt } = processResponse(id, dbResults[i])

          if (title) titlesMap[id] = title
          if (success) dbSuccesses.push(success)
          else if (err) dbErrors.push(err)
          dbRefreshedAt[id] = refreshedAt
        }

        // Update UI immediately with DB data for newly-added plannings only.
        titles.value = { ...titlesMap }

        for (const s of dbSuccesses) {
          const id = s.fullId
          const newEventsWithFullId = (s.events || []).map(e => ({ ...e, fullId: id }))
          nextEventsByFullId[id] = sortPlanningEventsDeterministically(newEventsWithFullId, [id])
          hydratedFullIds.add(id)
        }

        eventsByFullId.value = nextEventsByFullId
        debugOrderSnapshot('db:apply:done', fullIds)
      }

      // Mark loading as done after DB phase, start refreshing phase
      loading.value = false
      refreshing.value = true

      // Phase 2: Network fetch (parallel, update UI as each completes)
      const failures: NetworkFailure[] = []
      let completedCount = 0

      function replaceEventsForPlanning(fullId: string, newEvents: Events) {
        const newEventsWithFullId = newEvents.map(e => ({ ...e, fullId }))
        eventsByFullId.value = {
          ...eventsByFullId.value,
          [fullId]: sortPlanningEventsDeterministically(newEventsWithFullId, [fullId]),
        }
      }

      function handleNetworkResult(fullId: string, res: Awaited<ReturnType<ReturnType<typeof client.api.plannings>['get']>> | null, err?: unknown) {
        if (token !== requestToken) return

        if (err || !res) {
          failures.push({
            fullId,
            title: titlesMap[fullId] || fullId,
            refreshedAt: dbRefreshedAt[fullId] ?? null,
            reason: 'network_error',
          })
          networkFailures.value = [...failures]
        } else {
          const { success, title, refreshedAt, reason } = processResponse(fullId, { status: 'fulfilled', value: res })

          if (title) {
            titlesMap[fullId] = title
            titles.value = { ...titlesMap }
          }

          if (success) {
            const isFromNetwork = 'source' in success && success.source === 'network'
            if (isFromNetwork) {
              // Directly replace events for this planning
              replaceEventsForPlanning(fullId, success.events || [])
              hydratedFullIds.add(fullId)
              debugLog('net:apply:ok', { fullId, nbEvents: (success.events || []).length })
            } else {
              failures.push({
                fullId,
                title: title || fullId,
                refreshedAt,
                reason: reason || 'network_error',
              })
              networkFailures.value = [...failures]
            }
          } else {
            failures.push({
              fullId,
              title: title || fullId,
              refreshedAt: dbRefreshedAt[fullId] ?? null,
              reason: reason || 'no_data',
            })
            networkFailures.value = [...failures]
          }
        }

        completedCount++
        if (completedCount === fullIds.length) {
          if (token !== requestToken) return
          refreshing.value = false
          debugOrderSnapshot('net:all:done', fullIds)

          const allNetworkFailed = failures.length === fullIds.length
          const allDbFailed = shouldHydrateFromDb
            && needsDbHydrationIds.length === fullIds.length
            && dbErrors.length === fullIds.length
            && dbSuccesses.length === 0

          if ((allDbFailed && allNetworkFailed) || (!shouldHydrateFromDb && allNetworkFailed && events.value.length === 0)) {
            const failureDetails = failures.map(f => `${f.fullId}: ${f.reason || 'network_error'}`)
            const details = [...dbErrors, ...failureDetails].join(' | ')
            error.value = `All plannings failed to load. Details: ${details}`
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
      eventsByFullId.value = {}
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

  // @ts-expect-error - for debugging purposes
  globalThis.__refresh = refresh

  return {
    planningFullIds,
    titles,
    events,
    loading,
    refreshing,
    syncing,
    hasEvents,
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
