import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { formatQuietHours, isInQuietHours, parseQuietHours } from '@api/jobs'

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

      // Test times within quiet hours
      const testCases = [
        new Date('2025-01-01T21:00:00'), // Start of quiet hours
        new Date('2025-01-01T23:30:00'), // Middle of night
        new Date('2025-01-02T02:00:00'), // Early morning
        new Date('2025-01-02T05:59:00'), // Just before end
      ]

      for (const testTime of testCases) {
        const result = isInQuietHours(quietHours, testTime)
        expect(result).toBeTrue()
      }
    })

    it('detects time outside quiet hours (crossing midnight)', () => {
      const quietHours = parseQuietHours('21:00–06:00')

      // Test times outside quiet hours
      const testCases = [
        new Date('2025-01-01T06:00:00'), // End of quiet hours
        new Date('2025-01-01T12:00:00'), // Noon
        new Date('2025-01-01T18:00:00'), // Evening
        new Date('2025-01-01T20:59:00'), // Just before start
      ]

      for (const testTime of testCases) {
        const result = isInQuietHours(quietHours, testTime)
        expect(result).toBeFalse()
      }
    })

    it('detects time within quiet hours (same day)', () => {
      const quietHours = parseQuietHours('02:00–04:00')

      const testCases = [
        { time: new Date('2025-01-01T02:00:00'), expected: true },
        { time: new Date('2025-01-01T03:00:00'), expected: true },
        { time: new Date('2025-01-01T03:59:00'), expected: true },
        { time: new Date('2025-01-01T04:00:00'), expected: false },
        { time: new Date('2025-01-01T01:59:00'), expected: false },
        { time: new Date('2025-01-01T05:00:00'), expected: false },
      ]

      for (const { time, expected } of testCases) {
        const result = isInQuietHours(quietHours, time)
        expect(result).toBe(expected)
      }
    })

    it('returns false when quiet hours is null', () => {
      const result = isInQuietHours(null, new Date())
      expect(result).toBeFalse()
    })

    it('handles edge case at exactly start time', () => {
      const quietHours = parseQuietHours('21:00–06:00')
      const result = isInQuietHours(quietHours, new Date('2025-01-01T21:00:00'))
      expect(result).toBeTrue()
    })

    it('handles edge case at exactly end time', () => {
      const quietHours = parseQuietHours('21:00–06:00')
      const result = isInQuietHours(quietHours, new Date('2025-01-01T06:00:00'))
      expect(result).toBeFalse()
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

    it('disables quiet hours when set to empty', () => {
      const quietHours = parseQuietHours('')
      expect(quietHours).toBeNull()
    })
  })
})
