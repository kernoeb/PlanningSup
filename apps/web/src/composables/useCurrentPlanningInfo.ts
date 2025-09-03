import type { Ref } from 'vue'
import { onMounted, ref, watch } from 'vue'
import { client } from '@libs'
import { useCurrentPlanning } from './useCurrentPlanning'

/**
 * Small in-memory cache to avoid refetching titles for the same planning.
 */
const titleCache = new Map<string, string>()

/**
 * useCurrentPlanningInfo
 *
 * Fetches and exposes the current planning info (specifically the title) based on the `fullId`
 * persisted by `useCurrentPlanning`.
 *
 * Returns a reactive `title` along with `loading`, `error`, and a `refresh()` function.
 * If the title can't be fetched, it falls back to the `fullId`.
 */
export function useCurrentPlanningInfo(): {
  fullId: Ref<string>
  title: Ref<string>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
} {
  const { fullId } = useCurrentPlanning()

  const title = ref<string>('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Guard against race conditions if fullId changes quickly
  let lastRequestToken = 0

  async function refresh() {
    const id = fullId.value?.trim()
    if (!id) {
      title.value = ''
      error.value = null
      return
    }

    // Use cache if available
    const cached = titleCache.get(id)
    if (cached) {
      title.value = cached
      error.value = null
      return
    }

    loading.value = true
    error.value = null
    const requestToken = ++lastRequestToken

    try {
      // GET /api/plannings/:fullId -> { id, fullId, title }
      const { data } = await client.api.plannings({ fullId: id }).get()

      // Ignore outdated responses
      if (requestToken !== lastRequestToken) return

      const fetchedTitle =
        data && typeof data === 'object' && data !== null && 'title' in data
          ? String((data as any).title ?? '')
          : ''

      // Fallback to fullId if no title is available
      const resolved = fetchedTitle.length > 0 ? fetchedTitle : id
      title.value = resolved

      // Only cache non-empty titles
      if (fetchedTitle.length > 0) {
        titleCache.set(id, fetchedTitle)
      }
    } catch (e) {
      if (requestToken !== lastRequestToken) return
      error.value = e instanceof Error ? e.message : String(e)
      title.value = id
    } finally {
      if (requestToken === lastRequestToken) {
        loading.value = false
      }
    }
  }

  // Load on mount and whenever the current fullId changes
  onMounted(() => {
    void refresh()
  })
  watch(fullId, () => {
    void refresh()
  })

  return {
    fullId,
    title,
    loading,
    error,
    refresh,
  }
}
