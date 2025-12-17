import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'

describe('useSettings customGroups sync encoding', () => {
  const calls: Array<{ key: string, options: any }> = []
  let useSettings: any

  beforeAll(async () => {
    mock.module('@web/composables/useUserPrefsSync', () => {
      return {
        useUserPrefsSync: () => ({
          syncPref: (key: string, _source: unknown, options: unknown) => {
            calls.push({ key, options })
          },
        }),
      }
    })

    // Import via a cache-busted path to avoid cross-test module cache pollution from other mock.module() calls.
    const mod = await import(`../apps/web/src/composables/useSettings?test=${Date.now()}`)
    useSettings = mod.useSettings
  })

  beforeEach(() => {
    calls.length = 0
    try {
      localStorage.clear()
    } catch {}
  })

  afterAll(() => {
    mock.restore()
  })

  it('serializes customGroups to a stable JSON string and parses it back', () => {
    useSettings()

    const call = calls.find(c => c.key === 'customGroups')
    expect(call).toBeTruthy()

    const { toServer, fromServerToLocal } = call!.options as {
      toServer: (v: unknown) => unknown
      fromServerToLocal: (raw: unknown) => unknown
    }

    const validId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    const payload = [
      { id: validId, name: '  Fac de bio  ', plannings: [' A ', '', 'A', 'B', '   '] },
      { id: 'not-a-uuid', name: 'ignored', plannings: ['X'] },
      { id: validId, name: 'duplicate id ignored', plannings: ['C'] },
    ]

    const encoded = toServer(payload)
    expect(typeof encoded).toBe('string')

    const decoded = JSON.parse(encoded as string) as any[]
    expect(decoded).toEqual([
      { id: validId, name: 'Fac de bio', plannings: ['A', 'B'] },
    ])

    const roundTrip = fromServerToLocal(encoded)
    expect(roundTrip).toEqual([
      { id: validId, name: 'Fac de bio', plannings: ['A', 'B'] },
    ])
  })
})
