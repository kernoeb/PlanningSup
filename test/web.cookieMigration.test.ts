import { beforeEach, describe, expect, it } from 'bun:test'

function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>()

  const api: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
  }

  return api
}

describe('cookie migration (legacy Nuxt -> new localStorage)', () => {
  const originalWindow = globalThis.window
  const originalLocalStorage = (globalThis as any).localStorage as Storage | undefined

  beforeEach(() => {
    ;(globalThis as any).window = { location: { origin: 'https://example.test' } }
    ;(globalThis as any).localStorage = createMemoryLocalStorage()
  })

  it('migrates legacy cookies into the new localStorage keys (including favorites -> customGroups)', async () => {
    const cookieWrites: string[] = []
    const originalDocument = globalThis.document
    const originalFetch = globalThis.fetch

    // Minimal document mock: only cookie is needed.
    ;(globalThis as any).document = {
      get cookie() {
        return [
          'plannings=iut-de-vannes.butdutgea.1ereannee.groupe1.gr1g%2Ciut-de-vannes.butdutgea.1ereannee.groupe1.gr1t',
          'timezone=America%2FSao_Paulo',
          'customColorList=%7B%22td%22%3A%22%232ECC70%22%7D',
          'blocklist=%5B%22Maths%22%5D',
          'group-favorites=%5B%7B%22name%22%3A%22Super%22%2C%22plannings%22%3A%5B%22a%22%2C%22b%22%5D%7D%5D',
          'favorites=%7B%22x%22%3Anull%2C%22y%22%3A%22Custom%20Name%22%7D',
          'mergeDuplicates=false',
          'highlightTeacher=true',
          'theme=true',
          'plannings-cookie-v2=true',
        ].join('; ')
      },
      set cookie(value: string) {
        cookieWrites.push(value)
      },
    }

    // Mock `/api/plannings` title lookup used for favorite naming.
    ;(globalThis as any).fetch = async (input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? input)
      if (!url.includes('/api/plannings')) {
        return { ok: false, json: async () => null } as any
      }

      return {
        ok: true,
        json: async () => ([
          { title: 'X Title', fullId: 'x' },
          { title: 'Y Title', fullId: 'y' },
        ]),
      } as any
    }

    // Ensure deterministic UUIDs
    const originalCrypto = globalThis.crypto
    ;(globalThis as any).crypto = {
      randomUUID: (() => {
        let i = 0
        return () => `00000000-0000-4000-8000-00000000000${i++}`
      })(),
    }

    try {
      const mod = await import(`../apps/web/src/utils/cookie-migration?test=${Date.now()}`)
      await mod.runCookieMigrationOnce()

      expect(localStorage.getItem('settings.cookieMigrationVersion')).toBe('1')

      expect(localStorage.getItem('plannings')).toBe(JSON.stringify([
        'iut-de-vannes.butdutgea.1ereannee.groupe1.gr1g',
        'iut-de-vannes.butdutgea.1ereannee.groupe1.gr1t',
      ]))

      // VueUse stores strings as JSON-encoded strings (with quotes)
      expect(localStorage.getItem('settings.targetTimezone')).toBe('America/Sao_Paulo')

      // Legacy td -> tutorial
      expect(localStorage.getItem('settings.colors')).toBe(JSON.stringify({ tutorial: '#2ECC70' }))

      expect(localStorage.getItem('settings.blocklist')).toBe(JSON.stringify(['Maths']))
      expect(localStorage.getItem('settings.mergeDuplicates')).toBe(JSON.stringify(false))
      expect(localStorage.getItem('settings.highlightTeacher')).toBe(JSON.stringify(true))

      // useColorMode stores raw strings (not JSON)
      expect(localStorage.getItem('settings.theme')).toBe('dark')

      const groupsRaw = localStorage.getItem('settings.customGroups')
      expect(groupsRaw).toBeTruthy()
      const groups = JSON.parse(groupsRaw!) as Array<{ id: string, name: string, plannings: string[] }>
      expect(groups).toEqual([
        { id: '00000000-0000-4000-8000-000000000000', name: 'Super', plannings: ['a', 'b'] },
        { id: '00000000-0000-4000-8000-000000000001', name: 'X Title', plannings: ['x'] },
        { id: '00000000-0000-4000-8000-000000000002', name: 'Y Title', plannings: ['y'] },
      ])

      const metaRaw = localStorage.getItem('userPrefsMeta')
      expect(metaRaw).toBeTruthy()
      const meta = JSON.parse(metaRaw!) as Record<string, number>
      expect(typeof meta.plannings).toBe('number')
      expect(typeof meta.colors).toBe('number')
      expect(typeof meta.blocklist).toBe('number')
      expect(typeof meta.mergeDuplicates).toBe('number')
      expect(typeof meta.highlightTeacher).toBe('number')
      expect(typeof meta.theme).toBe('number')
      expect(typeof meta.customGroups).toBe('number')

      // Best-effort cookie deletion attempts for migrated cookies
      const deleted = cookieWrites.join('\n')
      expect(deleted.includes('plannings=;')).toBe(true)
      expect(deleted.includes('timezone=;')).toBe(true)
      expect(deleted.includes('customColorList=;')).toBe(true)
      expect(deleted.includes('blocklist=;')).toBe(true)
      expect(deleted.includes('group-favorites=;')).toBe(true)
      expect(deleted.includes('favorites=;')).toBe(true)
      expect(deleted.includes('mergeDuplicates=;')).toBe(true)
      expect(deleted.includes('highlightTeacher=;')).toBe(true)
      expect(deleted.includes('theme=;')).toBe(true)
    } finally {
      ;(globalThis as any).document = originalDocument
      ;(globalThis as any).crypto = originalCrypto
      ;(globalThis as any).fetch = originalFetch
      ;(globalThis as any).window = originalWindow
      if (originalLocalStorage) {
        ;(globalThis as any).localStorage = originalLocalStorage
      } else {
        delete (globalThis as any).localStorage
      }
    }
  })
})
