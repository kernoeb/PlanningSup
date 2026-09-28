import { describe, expect, it } from 'bun:test'
import { createEventMatcher, eventFilterRulesKey, parseEventFilterQuery } from '@api/utils/event-filters'
import { encodeSlot, eventFiltersToQuery, hiddenEventKey, normalizeEventFilters, parseSlot } from '@libs/event-filters'

function event(overrides: Partial<{ title: string, summary: string, startDate: Date, endDate: Date, location: string, description: string, rawLocation: string }> = {}) {
  return {
    title: 'Maths TD',
    summary: 'Maths TD',
    // Monday 5 January 2026, 08:00 to 10:00 in Paris (UTC+1)
    startDate: new Date('2026-01-05T07:00:00Z'),
    endDate: new Date('2026-01-05T09:00:00Z'),
    location: 'B12',
    description: 'Matière : Maths\nPersonnel : DUPONT, Jean',
    ...overrides,
  }
}

describe('normalizeEventFilters', () => {
  it('trims, dedupes and drops invalid values', () => {
    const filters = normalizeEventFilters({
      teachers: [' Dupont ', 'dupont', '', 'a,b', 42],
      rooms: ['Joker'],
      slots: [
        { day: 4, start: '14:00', end: '18:00' },
        { day: 4, start: '14:00', end: '18:00' },
        { day: 8, start: '14:00', end: '18:00' },
        { day: 1, start: '10:00', end: '09:00' },
        { day: 1, start: '8:00', end: '09:00' },
      ],
      hidden: [
        { key: 'abc12', title: 'Maths', start: '2026-01-05T07:00:00.000Z' },
        { key: 'abc12', title: 'duplicate', start: '2026-01-05T07:00:00.000Z' },
        { key: 'b', title: 'bad date', start: 'nope' },
        { key: 'NOT,A-KEY', title: 'bad key', start: '2026-01-05T07:00:00.000Z' },
      ],
    })
    expect(filters).toEqual({
      teachers: ['Dupont'],
      rooms: ['Joker'],
      slots: [{ day: 4, start: '14:00', end: '18:00' }],
      hidden: [{ key: 'abc12', title: 'Maths', start: '2026-01-05T07:00:00.000Z' }],
    })
  })

  it('returns empty filters for anything that is not an object', () => {
    const empty = { teachers: [], rooms: [], slots: [], hidden: [] }
    expect(normalizeEventFilters(null)).toEqual(empty)
    expect(normalizeEventFilters([])).toEqual(empty)
    expect(normalizeEventFilters('x')).toEqual(empty)
  })
})

describe('slot encoding and query params', () => {
  it('round-trips a slot through its compact form', () => {
    const slot = { day: 4, start: '14:00', end: '18:30' }
    expect(encodeSlot(slot)).toBe('4-1400-1830')
    expect(parseSlot('4-1400-1830')).toEqual(slot)
    expect(parseSlot('8-1400-1830')).toBeNull()
    expect(parseSlot('4-1800-1400')).toBeNull()
    expect(parseSlot('4-2500-2600')).toBeNull()
  })

  it('only sends the filters that are set, and tz only with slots', () => {
    const filters = normalizeEventFilters({ teachers: ['pas de prof'], hidden: [{ key: 'x1', title: '', start: '2026-01-05T07:00:00Z' }] })
    expect(eventFiltersToQuery(filters, 'Europe/Paris')).toEqual({ teachers: 'pas de prof', hidden: 'x1' })

    const withSlot = normalizeEventFilters({ slots: [{ day: 1, start: '08:00', end: '10:00' }] })
    expect(eventFiltersToQuery(withSlot, 'America/Montreal')).toEqual({ slots: '1-0800-1000', tz: 'America/Montreal' })
  })
})

