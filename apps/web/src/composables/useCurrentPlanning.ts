import type { Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

/**
 * Default planning fullId used when nothing is stored yet.
 * Keep this in sync with the default used by components depending on the planning selection.
 */
export const DEFAULT_PLANNING_FULL_ID = 'iut-de-vannes.butdutinfo.1ereannee.gr1a.gr1a1'
export const DEFAULT_PLANNING_FULL_IDS = [DEFAULT_PLANNING_FULL_ID]

/**
 * Storage key used to persist the current planning selection.
 * Storage key value: 'plannings'
 */
export const CURRENT_PLANNINGS_STORAGE_KEY = 'plannings'

function normalizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map(s => s.trim()).filter(Boolean)))
}

/**
 * useCurrentPlanning (multi-selection)
 *
 * Persists and exposes the current planning selection using localStorage.
 * - Reads/writes from localStorage under the key 'plannings'
 * - Exposes helper methods for toggling and resetting the selection
 *
 * Backward compatibility:
 * - If the stored value is a string (legacy), it will be migrated to [string].
 */
export function useCurrentPlanning(): {
  planningFullIds: Ref<string[]>
  setPlanningFullIds: (ids: string[]) => void
  addPlanning: (id: string) => void
  removePlanning: (id: string) => void
  togglePlanning: (id: string) => void
  resetPlanningSelection: () => void
  isSelected: (id: string) => boolean
} {
  // Use any here to allow migration from a legacy string value
  const raw = useLocalStorage<any>(
    CURRENT_PLANNINGS_STORAGE_KEY,
    DEFAULT_PLANNING_FULL_IDS,
    { writeDefaults: true },
  )

  const planningFullIds = computed<string[]>({
    get() {
      const v = raw.value
      if (Array.isArray(v)) return normalizeIds(v)
      // fallback
      raw.value = DEFAULT_PLANNING_FULL_IDS
      return DEFAULT_PLANNING_FULL_IDS
    },
    set(ids: string[]) {
      raw.value = normalizeIds(ids)
    },
  })

  function setPlanningFullIds(ids: string[]) {
    planningFullIds.value = ids
  }

  function addPlanning(id: string) {
    const norm = id?.trim()
    if (!norm) return
    if (!planningFullIds.value.includes(norm)) {
      planningFullIds.value = [...planningFullIds.value, norm]
    }
  }

  function removePlanning(id: string) {
    const norm = id?.trim()
    if (!norm) return
    planningFullIds.value = planningFullIds.value.filter(x => x !== norm)
  }

  function togglePlanning(id: string) {
    const norm = id?.trim()
    if (!norm) return
    if (planningFullIds.value.includes(norm)) {
      removePlanning(norm)
    } else {
      addPlanning(norm)
    }
  }

  function resetPlanningSelection() {
    planningFullIds.value = DEFAULT_PLANNING_FULL_IDS
  }

  function isSelected(id: string) {
    return planningFullIds.value.includes(id)
  }

  return {
    planningFullIds,
    setPlanningFullIds,
    addPlanning,
    removePlanning,
    togglePlanning,
    resetPlanningSelection,
    isSelected,
  }
}
