import type { Ref, WatchSource } from 'vue'
import { authClient } from '@libs'
import { createSharedComposable } from '@vueuse/core'
import { computed, isRef, ref, toValue, watch } from 'vue'

const AUTH_ENABLED = !!globalThis.__APP_CONFIG__?.authEnabled
const DEV = import.meta?.env?.DEV ?? false

export type PrefKey = 'theme' | 'highlightTeacher' | 'showWeekends' | 'blocklist' | 'colors' | 'plannings'

export interface SyncOptions<T> {
  // Transform local value to the server payload format.
  toServer?: (v: T) => unknown
  // Normalize local value for comparison to avoid false diffs.
  normalizeLocal?: (v: T) => unknown
  // Normalize raw server value for comparison.
  normalizeServer?: (raw: unknown) => unknown
  // Convert raw server value to local value type.
  fromServerToLocal?: (raw: unknown) => T | null
  // Setter to apply changes to the local source (e.g., when adopting server value).
  // Required if `source` is not a simple writable Ref.
  setLocal?: (v: T) => void
  // Debounce time in ms for pushing local changes to the server.
  debounce?: number
}

// Helper type to safely access preference data from the user object,
// which may have fields at the top level or nested in `additionalFields`.
type UserWithPrefsData = Record<string, unknown> & {
  additionalFields?: Record<string, unknown>
}

function jsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    // Fallback for non-serializable values
    return a === b
  }
}

// --- Local Storage Metadata Helpers ---
const META_STORAGE_KEY = 'userPrefsMeta'
const STAMP_SENTINEL = '__STAMP__'
type PrefsMeta = Partial<Record<PrefKey, number>>

function getLocalMeta(): PrefsMeta {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PrefsMeta) : {}
  } catch {
    return {}
  }
}

function setLocalMeta(meta: PrefsMeta) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta))
  } catch {}
}

const registeredKeys = new Set<PrefKey>()

/**
 * A simplified, local-first hook to sync user preferences with the server.
 *
 * Behavior:
 * - On login, it compares local and server timestamps (Last-Write-Wins).
 *   - If the server's value is newer, it's adopted locally.
 *   - Otherwise, the local value is pushed to the server if it differs.
 * - Local changes are debounced and pushed to the server.
 * - A server-side mechanism is expected to replace `__STAMP__` in `prefsMeta`
 *   with a server-authoritative timestamp.
 */
