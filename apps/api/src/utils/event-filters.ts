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
export function parseList(raw: string | undefined, max = Number.POSITIVE_INFINITY, lowercase = false) {
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
    blocklist: parseList(query.blocklist, undefined, true),
    teachers: parseList(query.teachers, MAX_FILTER_KEYWORDS, true),
    rooms: parseList(query.rooms, MAX_FILTER_KEYWORDS, true),
    slots,
    hidden: parseList(query.hidden, MAX_HIDDEN_EVENTS, false),
    timezone: tz && isValidTimezone(tz) ? tz : DEFAULT_SLOTS_TIMEZONE,
  }
}

export function eventFilterRulesKey(rules: EventFilterRules) {
  const slots = rules.slots.map(encodeSlot)
  // JSON, so a keyword that contains a separator cannot collide with another set of filters.
  return JSON.stringify([rules.blocklist, rules.teachers, rules.rooms, rules.hidden, slots, slots.length > 0 ? rules.timezone : ''])
}

function toMinutes(hhmm: string) {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

const DAY_MINUTES = 24 * 60

function includesAny(texts: string[], keywords: string[]) {
  if (keywords.length === 0) return false
  return texts.some((text) => {
    const lower = text.toLowerCase()
    return keywords.some(k => lower.includes(k))
  })
}

/**
 * Returns a function that tells if an event must be hidden.
 * `title`, `location` and `description` are the cleaned values, the ones the user sees.
 * Rooms and teachers also match the raw values, because cleaning rewrites some rooms ("salle joker à distance").
 */
export function createEventMatcher(rules: EventFilterRules) {
  const hidden = new Set(rules.hidden)
  const slots = rules.slots.map(s => ({ day: s.day, start: toMinutes(s.start), end: toMinutes(s.end) }))
  const formatter = slots.length > 0
    ? new Intl.DateTimeFormat('en-GB', { timeZone: rules.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : null

  const inSlot = (startDate: Date, endDate: Date) => {
    if (!formatter) return false
    const duration = Math.max(0, (endDate.getTime() - startDate.getTime()) / 60_000)
    // All-day and multi-day events are not courses on a weekly slot.
    if (duration >= DAY_MINUTES) return false
    const parts = formatter.formatToParts(startDate)
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''
    const day = WEEKDAYS[part('weekday')]
    const start = Number(part('hour')) * 60 + Number(part('minute'))
    const end = start + duration
    // A course that overlaps the slot is hidden, even if only in part.
    return slots.some(s => s.day === day && start < s.end && end > s.start)
  }

  return (event: { title: string, summary: string, startDate: Date, endDate: Date, location: string, description: string, rawLocation?: string, rawDescription?: string }) => {
    if (hidden.size > 0 && hidden.has(hiddenEventKey(event.title, event.startDate))) return true
    return includesAny([event.summary], rules.blocklist)
      || includesAny([event.description, event.rawDescription ?? ''], rules.teachers)
      || includesAny([event.location, event.rawLocation ?? ''], rules.rooms)
      || inSlot(event.startDate, event.endDate)
  }
}
