import type { CalendarConfig } from '@schedule-x/calendar'

/**
 * Compute a valid IANA timezone string using Temporal and Intl.
 *
 * - Uses Temporal.Now.timeZoneId() to detect the current zone.
 * - Verifies the result against Intl.supportedValuesOf('timeZone') to ensure it's valid.
 * - Falls back to 'Europe/Paris' if detection fails or is unsupported.
 *
 * This composable is intentionally non-reactive; timezone is considered static for the app session.
 */
type AllowedTimezones = CalendarConfig['timezone']
const FALLBACK_TIMEZONE: NonNullable<AllowedTimezones> = 'Europe/Paris'

function getSupportedTimezones(): Set<string> {
  // Guard against older environments or unusual runtimes
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return new Set(Intl.supportedValuesOf('timeZone'))
    }
  } catch {
    // no-op, will return fallback set below
  }
  return new Set([FALLBACK_TIMEZONE as string])
}

function isAllowedTimezone(tz: string, allowed: Set<string>): tz is NonNullable<AllowedTimezones> {
  return allowed.has(tz)
}

export function useTimezone(): { timezone: NonNullable<AllowedTimezones> } {
  const allowedTimezones = getSupportedTimezones()

  let detected: string | null = null
  try {
    // Temporal polyfill should be loaded globally (see usage in App.vue)
    detected = Temporal.Now.timeZoneId()
  } catch {
    detected = null
  }

  const timezone: NonNullable<AllowedTimezones>
    = detected && isAllowedTimezone(detected, allowedTimezones) ? detected : FALLBACK_TIMEZONE

  return { timezone }
}
