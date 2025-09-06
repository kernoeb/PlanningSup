import type { Ref } from 'vue'
import { client } from '@libs'
import { ref, watch } from 'vue'
import { useCurrentPlanning } from './useCurrentPlanning'
import { useSettings } from './useSettings'

export interface ApiEvent {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  categoryId: string
  sourceFullId?: string
}

export interface PlanningDataStore {
  planningFullIds: Ref<string[]>
  title: Ref<string>
  events: Ref<ApiEvent[]>
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
  const { planningFullIds } = useCurrentPlanning()
  const settings = useSettings()

  const title = ref<string>('')
  const events = ref<ApiEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Prevent race conditions when selection changes quickly
  let requestToken = 0

  async function refresh() {
    const ids = Array.from(new Set((planningFullIds.value ?? []).map(s => s.trim()).filter(Boolean)))

    if (ids.length === 0) {
      title.value = ''
      events.value = []
      error.value = null
      return
    }

    loading.value = true
    error.value = null
    const token = ++requestToken

    try {
      const results = await Promise.allSettled(
        ids.map(id =>
          client.api.plannings({ fullId: id }).get({
            query: {
              events: 'true',
              ...settings.queryParams.value,
            },
          }),
        ),
      )

      // Ignore outdated responses
      if (token !== requestToken) return

      const successes: Array<{ id: string, title: string, events: ApiEvent[] }> = []
      const errors: string[] = []

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!
        const res = results[i]
        if (!res) {
          errors.push(`${id}: missing response`)
          continue
        }

        if (res.status === 'fulfilled') {
          const data = res.value?.data
          const t = data?.title || id
          const rawEvents = (data && 'events' in data) ? data.events : null
          const evts: ApiEvent[] = Array.isArray(rawEvents)
            ? rawEvents.map(e => ({ ...e, sourceFullId: id } as ApiEvent))
            : []
          successes.push({ id, title: t, events: evts })
        } else {
          const msg = res.reason instanceof Error ? res.reason.message : String(res.reason)
          errors.push(`${id}: ${msg}`)
        }
      }

      // Titles
      if (successes.length === 0) {
        title.value = ids.join(' + ')
      } else if (successes.length === 1) {
        title.value = successes[0]!.title
      } else {
        title.value = successes.map(s => s.title).join(' + ')
      }

      // Events (concatenate)
      events.value = successes.length > 0 ? successes.flatMap(s => s.events) : []

      // Partial failures shouldn't wipe out data from successes; surface an error note
      error.value = errors.length > 0 ? `Some plannings failed to load (${errors.length}). Details: ${errors.join(' | ')}` : null
    } catch (e: unknown) {
      if (token !== requestToken) return
      error.value = e instanceof Error ? e.message : String(e)
      title.value = ids.join(' + ')
      events.value = []
    } finally {
      if (token === requestToken) loading.value = false
    }
  }

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
