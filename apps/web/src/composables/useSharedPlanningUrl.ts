/**
 * Composable to handle shared planning selection from URL
 *
 * On page load, if the URL contains a `p` query parameter, it will be parsed
 * and used to set the planning selection. The `p` parameter contains a
 * comma-separated list of planning IDs.
 *
 * Example URL: https://planningsup.app/?p=istic/l1,istic/l2
 */

import { createGlobalState } from '@vueuse/core'
import { ref } from 'vue'
import { useCurrentPlanning } from './useCurrentPlanning'

/**
 * Query parameter key for shared plannings
 */
export const SHARE_QUERY_PARAM = 'p'

/**
 * Global state to track how many plannings were loaded from URL
 * This is used by the toast component to show a notification
 */
export const useSharedPlanningState = createGlobalState(() => {
  const loadedFromUrlCount = ref(0)

  function setLoadedCount(count: number) {
    loadedFromUrlCount.value = count
  }

  function clearLoadedCount() {
    loadedFromUrlCount.value = 0
  }

  return {
    loadedFromUrlCount,
    setLoadedCount,
    clearLoadedCount,
  }
})

/**
 * Parses planning IDs from a URL parameter value
 */
function parsePlanningIdsFromParam(param: string | null): string[] {
  if (!param) return []
  return param
    .split(',')
    .map(id => decodeURIComponent(id.trim()))
    .filter(Boolean)
}

/**
 * Initializes planning selection from URL query parameter if present.
 * Should be called once at app startup.
 *
 * If the `p` query param is present in the URL:
 * - Parses the comma-separated planning IDs
 * - Sets them as the current planning selection
 * - Removes the query param from the URL (clean URL after loading)
 * - Sets loadedFromUrlCount to trigger toast notification
 */
export function useSharedPlanningUrl(): void {
  const { setPlanningFullIds } = useCurrentPlanning()
  const { setLoadedCount } = useSharedPlanningState()

  // Only run in browser
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const sharedParam = url.searchParams.get(SHARE_QUERY_PARAM)

  if (sharedParam) {
    const ids = parsePlanningIdsFromParam(sharedParam)
    if (ids.length > 0) {
      setPlanningFullIds(ids)
      setLoadedCount(ids.length)
    }

    // Clean up the URL by removing the share parameter
    url.searchParams.delete(SHARE_QUERY_PARAM)
    window.history.replaceState({}, '', url.toString())
  }
}