function userPrefsSync() {
  function syncPref<T>(key: PrefKey, source: WatchSource<T>, options: SyncOptions<T> = {}) {
    if (registeredKeys.has(key)) {
      console.warn(`syncPref for key "${key}" is already registered. Skipping.`)
      return
    }
    registeredKeys.add(key)

    if (!AUTH_ENABLED) {
      return
    }

    const {
      toServer = (v: T) => v,
      normalizeLocal = (v: T) => v,
      normalizeServer = (raw: unknown) => raw,
      fromServerToLocal = (raw: unknown) => raw as T,
      setLocal,
      debounce = 10,
    } = options

    const session = authClient.useSession()
    const userId = computed(() => session.value.data?.user?.id ?? null)
    const lastSynced = ref<unknown>(null)

    // --- Data Accessors ---

    const getServerValue = (): unknown => {
      const user = session.value.data?.user as UserWithPrefsData | undefined
      if (!user) return undefined
      return Object.prototype.hasOwnProperty.call(user, key) ? user[key] : user.additionalFields?.[key]
    }

    const getServerMeta = (): PrefsMeta => {
      const user = session.value.data?.user as UserWithPrefsData | undefined
      if (!user) return {}
      const rawMeta = Object.prototype.hasOwnProperty.call(user, 'prefsMeta')
        ? user.prefsMeta
        : user.additionalFields?.prefsMeta
      if (typeof rawMeta !== 'string') return {}
      try {
        return JSON.parse(rawMeta) as PrefsMeta
      } catch {
        return {}
      }
    }

    const setLocalValue = (value: T) => {
      if (setLocal) {
        setLocal(value)
      } else if (isRef(source)) {
        // Type assertion to bypass read-only check.
        // The `WatchSource` type includes read-only refs (like `ComputedRef`).
        // This fallback logic assumes a standard writable ref (`ref()`).
        // If the user passes a read-only ref without a custom `setLocal` function,
        // this assignment will fail at runtime, which is expected for this fallback mechanism.
        ;(source as Ref<T>).value = value
      } else {
        console.warn(
          `syncPref[${key}]: No 'setLocal' provided and source is not a writable Ref. Cannot apply server value.`,
        )
      }
    }

    // --- Core Sync Logic ---

    const pushToServer = async (value: T) => {
      if (!AUTH_ENABLED) return
      if (!userId.value) return // Safeguard against calls when logged out.

      const payloadValue = toServer(value)
      // Avoid redundant API calls if value hasn't changed from the last sync
      if (jsonEqual(payloadValue, lastSynced.value)) return

      try {
        const serverMeta = getServerMeta()
        const stampedMeta = JSON.stringify({ ...serverMeta, [key]: STAMP_SENTINEL })

        const payload: Record<string, unknown> = { [key]: payloadValue, prefsMeta: stampedMeta }

        if (DEV) console.debug(`syncPref[${key}] Pushing to server:`, payload)
        // Optimistically mark as synced to coalesce trailing updates during in-flight request
        lastSynced.value = payloadValue
        await authClient.updateUser(payload)
      } catch (err) {
        console.error(`syncPref[${key}] Failed to push update:`, err)
        // Roll back optimistic sync so the next change can retry
        lastSynced.value = null
      }
    }

    const onSessionReady = async () => {
      if (!userId.value) {
        lastSynced.value = null
        return
      }

      const localVal = toValue(source)
      const serverRaw = getServerValue()

      const localMeta = getLocalMeta()
      const serverMeta = getServerMeta()
      const localTs = localMeta[key] ?? 0
      const serverTs = serverMeta[key] ?? 0

      // Strategy 1: Server is newer. Adopt server value.
      if (serverTs > localTs && serverRaw !== undefined) {
        const serverVal = fromServerToLocal(serverRaw)
        if (serverVal !== null) {
          if (DEV) console.debug(`syncPref[${key}]: Adopting newer value from server.`)
          setLocalValue(serverVal)
          // Align local timestamp with the server's authoritative one
          setLocalMeta({ ...localMeta, [key]: serverTs })
          lastSynced.value = toServer(serverVal)
          return
        }
      }

      // Strategy 2: Local is newer or timestamps are tied. Push local value if different.
      const localNorm = normalizeLocal(localVal)
      const serverNorm = normalizeServer(serverRaw)

      if (!jsonEqual(localNorm, serverNorm)) {
        if (DEV) console.debug(`syncPref[${key}]: Local value differs or is newer. Pushing.`)
        await pushToServer(localVal)
      } else {
        // Already in sync. Just initialize lastSynced.
        if (DEV) console.debug(`syncPref[${key}]: Values are already in sync.`)
        lastSynced.value = toServer(localVal)
        // If server had a timestamp and local didn't, align them.
        if (serverTs > localTs) {
          setLocalMeta({ ...localMeta, [key]: serverTs })
        }
      }
    }

    // --- Watchers ---

    // 1. Handle initial sync when user session becomes available.
    watch(userId, onSessionReady, { immediate: true })

    // 2. Handle ongoing local changes.
    // Leading + trailing scheduler for local changes
    let leadingTriggered = false
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    watch(
      source,
      (newValue) => {
        if (!userId.value) return

        // If debounce <= 0, push immediately for every change
        if (debounce <= 0) {
          void pushToServer(newValue as T)
          return
        }

        // Leading call: push immediately on first change in a burst
        if (!leadingTriggered) {
          leadingTriggered = true
          void pushToServer(newValue as T)
        }

        // Trailing debounce: ensure final state is synced
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          leadingTriggered = false
          const latest = toValue(source) as T
          void pushToServer(latest)
        }, debounce)
      },
      { deep: true },
    )
  }

  return {
    syncPref,
  }
}

export const useUserPrefsSync = createSharedComposable(userPrefsSync)
