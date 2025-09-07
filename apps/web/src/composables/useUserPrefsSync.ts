import type { WatchSource } from 'vue'
import { authClient } from '@libs'
import { watchDebounced } from '@vueuse/core'
import { computed, ref, toValue, watch } from 'vue'

export type PrefKey = 'theme' | 'highlightTeacher' | 'showWeekends' | 'blocklist' | 'colors'

export interface SyncOptions<T> {
  // Transform local value to the server payload format
  toServer?: (v: T) => unknown
  // Normalize values for comparison to avoid false diffs
  normalizeLocal?: (v: T) => unknown
  normalizeServer?: (raw: unknown) => unknown
  // Convert raw server value to local value type when adopting server -> local
  fromServerToLocal?: (raw: unknown) => T | null
  // Debounce time for PUTs (ms)
  debounce?: number

  // Adoption policy on session ready:
  // - If true and device is "fresh" (no local key), adopt server -> local
  // - Otherwise, local-first (push local -> server if different)
  preferServerOnLoad?: boolean
  // The localStorage key used by this setting (to detect "fresh device")
  localStorageKey?: string

  // Custom detector for local "default" state; if true, treat as fresh device
  isLocalDefault?: (v: T) => boolean

  // Setter to apply local changes (used when adopting server -> local)
  // If not provided, we attempt to set `(source as any).value = v`
  setLocal?: (v: T) => void
}

function jsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return a === b
  }
}

/**
 * Shared local-first user preferences sync.
 *
 * Behavior:
 * - Reads server value from session (GET) via authClient.useSession()
 * - On session ready:
 *   - If preferServerOnLoad and device is "fresh", adopt server -> local once
 *   - Else compare local vs server and PUT local -> server only if different
 * - Debounced watcher PUTs only when value changes and differs from the last synced value
 *
 * Notes:
 * - Server value is read from session.value.data?.user[key] first, then falls back to user.additionalFields?.[key]
 * - "Fresh device" detection uses presence of localStorageKey or a custom isLocalDefault predicate
 * - lastSynced caches the last successful server payload to avoid redundant PUTs
 */
const LOCAL_META_KEY = 'settings.prefsMeta'

const STAMP_SENTINEL = '__STAMP__'

type PrefsMeta = Partial<Record<PrefKey, number>>

function readLocalMeta(): PrefsMeta {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LOCAL_META_KEY)
    return raw ? (JSON.parse(raw) as PrefsMeta) : {}
  } catch {
    return {}
  }
}

function writeLocalMeta(meta: PrefsMeta) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_META_KEY, JSON.stringify(meta))
  } catch {}
}

