import type { Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

/**
 * Default planning fullId used when nothing is stored yet.
 * Keep this in sync with the default used by PlanningCalendar.
 */
export const DEFAULT_PLANNING_FULL_ID = 'iut-de-vannes.butdutinfo.1ereannee.gr1a.gr1a1'

/**
 * Storage key used to persist the current planning fullId.
 * Requested key: 'p'
 */
export const CURRENT_PLANNING_STORAGE_KEY = 'planning'

/**
 * useCurrentPlanning
 *
 * Persists and exposes the current planning `fullId` using localStorage.
 * - Reads/writes from localStorage under the key 'p'
 * - Returns a Ref<string> that you can pass directly to other composables/components
 *
 * Example:
 * const { fullId, setCurrentPlanning } = useCurrentPlanning()
 * setCurrentPlanning('iut-de-vannes.butdutinfo.1ereannee.gr1a.gr1a2')
 */
export function useCurrentPlanning(): {
  fullId: Ref<string>
  setCurrentPlanning: (id: string) => void
  resetCurrentPlanning: () => void
  isCurrent: (id: string) => boolean
} {
  const fullId = useLocalStorage<string>(
    CURRENT_PLANNING_STORAGE_KEY,
    DEFAULT_PLANNING_FULL_ID,
    { writeDefaults: true },
  )

  function setCurrentPlanning(id: string) {
    // Basic guard to avoid storing empty values
    if (typeof id === 'string' && id.trim().length > 0) {
      fullId.value = id.trim()
    }
  }

  function resetCurrentPlanning() {
    fullId.value = DEFAULT_PLANNING_FULL_ID
  }

  function isCurrent(id: string) {
    return fullId.value === id
  }

  return {
    fullId,
    setCurrentPlanning,
    resetCurrentPlanning,
    isCurrent,
  }
}
