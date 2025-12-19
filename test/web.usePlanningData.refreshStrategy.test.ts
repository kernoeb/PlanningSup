import { describe, expect, it, mock } from 'bun:test'
import { ref } from 'vue'

describe('usePlanningData refresh strategy', () => {
  it('hydrates from DB once, then uses network-first on subsequent refreshes', async () => {
    try {
      const calls: Array<{ fullId: string, query: Record<string, any> }> = []
      const planningFullIds = ref<string[]>(['A'])
      const queryParams = ref<Record<string, any>>({})

    mock.module('@vueuse/core', () => {
      return {
        createSharedComposable: (fn: any) => fn,
        useIntervalFn: () => ({ pause: () => {}, resume: () => {} }),
        useLocalStorage: (_key: string, initialValue: any) => ref(initialValue),
        useOnline: () => ref(true),
        useWindowFocus: () => ref(false),
      }
    })

    mock.module('@web/composables/useSettings', () => {
      return {
        useSharedSettings: () => ({ queryParams }),
      }
    })

    mock.module('@web/composables/useSyncedCurrentPlanning', () => {
      return {
        useSharedSyncedCurrentPlanning: () => ({ planningFullIds }),
      }
    })

    mock.module('@libs', () => {
      return {
        authClient: {
          signIn: {
            social: async () => ({ ok: true }),
          },
          signOut: async () => {},
          updateUser: async () => ({ ok: true }),
          useSession: () => ref({ isPending: false, data: null, error: null }),
        },
        client: {
          api: {
            plannings: ({ fullId }: { fullId: string }) => ({
              get: async ({ query }: { query: Record<string, any> }) => {
                calls.push({ fullId, query })
                if (query.onlyDb === 'true') {
                  return {
                    data: {
                      fullId,
                      title: `Planning ${fullId}`,
                      events: [{ id: 'e-db', startsAt: 1, endsAt: 2 }],
                      source: 'db',
                      refreshedAt: 1,
                    },
                  }
                }
                return {
                  data: {
                    fullId,
                    title: `Planning ${fullId}`,
                    events: [{ id: 'e-net', startsAt: 3, endsAt: 4 }],
                    source: 'network',
                    refreshedAt: 2,
                  },
                }
              },
            }),
          },
        },
      }
    })

    const { usePlanningData } = await import('@web/composables/usePlanningData')
    const store = usePlanningData()

    async function waitUntilIdle(timeoutMs = 500) {
      const start = Date.now()
      while (store.syncing.value) {
        if (Date.now() - start > timeoutMs)
          throw new Error('timed out waiting for usePlanningData to become idle')
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }

    // Let initial auto-refresh complete (watch({ immediate: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
    await waitUntilIdle()

    expect(calls.some(c => c.query.onlyDb === 'true')).toBe(true)
    expect(calls.some(c => c.query.onlyDb !== 'true')).toBe(true)

    // Subsequent refresh should be network-first (no DB-only hydration) for already hydrated ids.
    calls.length = 0
    await store.refresh()
    await waitUntilIdle()

    expect(calls.some(c => c.query.onlyDb === 'true')).toBe(false)
    expect(calls.filter(c => c.query.onlyDb !== 'true').length).toBe(1)

    // Adding a new planning should still hydrate only that one from DB once.
    calls.length = 0
    planningFullIds.value = ['A', 'B']
    await new Promise(resolve => setTimeout(resolve, 0))
    await waitUntilIdle()

      const dbOnlyCalls = calls.filter(c => c.query.onlyDb === 'true').map(c => c.fullId)
      expect(dbOnlyCalls).toEqual(['B'])
    } finally {
      mock.restore()
    }
  })
})
