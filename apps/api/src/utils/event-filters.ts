import type { TimeSlot } from '@libs/event-filters'
import { encodeSlot, hiddenEventKey, MAX_FILTER_KEYWORDS, MAX_FILTER_SLOTS, MAX_HIDDEN_EVENTS, parseSlot } from '@libs/event-filters'

const DEFAULT_SLOTS_TIMEZONE = 'Europe/Paris'
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

export interface EventFilterRules {
  // Keywords, lowercase: event summary, description and location.
  blocklist: string[]
  teachers: string[]
  rooms: string[]
  slots: TimeSlot[]
  hidden: string[]
  timezone: string
}

export interface EventFilterQuery {
  blocklist?: string
  teachers?: string
  rooms?: string
  slots?: string
  hidden?: string
  tz?: string
}

// Sorted and deduplicated, so the same filters give the same ICS cache key.
function parseList(raw: string | undefined, max: number, lowercase: boolean) {
  const values = (raw ?? '').split(',').map(s => (lowercase ? s.trim().toLowerCase() : s.trim())).filter(s => s.length > 0)
  return [...new Set(values)].sort().slice(0, max)
}

function isValidTimezone(tz: string) {
  try {
    return !!new Intl.DateTimeFormat(undefined, { timeZone: tz })
  } catch {
    return false
  }
}

export function parseEventFilterQuery(query: EventFilterQuery): EventFilterRules {
  const slots = parseList(query.slots, MAX_FILTER_SLOTS, false).map(parseSlot).filter(s => s !== null)
  const tz = query.tz?.trim()
  return {
    // No cap here: old links may carry long blocklists.
    blocklist: parseList(query.blocklist, Number.POSITIVE_INFINITY, true),
    teachers: parseList(query.teachers, MAX_FILTER_KEYWORDS, true),
    rooms: parseList(query.rooms, MAX_FILTER_KEYWORDS, true),
    slots,
    hidden: parseList(query.hidden, MAX_HIDDEN_EVENTS, false),
    timezone: tz && isValidTimezone(tz) ? tz : DEFAULT_SLOTS_TIMEZONE,
  }
}

export function eventFilterRulesKey(rules: EventFilterRules) {
  const slots = rules.slots.map(encodeSlot).join(',')
  return [rules.blocklist, rules.teachers, rules.rooms, rules.hidden].map(l => l.join(',')).concat(slots, slots ? rules.timezone : '').join('|')
}

function toMinutes(hhmm: string) {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

/**
 * Returns a function that tells if an event must be hidden.
 * `title`, `location` and `description` are the cleaned values, the ones the user sees.
 */
export function createEventMatcher(rules: EventFilterRules) {
  const hidden = new Set(rules.hidden)
  const slots = rules.slots.map(s => ({ day: s.day, start: toMinutes(s.start), end: toMinutes(s.end) }))
  const formatter = slots.length > 0
    ? new Intl.DateTimeFormat('en-GB', { timeZone: rules.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : null

  const inSlot = (startDate: Date, endDate: Date) => {
    if (!formatter) return false
    const parts = formatter.formatToParts(startDate)
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''
    const day = WEEKDAYS[part('weekday')]
    const start = Number(part('hour')) * 60 + Number(part('minute'))
    const end = start + Math.max(0, (endDate.getTime() - startDate.getTime()) / 60_000)
    // A course that overlaps the slot is hidden, even if only in part.
    return slots.some(s => s.day === day && start < s.end && end > s.start)
  }

  return (event: { title: string, summary: string, startDate: Date, endDate: Date, location: string, description: string }) => {
    if (hidden.size > 0 && hidden.has(hiddenEventKey(event.title, event.startDate))) return true
    const includesAny = (text: string, keywords: string[]) => {
      if (keywords.length === 0) return false
      const lower = text.toLowerCase()
      return keywords.some(k => lower.includes(k))
    }
    return includesAny(event.summary, rules.blocklist)
      || includesAny(event.description, rules.teachers)
      || includesAny(event.location, rules.rooms)
      || inSlot(event.startDate, event.endDate)
  }
}
