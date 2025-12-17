import { beforeAll, beforeEach, afterAll, describe, expect, it, mock } from 'bun:test'
import { ref } from 'vue'

/**
 * This test asserts that user preferences synchronization becomes a no-op
 * when auth is disabled via runtime config. In that case:
 * - The sync registration should short-circuit immediately.
 * - It must not call authClient.useSession (no session observation).
 * - It must not call authClient.updateUser (no network sync).
 */

describe('useUserPrefsSync (authEnabled=false via runtime config) no-op behavior', () => {
  let useUserPrefsSync: any

  const counters = {
    useSession: 0,
    updateUser: 0,
  }

  const originalWarn = console.warn
  const warnings: string[] = []

  beforeAll(async () => {
    // Force disabled auth via runtime config
    (globalThis as any).__APP_CONFIG__ = { authEnabled: false }

    // Mock @libs to track any accidental calls to auth client
    mock.module('@libs/auth', () => {
      return {
        authClient: {
          useSession: () => {
            counters.useSession += 1
            // Return a minimal session ref-like value (should never be used in this mode)
            return ref({ isPending: false, data: null, error: null })
          },
          updateUser: async (_payload: unknown) => {
            counters.updateUser += 1
            return { ok: true }
          },
        },
      }
    })

    // Capture warnings (optional; useful to verify no-op notices if any)
    // eslint-disable-next-line no-console
    console.warn = (...args: any[]) => {
      try {
        warnings.push(args.map(String).join(' '))
      } catch {
        warnings.push('warn:unserializable')
      }
      return undefined as unknown as void
    }

    // Import after env + mocks are set
    const mod = await import('@web/composables/useUserPrefsSync')
    useUserPrefsSync = mod.useUserPrefsSync
  })

  afterAll(() => {
    // Restore console
    // eslint-disable-next-line no-console
    console.warn = originalWarn

    mock.restore()
    delete (globalThis as any).__APP_CONFIG__
  })

  beforeEach(() => {
    counters.useSession = 0
    counters.updateUser = 0
    warnings.length = 0
    // Clear any persisted localStorage metadata between tests
    try {
      localStorage.clear()
    } catch {}
  })

  it('registering syncPref returns early and does not call auth client', async () => {
    const { syncPref } = useUserPrefsSync()

    // A simple local ref to be "synced"
    const highlightTeacher = ref<boolean>(false)

    // Register synchronization; when auth is disabled, this is a no-op
    syncPref('highlightTeacher', highlightTeacher, {
      toServer: (v: boolean) => v,
      normalizeLocal: (v: boolean) => v,
      normalizeServer: (raw: unknown) => raw,
      fromServerToLocal: (raw: unknown) => (typeof raw === 'boolean' ? raw : null),
      setLocal: (v: boolean) => (highlightTeacher.value = v),
      debounce: 50,
    })

    // Mutate local value; in enabled mode, this would debounce-update the server.
    highlightTeacher.value = true

    // Wait beyond debounce; still must not trigger any calls
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(counters.useSession).toBe(0)
    expect(counters.updateUser).toBe(0)
  })

  it('subsequent local changes still do not trigger server calls', async () => {
    const { syncPref } = useUserPrefsSync()
    const showWeekends = ref<boolean>(false)

    syncPref('showWeekends', showWeekends, {
      toServer: (v: boolean) => v,
      normalizeLocal: (v: boolean) => v,
      normalizeServer: (raw: unknown) => raw,
      fromServerToLocal: (raw: unknown) => (typeof raw === 'boolean' ? raw : null),
      setLocal: (v: boolean) => (showWeekends.value = v),
      debounce: 30,
    })

    showWeekends.value = true
    await new Promise(resolve => setTimeout(resolve, 50))

    showWeekends.value = false
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(counters.useSession).toBe(0)
    expect(counters.updateUser).toBe(0)
  })
})
