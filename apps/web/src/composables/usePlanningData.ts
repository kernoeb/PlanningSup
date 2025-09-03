import type { Ref } from 'vue'
import { client } from '@libs'
import { ref, watch } from 'vue'
import { useCurrentPlanning } from './useCurrentPlanning'

export interface ApiEvent {
  uid: string
  summary: string
  startDate: unknown
  endDate: unknown
  categoryId: string
}

export interface PlanningDataStore {
  fullId: Ref<string>
  title: Ref<string>
  events: Ref<ApiEvent[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
}

/**
 * Singleton store for planning data (title + events) bound to the current planning fullId.
 *
 * - Uses a single API call /api/plannings/:fullId?events=true
 * - No caching layer
 * - Automatically refetches when the current planning fullId changes
 */
let _instance: PlanningDataStore | null = null

function createPlanningDataStore(): PlanningDataStore {
  const { fullId } = useCurrentPlanning()

  const title = ref<string>('')
  const events = ref<ApiEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Prevent race conditions when fullId changes quickly
  let requestToken = 0

  async function refresh() {
    const id = fullId.value?.trim()
    if (!id) {
      title.value = ''
      events.value = []
      error.value = null
      return
    }

    loading.value = true
    error.value = null
    const token = ++requestToken

    try {
      const { data } = await client.api.plannings({ fullId: id }).get({
        query: { events: 'true' },
      })

      if (!data) throw new Error('No data received from server')

      // Ignore outdated responses
      if (token !== requestToken) return

      title.value = data.title
      events.value = 'events' in data && Array.isArray(data.events) ? data.events : []
    } catch (e) {
      if (token !== requestToken) return
      error.value = e instanceof Error ? e.message : String(e)
      title.value = id
      events.value = []
    } finally {
      if (token === requestToken) loading.value = false
    }
  }

  // Auto-load and reload on planning changes
  watch(fullId, () => refresh(), { immediate: true })

  return {
    fullId,
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
