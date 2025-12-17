import { describe, expect, it, mock } from 'bun:test'
import { ref } from 'vue'

describe('useUserPrefsSync', () => {
  it('keeps local changes made while logged out when server has older values', async () => {
    const realNow = Date.now
    Date.now = () => 100_000

    const store = new Map<string, string>()
    ;(globalThis as any).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
      },
    }
    ;(globalThis as any).__APP_CONFIG__ = { authEnabled: true }

    try {
      const updateCalls: any[] = []
      const sessionRef = ref<any>({ isPending: false, data: null, error: null })

      mock.module('@vueuse/core', () => {
        return {
          createSharedComposable: (fn: any) => fn,
        }
      })

      mock.module('@libs', () => {
        return {
          authClient: {
            useSession: () => sessionRef,
            updateUser: async (payload: any) => {
              updateCalls.push(payload)
              return { ok: true }
            },
          },
        }
      })

      const { useUserPrefsSync } = await import('@web/composables/useUserPrefsSync')
      const { syncPref } = useUserPrefsSync()

      const blocklist = ref<string[]>([])
      syncPref('blocklist', blocklist, { debounce: 0 })

      // User changes the pref while logged out (local-only).
      blocklist.value = ['foo']
      await new Promise(resolve => setTimeout(resolve, 0))

      // Later, user logs in and the server has an older value.
      sessionRef.value = {
        isPending: false,
        data: {
          user: {
            id: 'u1',
            additionalFields: {
              blocklist: ['bar'],
              prefsMeta: JSON.stringify({ blocklist: Date.now() - 1_000 }),
            },
          },
          session: {},
        },
        error: null,
      }
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(blocklist.value).toEqual(['foo'])
      expect(updateCalls.length).toBe(1)
      expect(updateCalls[0].blocklist).toEqual(['foo'])

      const meta = JSON.parse(updateCalls[0].prefsMeta)
      expect(meta.blocklist).toBe('__STAMP__')
    } finally {
      Date.now = realNow
      delete (globalThis as any).window
      delete (globalThis as any).__APP_CONFIG__
      mock.restore()
    }
  })
})

