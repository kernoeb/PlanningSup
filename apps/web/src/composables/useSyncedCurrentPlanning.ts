/**
 * Synced Planning Selection Composable
 *
 * This wraps the local-storage based multi-planning selection (useCurrentPlanning)
 * and synchronizes it with the authenticated user's server-side preferences using
 * the generic syncPref mechanism (Last-Write-Wins via timestamp metadata).
 *
 * Server field key: "plannings"
 * Type: string[]
 *
 * Sync semantics:
 * - On login: compare client vs server timestamps (handled by syncPref).
 *   If server newer -> adopt server list locally.
 *   If local newer (or equal but different) -> push local list.
 * - Local mutations are debounced and only pushed if a semantic diff exists.
 *
 * Normalization rules (mirrors backend validator logic):
 * - Trim each id
 * - Remove empties
 * - Deduplicate (Set order preservation for first occurrence)
 * - Max length: 100 entries
 * - Each entry max length: 255 chars (excess trimmed out by backend anyway)
 *
 * This keeps a clean separation: core selection logic stays in useCurrentPlanning(),
 * while this layer adds optional remote sync when a user is authenticated.
 */

import { createSharedComposable } from '@vueuse/core'
import { useCurrentPlanning } from './useCurrentPlanning'
import { useUserPrefsSync } from './useUserPrefsSync'

/**
 * Normalize a list of planning fullIds according to shared client/server rules.
 */
function normalizePlannings(ids: readonly string[] | null | undefined): string[] {
  if (!ids) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (trimmed.length > 255) continue // Hard skip overly long tokens
    if (!seen.has(trimmed)) {
      seen.add(trimmed)
      out.push(trimmed)
      if (out.length >= 100) break
    }
  }
  return out
}

export interface SyncedCurrentPlanning {
  planningFullIds: ReturnType<typeof useCurrentPlanning>['planningFullIds']
  setPlanningFullIds: ReturnType<typeof useCurrentPlanning>['setPlanningFullIds']
  addPlanning: ReturnType<typeof useCurrentPlanning>['addPlanning']
  removePlanning: ReturnType<typeof useCurrentPlanning>['removePlanning']
  togglePlanning: ReturnType<typeof useCurrentPlanning>['togglePlanning']
  resetPlanningSelection: ReturnType<typeof useCurrentPlanning>['resetPlanningSelection']
  isSelected: ReturnType<typeof useCurrentPlanning>['isSelected']
}

/**
 * Main factory: equips the local planning selection with remote sync.
 */
export function useSyncedCurrentPlanning(): SyncedCurrentPlanning {
  const {
    planningFullIds,
    setPlanningFullIds,
    addPlanning,
    removePlanning,
    togglePlanning,
    resetPlanningSelection,
    isSelected,
  } = useCurrentPlanning()

  const { syncPref } = useUserPrefsSync()

  // Register synchronization for 'plannings'
  syncPref('plannings', planningFullIds, {
    toServer: v => normalizePlannings(v),
    normalizeLocal: v => normalizePlannings(v),
    normalizeServer: raw => (Array.isArray(raw) ? normalizePlannings(raw as string[]) : []),
    fromServerToLocal: (raw) => {
      if (!Array.isArray(raw)) return null
      return normalizePlannings(raw as string[])
    },
    setLocal: v => setPlanningFullIds(normalizePlannings(v)),
    debounce: 250,
  })

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

/**
 * Shared (singleton) variant if multiple components need the synced selection.
 */
export const useSharedSyncedCurrentPlanning = createSharedComposable(useSyncedCurrentPlanning)
