import icalJs from 'ical.js'

export interface IcsEvent {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

/**
 * Build an iCalendar (RFC 5545) document from events. All times are written in UTC.
 * The same event in 2 selected plannings (same UID and times) is written once.
 */
export function buildIcsCalendar(options: {
  name: string
  refreshIntervalSeconds: number
  events: IcsEvent[]
  now?: Date
}) {
  const calendar = new icalJs.Component(['vcalendar', [], []])
  calendar.updatePropertyWithValue('version', '2.0')
  calendar.updatePropertyWithValue('prodid', '-//PlanningSup//PlanningSup//FR')
  calendar.updatePropertyWithValue('calscale', 'GREGORIAN')
  calendar.updatePropertyWithValue('method', 'PUBLISH')
  calendar.updatePropertyWithValue('x-wr-calname', options.name)

  // Hints for calendar apps on how often to poll the feed. Most apps enforce their own minimum.
  if (options.refreshIntervalSeconds > 0) {
    const duration = icalJs.Duration.fromSeconds(options.refreshIntervalSeconds)
    calendar.updatePropertyWithValue('refresh-interval', duration)
    calendar.updatePropertyWithValue('x-published-ttl', duration.toString())
  }

  const dtstamp = icalJs.Time.fromJSDate(options.now ?? new Date(), true)
  const eventKey = (event: IcsEvent) => `${event.uid}|${event.startDate.getTime()}|${event.endDate.getTime()}`

  // A UID must be unique in a calendar. Every copy of a reused UID gets a suffix,
  // so the UIDs stay the same when the upstream order changes.
  const keysByUid = new Map<string, Set<string>>()
  for (const event of options.events) {
    const keys = keysByUid.get(event.uid) ?? new Set()
    keys.add(eventKey(event))
    keysByUid.set(event.uid, keys)
  }

  const written = new Set<string>()
  for (const event of options.events) {
    const key = eventKey(event)
    if (written.has(key)) continue
    written.add(key)

    const uid = keysByUid.get(event.uid)!.size > 1 ? `${event.uid}-${event.startDate.getTime()}-${event.endDate.getTime()}` : event.uid

    const vevent = new icalJs.Component('vevent')
    vevent.updatePropertyWithValue('uid', uid)
    vevent.updatePropertyWithValue('dtstamp', dtstamp)
    vevent.updatePropertyWithValue('dtstart', icalJs.Time.fromJSDate(event.startDate, true))
    vevent.updatePropertyWithValue('dtend', icalJs.Time.fromJSDate(event.endDate, true))
    vevent.updatePropertyWithValue('summary', event.summary)
    if (event.location) vevent.updatePropertyWithValue('location', event.location)
    if (event.description) vevent.updatePropertyWithValue('description', event.description)
    calendar.addSubcomponent(vevent)
  }

  return `${calendar.toString()}\r\n`
}

/**
 * In-memory cache with a time to live and a maximum size (oldest entries go first).
 * `weigh` and `maxWeight` also cap the total weight of the values, for example their length.
 */
export class TtlCache<T> {
  private entries = new Map<string, { value: T, weight: number, expiresAt: number }>()
  private totalWeight = 0
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly maxWeight: number
  private readonly weigh: (value: T) => number

  constructor(ttlMs: number, maxEntries: number, options: { maxWeight?: number, weigh?: (value: T) => number } = {}) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this.maxWeight = options.maxWeight ?? Infinity
    this.weigh = options.weigh ?? (() => 0)
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= now) {
      this.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, now = Date.now()) {
    if (this.ttlMs <= 0) return
    const weight = this.weigh(value)
    if (weight > this.maxWeight) return
    this.delete(key)
    if (this.entries.size >= this.maxEntries || this.totalWeight + weight > this.maxWeight) this.prune(now, weight)
    this.entries.set(key, { value, weight, expiresAt: now + this.ttlMs })
    this.totalWeight += weight
  }

  clear() {
    this.entries.clear()
    this.totalWeight = 0
  }

  get size() {
    return this.entries.size
  }

  private delete(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return
    this.entries.delete(key)
    this.totalWeight -= entry.weight
  }

  private prune(now: number, incomingWeight: number) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.delete(key)
    }
    for (const [key] of this.entries) {
      if (this.entries.size < this.maxEntries && this.totalWeight + incomingWeight <= this.maxWeight) break
      this.delete(key)
    }
  }
}

/** Fixed-window rate limiter keyed by client (usually the IP address). */
export class FixedWindowRateLimiter {
  private windows = new Map<string, { count: number, resetAt: number }>()
  private readonly limit: number
  private readonly windowMs: number
  private readonly maxKeys: number

  constructor(limit: number, windowMs: number, maxKeys = 10_000) {
    this.limit = limit
    this.windowMs = windowMs
    this.maxKeys = maxKeys
  }

  /** Returns 0 when the request is allowed, or the number of milliseconds to wait. */
  hit(key: string, now = Date.now()): number {
    if (this.limit <= 0) return 0

    const current = this.windows.get(key)
    if (!current || current.resetAt <= now) {
      if (!current && this.windows.size >= this.maxKeys) this.prune(now)
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs })
      return 0
    }

    if (current.count >= this.limit) return current.resetAt - now
    current.count++
    return 0
  }

  clear() {
    this.windows.clear()
  }

  private prune(now: number) {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key)
    }
    // Still full: every key is active, so drop the oldest ones.
    for (const [key] of this.windows) {
      if (this.windows.size < this.maxKeys) break
      this.windows.delete(key)
    }
  }
}
