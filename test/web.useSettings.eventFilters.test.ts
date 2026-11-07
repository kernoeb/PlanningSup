import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { hiddenEventKey } from '@libs/event-filters'

describe('useSettings course filters', () => {
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

  it('syncs eventFilters as a normalized JSON string', () => {
    useSettings()
    const call = calls.find(c => c.key === 'eventFilters')
    expect(call).toBeTruthy()

    const { toServer, fromServerToLocal } = call!.options
    const encoded = toServer({ teachers: [' Dupont ', 'dupont'], rooms: [], slots: [], hidden: [] })
    expect(JSON.parse(encoded)).toEqual({ teachers: ['Dupont'], rooms: [], slots: [], hidden: [] })
    expect(fromServerToLocal(encoded)).toEqual({ teachers: ['Dupont'], rooms: [], slots: [], hidden: [] })
    expect(fromServerToLocal(42)).toBeNull()
  })

  it('adds the filters to the query params, keeping the blocklist', () => {
    const settings = useSettings()
    settings.blocklist.value = ['sport']
    settings.targetTimezone.value = 'Asia/Tokyo'
    settings.eventFilters.value = { ...settings.eventFilters.value, rooms: ['joker'] }
    settings.addTimeSlot({ day: 4, start: '14:00', end: '18:00' })
    settings.addTimeSlot({ day: 4, start: '14:00', end: '18:00' })

    expect(settings.eventFilters.value.slots).toHaveLength(1)
    expect(settings.filterParams.value).toEqual({ blocklist: 'sport', rooms: 'joker', slots: '4-1400-1800', tz: 'Asia/Tokyo' })
    expect(settings.queryParams.value).toEqual(settings.filterParams.value)
  })

  it('hides one course and drops past hidden courses', () => {
    const settings = useSettings()
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000)
    settings.hideEventOnce({ title: 'Old', start: past })
    settings.hideEventOnce({ title: 'Maths', start: soon })

    const key = hiddenEventKey('Maths', soon)
    expect(settings.eventFilters.value.hidden).toEqual([{ key, title: 'Maths', start: soon.toISOString() }])
    expect(settings.queryParams.value.hidden).toBe(key)
  })
})
