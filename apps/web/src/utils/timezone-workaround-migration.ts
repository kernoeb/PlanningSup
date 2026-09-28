// Nantes Celcat plannings used to show 1-2 hours late, and some users set the target timezone
// to UTC to fix it. Now that the API reads those times correctly, reset that setting once.

const DONE_STORAGE_KEY = 'settings.timezoneWorkaroundMigrated'
const TARGET_TIMEZONE_STORAGE_KEY = 'settings.targetTimezone'
const PLANNINGS_STORAGE_KEY = 'plannings'

// Planning files whose upstream feed (edt.univ-nantes.fr) uses floating times.
const AFFECTED_PLANNING_PREFIXES = ['iut-de-nantes.', 'iae-de-nantes.', 'polytech-nantes.', 'nantes-université.']

function offsetMinutes(timeZone: string, date: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(date)
    const name = parts.find(p => p.type === 'timeZoneName')?.value ?? ''
    if (name === 'GMT') return 0
    const match = name.match(/^GMT([+-])(\d{2}):(\d{2})$/)
    if (!match) return null
    return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
  } catch {
    return null
  }
}

function isAlwaysUtc(timeZone: string) {
  const year = new Date().getFullYear()
  return offsetMinutes(timeZone, new Date(Date.UTC(year, 0, 15))) === 0
    && offsetMinutes(timeZone, new Date(Date.UTC(year, 6, 15))) === 0
}

function readPlannings(storage: Storage): string[] {
  try {
    const parsed = JSON.parse(storage.getItem(PLANNINGS_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function shouldResetTimezoneWorkaround(targetTimezone: string | null, browserTimezone: string | null, plannings: string[]) {
  if (!targetTimezone || !browserTimezone || targetTimezone === browserTimezone) return false
  if (!isAlwaysUtc(targetTimezone) || isAlwaysUtc(browserTimezone)) return false
  return plannings.some(id => AFFECTED_PLANNING_PREFIXES.some(prefix => id.startsWith(prefix)))
}

export function runTimezoneWorkaroundMigrationOnce(storage: Storage = globalThis.localStorage) {
  try {
    if (storage.getItem(DONE_STORAGE_KEY)) return
    const target = storage.getItem(TARGET_TIMEZONE_STORAGE_KEY)?.trim() || null
    const browser = new Intl.DateTimeFormat().resolvedOptions().timeZone || null
    if (shouldResetTimezoneWorkaround(target, browser, readPlannings(storage))) {
      storage.removeItem(TARGET_TIMEZONE_STORAGE_KEY)
      console.info('[timezone-migration] Reset the target timezone, no longer needed for Nantes plannings')
    }
    storage.setItem(DONE_STORAGE_KEY, '1')
  } catch (err) {
    console.warn('[timezone-migration] Failed (continuing):', err)
  }
}
