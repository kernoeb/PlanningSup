import type { CalendarConfig } from '@schedule-x/calendar'

/**
 * Centralized timezone typings and helpers for the web app.
 *
 * Compute a valid IANA timezone string using Temporal and Intl.
 *
 * - Uses Temporal.Now.timeZoneId() to detect the current zone.
 * - Verifies the result against Intl.supportedValuesOf('timeZone') to ensure it's valid.
 * - Falls back to 'Europe/Paris' if detection fails or is unsupported.
 *
 * This composable is intentionally non-reactive; timezone is considered static for the app session.
 */
export type AllowedTimezones = CalendarConfig['timezone']
export const FALLBACK_TIMEZONE: NonNullable<AllowedTimezones> = 'Europe/Paris'

export function getSupportedTimezones(): Set<string> {
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

export function isAllowedTimezone(tz: string, allowed: Set<string>): tz is NonNullable<AllowedTimezones> {
  return allowed.has(tz)
}

/**
 * Resolve the effective timezone given an optional preferred value.
 * - If `preferred` is allowed, use it.
 * - Otherwise try to detect the browser timezone.
 * - Fallback to FALLBACK_TIMEZONE.
 */
export function resolveTimezone(
  preferred?: string | null,
  allowed: Set<string> = getSupportedTimezones(),
): NonNullable<AllowedTimezones> {
  if (preferred && isAllowedTimezone(preferred, allowed)) return preferred

  const detected = detectBrowserTimezone()
  if (detected && isAllowedTimezone(detected, allowed)) return detected

  return FALLBACK_TIMEZONE
}

export function detectBrowserTimezone(): string | null {
  try {
    const temporalNow = Temporal.Now
    return temporalNow.timeZoneId()
  } catch {}
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz || null
  } catch {
    return null
  }
}

export function useTimezone(preferred?: string | null): { timezone: NonNullable<AllowedTimezones> } {
  const allowedTimezones = getSupportedTimezones()
  const timezone: NonNullable<AllowedTimezones> = resolveTimezone(preferred, allowedTimezones)

  return { timezone }
}
