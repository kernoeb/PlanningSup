/**
 * Course filters shared by the web app (settings, query params) and the API (prefs validation, filtering).
 * The name blocklist stays a separate pref for backward compatibility.
 */

export interface TimeSlot {
  // ISO weekday: 1 = Monday, 7 = Sunday
  day: number
  // Local time, 'HH:mm'
  start: string
  end: string
}

export interface HiddenEvent {
  // See hiddenEventKey
  key: string
  // Title and start (ISO instant) are also used to list the hidden course in the settings.
  title: string
  start: string
}

export interface EventFilters {
  teachers: string[]
  rooms: string[]
  slots: TimeSlot[]
  hidden: HiddenEvent[]
}

export const MAX_FILTER_KEYWORDS = 50
export const MAX_FILTER_SLOTS = 20
export const MAX_HIDDEN_EVENTS = 200

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const SLOT_PARAM_RE = /^([1-7])-(\d{4})-(\d{4})$/
const HIDDEN_KEY_RE = /^[0-9a-z]{1,13}$/

export function emptyEventFilters(): EventFilters {
  return { teachers: [], rooms: [], slots: [], hidden: [] }
}

// Values travel as comma-separated query params, so a comma cannot be part of a value.
function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const value = item.trim()
    if (!value || value.length > 100 || value.includes(',')) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= MAX_FILTER_KEYWORDS) break
  }
  return out
}

export function isValidSlot(slot: TimeSlot): boolean {
  return Number.isInteger(slot.day) && slot.day >= 1 && slot.day <= 7
    && TIME_RE.test(slot.start) && TIME_RE.test(slot.end) && slot.start < slot.end
}

function normalizeSlots(raw: unknown): TimeSlot[] {
  if (!Array.isArray(raw)) return []
  const out: TimeSlot[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const slot = { day: Number(obj.day), start: String(obj.start ?? ''), end: String(obj.end ?? '') }
    if (!isValidSlot(slot)) continue
    const key = encodeSlot(slot)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(slot)
    if (out.length >= MAX_FILTER_SLOTS) break
  }
  return out
}

function normalizeHidden(raw: unknown): HiddenEvent[] {
  if (!Array.isArray(raw)) return []
  const out: HiddenEvent[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const key = typeof obj.key === 'string' ? obj.key.trim() : ''
    const start = typeof obj.start === 'string' ? obj.start : ''
    if (!HIDDEN_KEY_RE.test(key) || seen.has(key)) continue
    if (Number.isNaN(Date.parse(start))) continue
    seen.add(key)
    out.push({ key, title: typeof obj.title === 'string' ? obj.title.slice(0, 200) : '', start })
  }
  // Keep the most recent ones.
  return out.slice(-MAX_HIDDEN_EVENTS)
}

export function normalizeEventFilters(raw: unknown): EventFilters {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyEventFilters()
  const obj = raw as Record<string, unknown>
  return {
    teachers: normalizeKeywords(obj.teachers),
    rooms: normalizeKeywords(obj.rooms),
    slots: normalizeSlots(obj.slots),
    hidden: normalizeHidden(obj.hidden),
  }
}

/**
 * Short key for one course: a hash of its title and start time.
 * UIDs are not used because some sources (Celcat) end them with the event's position in the file.
 */
export function hiddenEventKey(title: string, start: Date): string {
  const text = `${title.trim().toLowerCase()}|${start.getTime()}`
  // FNV-1a, 32 bits
  let hash = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

// Compact form for URLs: '1-0800-1000' is Monday 08:00 to 10:00.
export function encodeSlot(slot: TimeSlot): string {
  return `${slot.day}-${slot.start.replace(':', '')}-${slot.end.replace(':', '')}`
}

export function parseSlot(value: string): TimeSlot | null {
  const match = SLOT_PARAM_RE.exec(value.trim())
  if (!match) return null
  const toTime = (hhmm: string) => `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`
  const slot = { day: Number(match[1]), start: toTime(match[2]!), end: toTime(match[3]!) }
  return isValidSlot(slot) ? slot : null
}

/**
 * Query params understood by `/api/plannings/:fullId` and `/api/ics`.
 * `tz` tells the API in which timezone the time slots are written.
 */
export function eventFiltersToQuery(filters: EventFilters, timezone: string): Record<string, string> {
  const qp: Record<string, string> = {}
  if (filters.teachers.length > 0) qp.teachers = filters.teachers.join(',')
  if (filters.rooms.length > 0) qp.rooms = filters.rooms.join(',')
  if (filters.slots.length > 0) {
    qp.slots = filters.slots.map(encodeSlot).join(',')
    qp.tz = timezone
  }
  if (filters.hidden.length > 0) qp.hidden = filters.hidden.map(h => h.key).join(',')
  return qp
}