describe('parseEventFilterQuery', () => {
  it('lowercases, trims and dedupes keywords', () => {
    const rules = parseEventFilterQuery({ blocklist: 'Sport, sport', teachers: 'DUPONT', rooms: 'Joker', hidden: 'b2,a1,a1' })
    expect(rules.blocklist).toEqual(['sport'])
    expect(rules.teachers).toEqual(['dupont'])
    expect(rules.rooms).toEqual(['joker'])
    expect(rules.hidden).toEqual(['a1', 'b2'])
  })

  it('falls back to Paris time for a missing or invalid timezone', () => {
    expect(parseEventFilterQuery({}).timezone).toBe('Europe/Paris')
    expect(parseEventFilterQuery({ tz: 'Not/AZone' }).timezone).toBe('Europe/Paris')
    expect(parseEventFilterQuery({ tz: 'Asia/Tokyo' }).timezone).toBe('Asia/Tokyo')
  })

  it('ignores invalid slots', () => {
    expect(parseEventFilterQuery({ slots: '1-0800-1000,bad,9-0800-1000' }).slots).toEqual([{ day: 1, start: '08:00', end: '10:00' }])
  })

  it('gives the same cache key for the same filters in any order', () => {
    const a = parseEventFilterQuery({ blocklist: 'b,a', rooms: 'x', slots: '2-0800-1000,1-0800-1000' })
    const b = parseEventFilterQuery({ blocklist: 'a,b', rooms: 'X', slots: '1-0800-1000,2-0800-1000' })
    expect(eventFilterRulesKey(a)).toBe(eventFilterRulesKey(b))
    expect(eventFilterRulesKey(a)).not.toBe(eventFilterRulesKey(parseEventFilterQuery({ blocklist: 'a,b' })))
  })
})

describe('createEventMatcher', () => {
  const matcher = (query: Parameters<typeof parseEventFilterQuery>[0]) => createEventMatcher(parseEventFilterQuery(query))

  it('keeps everything without filters', () => {
    expect(matcher({})(event())).toBeFalse()
  })

  it('hides by title, teacher (description) and room (location)', () => {
    expect(matcher({ blocklist: 'maths' })(event())).toBeTrue()
    expect(matcher({ teachers: 'dupont' })(event())).toBeTrue()
    expect(matcher({ teachers: 'pas de prof' })(event({ description: 'Personnel : PAS DE PROF' }))).toBeTrue()
    expect(matcher({ teachers: 'martin' })(event())).toBeFalse()
    expect(matcher({ rooms: 'joker' })(event({ location: 'Salle Joker' }))).toBeTrue()
    expect(matcher({ rooms: 'joker' })(event())).toBeFalse()
    // Cleaning rewrites this room to "À distance", so the raw value must match too.
    expect(matcher({ rooms: 'joker' })(event({ location: 'À distance', rawLocation: 'salle joker à distance' }))).toBeTrue()
  })

  it('hides one course by its title and start time', () => {
    const key = hiddenEventKey('Maths TD', new Date('2026-01-05T07:00:00Z'))
    expect(key).toMatch(/^[0-9a-z]{1,7}$/)
    // Case and spaces around the title do not change the key.
    expect(hiddenEventKey('  maths td ', new Date('2026-01-05T07:00:00Z'))).toBe(key)

    const isHidden = matcher({ hidden: key })
    expect(isHidden(event())).toBeTrue()
    // Same course the next week
    expect(isHidden(event({ startDate: new Date('2026-01-12T07:00:00Z'), endDate: new Date('2026-01-12T09:00:00Z') }))).toBeFalse()
    expect(isHidden(event({ title: 'Physique TD' }))).toBeFalse()
  })

  it('hides courses that overlap a weekly slot, in Paris time', () => {
    // Monday 08:00-10:00 Paris
    expect(matcher({ slots: '1-0900-0930' })(event())).toBeTrue()
    expect(matcher({ slots: '1-0700-0800' })(event())).toBeFalse()
    expect(matcher({ slots: '1-1000-1200' })(event())).toBeFalse()
    expect(matcher({ slots: '2-0800-1000' })(event())).toBeFalse()
  })

  it('keeps all-day events out of slots', () => {
    const allDay = event({ startDate: new Date('2026-01-04T23:00:00Z'), endDate: new Date('2026-01-05T23:00:00Z') })
    expect(matcher({ slots: '1-0800-1000' })(allDay)).toBeFalse()
  })

  it('follows daylight saving time', () => {
    // Monday 6 July 2026, 08:00 Paris is 06:00 UTC
    const summer = event({ startDate: new Date('2026-07-06T06:00:00Z'), endDate: new Date('2026-07-06T08:00:00Z') })
    expect(matcher({ slots: '1-0800-0900' })(summer)).toBeTrue()
    expect(matcher({ slots: '1-0600-0800' })(summer)).toBeFalse()
  })

  it('reads the slot in the given timezone', () => {
    // 08:00 Paris is 16:00 in Tokyo in winter
    expect(matcher({ slots: '1-1600-1700', tz: 'Asia/Tokyo' })(event())).toBeTrue()
    expect(matcher({ slots: '1-0800-0900', tz: 'Asia/Tokyo' })(event())).toBeFalse()
  })
})
