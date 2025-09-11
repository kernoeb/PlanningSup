import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { DEFAULT_TIMEZONE, formatQuietHours, isInQuietHours, parseQuietHours } from '@api/jobs'

/**
 * Test goals:
 * - Test quiet hours parsing from environment variables
 * - Test quiet hours detection logic
 * - Test quiet hours crossing midnight (21:00–06:00)
 * - Test quiet hours within same day (02:00–04:00)
 * - Test invalid quiet hours configurations
 */

describe('Jobs quiet hours functionality', () => {
  let originalEnv: Record<string, string | undefined>

  beforeAll(() => {
    // Save original environment
    originalEnv = {
      JOBS_QUIET_HOURS: Bun.env.JOBS_QUIET_HOURS,
    }
  })

  afterAll(() => {
    // Restore original environment
    Object.assign(Bun.env, originalEnv)
  })

  describe('Quiet hours parsing', () => {
    it('parses default quiet hours (21:00–06:00)', () => {
      const quietHours = parseQuietHours('21:00–06:00')

      expect(quietHours).toEqual({
        start: { hour: 21, minute: 0 },
        end: { hour: 6, minute: 0 },
        crossesMidnight: true,
      })
    })

    it('parses quiet hours with hyphen separator (21:00-06:00)', () => {
      const quietHours = parseQuietHours('21:00-06:00')

      expect(quietHours).toEqual({
        start: { hour: 21, minute: 0 },
        end: { hour: 6, minute: 0 },
        crossesMidnight: true,
      })
    })

    it('parses quiet hours within same day (02:00–04:00)', () => {
      const quietHours = parseQuietHours('02:00–04:00')

      expect(quietHours).toEqual({
        start: { hour: 2, minute: 0 },
        end: { hour: 4, minute: 0 },
        crossesMidnight: false,
      })
    })

    it('parses quiet hours with minutes (22:30–07:15)', () => {
      const quietHours = parseQuietHours('22:30–07:15')

      expect(quietHours).toEqual({
        start: { hour: 22, minute: 30 },
        end: { hour: 7, minute: 15 },
        crossesMidnight: true,
      })
    })

    it('handles invalid quiet hours format', () => {
      const quietHours = parseQuietHours('invalid-format')
      expect(quietHours).toBeNull()
    })

    it('handles invalid time values', () => {
      const quietHours = parseQuietHours('25:00–06:00') // Invalid hour
      expect(quietHours).toBeNull()
    })

    it('handles empty quiet hours', () => {
      const quietHours = parseQuietHours('')
      expect(quietHours).toBeNull()
    })

    it('handles single-digit hours', () => {
      const quietHours = parseQuietHours('9:00–17:00')
      expect(quietHours).toEqual({
        start: { hour: 9, minute: 0 },
        end: { hour: 17, minute: 0 },
        crossesMidnight: false,
      })
    })
  })

  describe('Quiet hours detection', () => {
    it('detects time within quiet hours (crossing midnight)', () => {
      const quietHours = parseQuietHours('21:00–06:00')

      // Test times within quiet hours (in Europe/Paris timezone)
      // Note: These are UTC times that correspond to quiet hours in Paris time
      const testCases = [
        new Date('2025-01-01T20:00:00Z'), // 21:00 Paris time (UTC+1 winter)
        new Date('2025-01-01T22:30:00Z'), // 23:30 Paris time
        new Date('2025-01-02T01:00:00Z'), // 02:00 Paris time
        new Date('2025-01-02T04:59:00Z'), // 05:59 Paris time
      ]

      for (const testTime of testCases) {
        const result = isInQuietHours(quietHours, testTime, 'Europe/Paris')
        expect(result).toBeTrue()
      }
    })

    it('detects time outside quiet hours (crossing midnight)', () => {
      const quietHours = parseQuietHours('21:00–06:00')

      // Test times outside quiet hours (in Europe/Paris timezone)
      const testCases = [
        new Date('2025-01-01T05:00:00Z'), // 06:00 Paris time (end of quiet hours)
        new Date('2025-01-01T11:00:00Z'), // 12:00 Paris time (noon)
        new Date('2025-01-01T17:00:00Z'), // 18:00 Paris time (evening)
        new Date('2025-01-01T19:59:00Z'), // 20:59 Paris time (just before start)
      ]

      for (const testTime of testCases) {
        const result = isInQuietHours(quietHours, testTime, 'Europe/Paris')
        expect(result).toBeFalse()
      }
    })

    it('detects time within quiet hours (same day)', () => {
      const quietHours = parseQuietHours('02:00–04:00')

      // Test times for same-day quiet hours (in Europe/Paris timezone)
      const testCases = [
        { time: new Date('2025-01-01T01:00:00Z'), expected: true }, // 02:00 Paris time
        { time: new Date('2025-01-01T02:00:00Z'), expected: true }, // 03:00 Paris time
        { time: new Date('2025-01-01T02:59:00Z'), expected: true }, // 03:59 Paris time
        { time: new Date('2025-01-01T03:00:00Z'), expected: false }, // 04:00 Paris time
        { time: new Date('2025-01-01T00:59:00Z'), expected: false }, // 01:59 Paris time
        { time: new Date('2025-01-01T04:00:00Z'), expected: false }, // 05:00 Paris time
      ]

      for (const { time, expected } of testCases) {
        const result = isInQuietHours(quietHours, time, 'Europe/Paris')
        expect(result).toBe(expected)
      }
    })

    it('returns false when quiet hours is null', () => {
      const result = isInQuietHours(null, new Date(), 'Europe/Paris')
      expect(result).toBeFalse()
    })

    it('handles edge case at exactly start time', () => {
      const quietHours = parseQuietHours('21:00–06:00')
      const result = isInQuietHours(quietHours, new Date('2025-01-01T20:00:00Z'), 'Europe/Paris') // 21:00 Paris time
      expect(result).toBeTrue()
    })

    it('handles edge case at exactly end time', () => {
      const quietHours = parseQuietHours('21:00–06:00')
      const result = isInQuietHours(quietHours, new Date('2025-01-01T05:00:00Z'), 'Europe/Paris') // 06:00 Paris time
      expect(result).toBeFalse()
    })

    it('works with different timezones', () => {
      const quietHours = parseQuietHours('21:00–06:00')

      // Same UTC time, different timezones
      const utcTime = new Date('2025-01-01T21:00:00Z')

      // 21:00 UTC = 22:00 Paris (winter) = within quiet hours
      expect(isInQuietHours(quietHours, utcTime, 'Europe/Paris')).toBeTrue()

      // 21:00 UTC = 21:00 UTC = within quiet hours
      expect(isInQuietHours(quietHours, utcTime, 'UTC')).toBeTrue()

      // 21:00 UTC = 16:00 New York (winter) = outside quiet hours
      expect(isInQuietHours(quietHours, utcTime, 'America/New_York')).toBeFalse()
    })
  })

  describe('Quiet hours formatting', () => {
    it('formats quiet hours correctly', () => {
      const quietHours = parseQuietHours('21:00–06:00')
      const formatted = formatQuietHours(quietHours)
      expect(formatted).toBe('21:00–06:00')
    })

    it('formats quiet hours with minutes', () => {
      const quietHours = parseQuietHours('22:30–07:15')
      const formatted = formatQuietHours(quietHours)
      expect(formatted).toBe('22:30–07:15')
    })

    it('formats null quiet hours as disabled', () => {
      const formatted = formatQuietHours(null)
      expect(formatted).toBe('disabled')
    })

    it('pads single digit hours', () => {
      const quietHours = parseQuietHours('9:00–17:00')
      const formatted = formatQuietHours(quietHours)
      expect(formatted).toBe('09:00–17:00')
    })
  })

  describe('Environment variable integration', () => {
    it('uses default quiet hours when not specified', async () => {
      delete Bun.env.JOBS_QUIET_HOURS
      const { jobs } = await import('@api/jobs')
      const quietHours = jobs.getQuietHours()

      expect(quietHours).toEqual({
        start: { hour: 21, minute: 0 },
        end: { hour: 6, minute: 0 },
        crossesMidnight: true,
      })
    })

    it('uses default timezone when not specified', async () => {
      delete Bun.env.JOBS_QUIET_HOURS_TIMEZONE
      const { jobs } = await import('@api/jobs')
      const timezone = jobs.getTimezone()

      expect(timezone).toBe('Europe/Paris')
    })

    it('disables quiet hours when set to empty', () => {
      const quietHours = parseQuietHours('')
      expect(quietHours).toBeNull()
    })
  })
})
