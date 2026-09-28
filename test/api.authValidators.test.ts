import { describe, expect, it } from 'bun:test'
import { colorsInput, customGroupsInput, eventFiltersInput, planningsInput, prefsMetaInput } from '@api/utils/auth-validators'

describe('auth validators (Zod transforms)', () => {
  describe('planningsInput', () => {
    it('trims, filters empty, dedupes and limits', () => {
      const out = planningsInput.parse([' a ', 'a', '', '  ', 'b', 'c'.repeat(300)])
      expect(out).toEqual(['a', 'b'])
    })
  })

  describe('customGroupsInput', () => {
    it('rejects non-string input', () => {
      expect(() => customGroupsInput.parse([
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Group',
          plannings: ['a'],
        },
      ])).toThrow()
    })

    it('accepts a JSON string and normalizes its content', () => {
      const input = JSON.stringify([
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'G',
          plannings: ['x', 'x', 'y', ' '.repeat(5)],
        },
      ])

      const out = customGroupsInput.parse(input)
      expect(out).toBe(JSON.stringify([
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'G',
          plannings: ['x', 'y'],
        },
      ]))
    })

    it('returns [] on invalid JSON', () => {
      expect(customGroupsInput.parse('{oops')).toBe('[]')
    })

    it('dedupes groups by id and enforces max name length', () => {
      const out = customGroupsInput.parse(JSON.stringify([
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'ok',
          plannings: [],
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'duplicate-id',
          plannings: ['x'],
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'x'.repeat(81),
          plannings: ['y'],
        },
      ]))

      expect(out).toBe(JSON.stringify([
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'ok',
          plannings: [],
        },
      ]))
    })
  })

  describe('colorsInput', () => {
    it('keeps only JSON objects with string values, else {}', () => {
      expect(colorsInput.parse(JSON.stringify({ a: '#fff', b: '#000' }))).toBe(JSON.stringify({ a: '#fff', b: '#000' }))
      expect(colorsInput.parse(JSON.stringify({ a: 1 }))).toBe('{}')
      expect(colorsInput.parse('[]')).toBe('{}')
      expect(colorsInput.parse('{oops')).toBe('{}')
    })
  })

  describe('eventFiltersInput', () => {
    it('normalizes the filters to a JSON string', () => {
      const out = eventFiltersInput.parse(JSON.stringify({
        teachers: [' pas de prof ', 'PAS DE PROF'],
        rooms: 'not-an-array',
        slots: [{ day: 4, start: '14:00', end: '18:00' }, { day: 0, start: '14:00', end: '18:00' }],
        hidden: [{ key: 'k1', title: 'Maths', start: '2026-01-05T07:00:00.000Z' }],
        extra: true,
      }))
      expect(JSON.parse(out)).toEqual({
        teachers: ['pas de prof'],
        rooms: [],
        slots: [{ day: 4, start: '14:00', end: '18:00' }],
        hidden: [{ key: 'k1', title: 'Maths', start: '2026-01-05T07:00:00.000Z' }],
      })
    })

    it('returns empty filters for invalid JSON', () => {
      expect(JSON.parse(eventFiltersInput.parse('{oops'))).toEqual({ teachers: [], rooms: [], slots: [], hidden: [] })
    })
  })

  describe('prefsMetaInput', () => {
    it('accepts the eventFilters key', () => {
      expect(JSON.parse(prefsMetaInput.parse(JSON.stringify({ eventFilters: 1 })))).toEqual({ eventFilters: 1 })
    })

    it('keeps allowed keys, keeps numeric timestamps, stamps non-numbers', () => {
      const before = Date.now()
      const outStr = prefsMetaInput.parse(JSON.stringify({
        theme: 'stamp-me',
        plannings: 123,
        unknownKey: 456,
      }))
      const after = Date.now()

      const out = JSON.parse(outStr) as Record<string, unknown>
      expect(out).toHaveProperty('plannings', 123)
      expect(out).not.toHaveProperty('unknownKey')
      expect(typeof out.theme).toBe('number')
      expect((out.theme as number)).toBeGreaterThanOrEqual(before)
      expect((out.theme as number)).toBeLessThanOrEqual(after)
    })

    it('returns {} for non-object JSON', () => {
      expect(prefsMetaInput.parse('[]')).toBe('{}')
      expect(prefsMetaInput.parse('"x"')).toBe('{}')
    })

    it('returns {} for invalid JSON', () => {
      expect(prefsMetaInput.parse('{oops')).toBe('{}')
    })
  })
})