const registeredKeys = new Set<PrefKey>()
export function useUserPrefsSync() {
  function syncPref<T>(key: PrefKey, source: WatchSource<T>, options: SyncOptions<T> = {}) {
    if (registeredKeys.has(key)) {
      console.debug(`syncPref[${key}] watcher already registered, skipping duplicate`)
      return
    }
    registeredKeys.add(key)

    const session = authClient.useSession()
    const userId = computed(() => session.value.data?.user?.id ?? null)
    // allow syncing for anonymous users; require only userId

    const toServer = options.toServer ?? ((v: T) => v)
    const normalizeLocal = options.normalizeLocal ?? ((v: T) => v)
    const normalizeServer = options.normalizeServer ?? ((raw: unknown) => raw)
    const fromServerToLocal = options.fromServerToLocal ?? ((raw: unknown) => raw as T)

    const debounce = options.debounce ?? 600
    const setLocal = options.setLocal

    // Cache of last successfully synced server payload value
    const lastSynced = ref<unknown>(null)

    // Read current server value from the session snapshot
    const getServerRaw = () => {
      const user = session.value.data?.user as any
      if (!user) return undefined
      // Prefer flattened field (user[key]) if present, else additionalFields
      if (Object.prototype.hasOwnProperty.call(user, key)) return user[key]
      return user.additionalFields?.[key]
    }
    // Read server-side metadata (per-key timestamps) from session
    const getServerMetaRaw = () => {
      const user = session.value.data?.user as any
      if (!user) return undefined
      if (Object.prototype.hasOwnProperty.call(user, 'prefsMeta')) return user.prefsMeta
      return user.additionalFields?.prefsMeta
    }
    const readServerMeta = (): PrefsMeta => {
      const raw = getServerMetaRaw()
      if (typeof raw !== 'string') return {}
      try {
        return JSON.parse(raw as string) as PrefsMeta
      } catch {
        return {}
      }
    }

    const buildStampedPrefsMeta = (stampKey: PrefKey): string => {
      const serverMeta = readServerMeta()
      const merged: Record<string, unknown> = { ...serverMeta, [stampKey]: STAMP_SENTINEL }
      return JSON.stringify(merged)
    }

    // React to user change or session readiness
    watch(
      () => userId.value,
      async () => {
        if (!userId.value) {
          // Reset cache when logged out to ensure proper sync after login
          lastSynced.value = null
          return
        }

        const localVal = toValue(source) as T
        const localNorm = normalizeLocal(localVal)
        const serverRaw = getServerRaw()
        const serverNorm = normalizeServer(serverRaw)

        // LWW (last-write-wins) using per-key timestamps
        const localMeta = readLocalMeta()
        const serverMeta = readServerMeta()
        const localTs = (localMeta[key] ?? 0) as number
        const serverTs = (serverMeta[key] ?? 0) as number

        // If server is newer, adopt server -> local
        if (serverTs > localTs && serverRaw != null) {
          const converted = fromServerToLocal(serverRaw)
          if (converted != null) {
            if (typeof setLocal === 'function') {
              setLocal(converted)
            } else {
              try {
                ;(source as any).value = converted
              } catch {
                // If source is not directly writable, ignore
              }
            }
            // Align local meta with server timestamp
            localMeta[key] = serverTs
            writeLocalMeta(localMeta)
            lastSynced.value = toServer(converted)
            return
          }
          // If conversion fails, fall through and prefer local with a new timestamp
        }

        // If local is newer than server, push local -> server (with meta)
        if (localTs > serverTs) {
          if (!jsonEqual(localNorm, serverNorm)) {
            try {
              const payload = {
                [key]: toServer(localVal),
                prefsMeta: buildStampedPrefsMeta(key),
              } as Record<string, unknown>
              console.debug(`syncPref[${key}] PUT (local newer)`, payload)
              await authClient.updateUser(payload)
              lastSynced.value = payload[key]
            } catch (err) {
              console.error(`Failed to update user ${key}:`, err)
            }
          } else {
            // Values already match; no timestamp change needed on client
            // Server remains the authority for prefsMeta
            lastSynced.value = toServer(localVal)
          }
          return
        }

        // Timestamps equal (or missing) -> resolve by content; if different, push local with fresh ts
        if (!jsonEqual(localNorm, serverNorm)) {
          try {
            const payload = {
              [key]: toServer(localVal),
              prefsMeta: buildStampedPrefsMeta(key),
            } as Record<string, unknown>
            console.debug(`syncPref[${key}] PUT (tie -> local wins)`, payload)
            await authClient.updateUser(payload)
            lastSynced.value = payload[key]
          } catch (err) {
            console.error(`Failed to update user ${key}:`, err)
          }
        } else {
          // Already in sync; align local meta if server has a timestamp
          if (serverTs && !localTs) {
            localMeta[key] = serverTs
            writeLocalMeta(localMeta)
          }
          lastSynced.value = toServer(localVal)
        }
      },
      { immediate: true },
    )

    // Debounced PUT when local value changes, if different from last synced
    watchDebounced(
      source,
      async (newVal) => {
        const payloadValue = toServer(newVal as T)

        console.log(`syncPref[${key}] detected local change:`, newVal, '->', payloadValue)

        // Avoid redundant writes
        if (jsonEqual(payloadValue, lastSynced.value)) return

        // Server will authoritatively stamp prefsMeta

        // If not authenticated, cache the intent and return
        if (!userId.value) {
          lastSynced.value = payloadValue
          return
        }

        try {
          const payload = {
            [key]: payloadValue,
            prefsMeta: buildStampedPrefsMeta(key),
          } as Record<string, unknown>
          console.debug(`syncPref[${key}] PUT debounced`, payload)
          await authClient.updateUser(payload)
          lastSynced.value = payloadValue
        } catch (err) {
          console.error(`Failed to update user ${key}:`, err)
        }
      },
      { debounce, deep: true },
    )
  }

  return {
    syncPref,
  }
}
