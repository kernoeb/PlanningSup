import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshStateTable } from '@api/db/schemas/plannings'
import { fetchWithTimeout } from '@api/utils/http'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { eq } from 'drizzle-orm'
import icalJs from 'ical.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const dateStartTemplate = '{date-start}'
const dateEndTemplate = '{date-end}'

const includesTemplate = (v: string) => v && (v.includes(dateStartTemplate) || v.includes(dateEndTemplate))

const randomString = () => crypto.randomUUID()

export interface CalEvent {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

export type FetchFailureKind
  = 'timeout'
    | 'connection_refused'
    | 'network_error'
    | 'http_429'
    | 'http_4xx'
    | 'http_5xx'
    | 'invalid_body'
    | 'parse_error'

export interface FetchFailure {
  kind: FetchFailureKind
  status: number | null
  code: string | null
  retryAfterMs: number | null
  message: string | null
}

export interface FetchEventsDetailedResult {
  events: CalEvent[] | null
  failure: FetchFailure | null
}

export interface RangeOptions {
  from?: string
  to?: string
}

// Request deduplication: collapse concurrent fetches for the same planning
const inflight = new Map<string, Promise<FetchEventsDetailedResult>>()

function parseRetryAfterMs(headers: Headers | undefined): number | null {
  if (!headers) return null
  const raw = headers.get('retry-after')
  if (!raw) return null

  const secs = Number(raw)
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000)

  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now())
  }

  return null
}

function classifyNetworkError(error: { name: string, code: string | null, message: string }): FetchFailureKind {
  if (error.name === 'TimeoutError') return 'timeout'
  if (error.code === 'ConnectionRefused') return 'connection_refused'
  return 'network_error'
}

export async function fetchEventsDetailed(url: string, range?: RangeOptions): Promise<FetchEventsDetailedResult> {
  if (includesTemplate(url)) {
    const from = range?.from || dayjs().subtract(1, 'month').format('YYYY-MM-DD')
    const to = range?.to || dayjs().add(2, 'year').format('YYYY-MM-DD')

    url = url
      .replace(
        dateStartTemplate,
        encodeURIComponent(from),
      )
      .replace(
        dateEndTemplate,
        encodeURIComponent(to),
      )
  }

  const res = await fetchWithTimeout(url)
  const { data, ok, status, headers } = res

  if (!ok) {
    // Network error (status=0) vs HTTP error (status>0)
    if (status === 0) {
      const err = res.error
      return {
        events: null,
        failure: err
          ? {
              kind: classifyNetworkError(err),
              status: null,
              code: err.code,
              retryAfterMs: null,
              message: err.message,
            }
          : {
              kind: 'network_error',
              status: null,
              code: null,
              retryAfterMs: null,
              message: null,
            },
      }
    }

    const retryAfterMs = parseRetryAfterMs(headers)
    if (status === 429) {
      return {
        events: null,
        failure: {
          kind: 'http_429',
          status,
          code: null,
          retryAfterMs,
          message: null,
        },
      }
    }

    if (status >= 500 && status <= 599) {
      return {
        events: null,
        failure: {
          kind: 'http_5xx',
          status,
          code: null,
          retryAfterMs: null,
          message: null,
        },
      }
    }

    return {
      events: null,
      failure: {
        kind: 'http_4xx',
        status,
        code: null,
        retryAfterMs: null,
        message: null,
      },
    }
  }

  if (!data || !data.length) {
    return { events: null, failure: { kind: 'invalid_body', status, code: null, retryAfterMs: null, message: 'empty_body' } }
  }

  if (data.includes('500 Internal Server Error') || data.includes('<!DOCTYPE ')) { // Yeah, that's perfectible
    return { events: null, failure: { kind: 'invalid_body', status, code: null, retryAfterMs: null, message: 'html_or_500_body' } }
  }

  try {
    const comp = new icalJs.Component(icalJs.parse(data))

    const vEvents = comp.getAllSubcomponents('vevent')

    const allEvents: CalEvent[] = []

    for (const vEvent of vEvents) {
      const tmpEvent = new icalJs.Event(vEvent)
      allEvents.push({
        uid: tmpEvent.uid || randomString(),
        summary: tmpEvent.summary || '',
        startDate: tmpEvent.startDate.toJSDate(),
        endDate: tmpEvent.endDate.toJSDate(),
        location: tmpEvent.location || '',
        description: tmpEvent.description || '',
      })
    }

    return { events: allEvents, failure: null }
  } catch {
    return { events: null, failure: { kind: 'parse_error', status, code: null, retryAfterMs: null, message: null } }
  }
}

export async function fetchEvents(url: string): Promise<CalEvent[] | null> {
  return (await fetchEventsDetailed(url)).events
}

export interface BackupEventsResult {
  events: CalEvent[]
  refreshedAt: Date
  updatedAt: Date
}

export async function getBackupEvents(planningFullId: string): Promise<BackupEventsResult | null> {
  try {
    const [backup, refreshState] = await Promise.all([
      db.query.planningsBackupTable
        .findFirst({
          where: eq(planningsBackupTable.planningFullId, planningFullId),
          columns: { events: true, updatedAt: true },
        })
        .catch(() => undefined),
      db.query.planningsRefreshStateTable
        .findFirst({
          where: eq(planningsRefreshStateTable.planningFullId, planningFullId),
          columns: { lastSuccessAt: true },
        })
        .catch(() => undefined),
    ])

    if (!backup) return null

    // "refreshedAt" = last successful fetch attempt (worker or UI), even if events didn't change.
    // Fallback to backup.updatedAt for legacy rows with no refresh_state.
    const refreshedAt = refreshState?.lastSuccessAt ?? backup.updatedAt

    return {
      events: backup.events,
      refreshedAt,
      updatedAt: backup.updatedAt,
    }
  } catch {
    return null
  }
}

function getDate(date: Date, localeUtils: { target: string, browser: string } | null) {
  if (!localeUtils || !localeUtils.target || !localeUtils.browser) return date

  try {
    const tmpDate = dayjs(date) // from JS Date
      .tz(localeUtils.target) // interpret in target zone
      .tz(localeUtils.browser, true) // true = keepLocalTime

    return tmpDate.toDate()
  } catch {
    return date
  }
}

function checkHighlightTeacher(id: string, event: CalEvent) {
  // Special case for IUT Nantes
  if (id.startsWith('iut-de-nantes.info')) return event.description.includes('Matière : ') && !event.description.includes('Personnel : ')

  // Special case for IUT Vannes
  if (id.startsWith('iut-de-vannes.butdutinfo')) {
    let slicedDescription = event.description
    if (event.description.slice(-28, -20) === 'Exported') {
      slicedDescription = event.description.slice(0, -29)
    }
    return !slicedDescription.match(/.*[a-z].*/) && !event.summary.toLowerCase().includes('amphi') && !event.location.toLowerCase().includes('amphi')
  }

  return false
}

function cleanName(name: string) {
  return (name && name.replace(/([A-Z])\?([A-Z])/gi, (_, b, c) => `${b}'${c}`).trim()) || ''
}
function getCategoryId(id: string, event: CalEvent, options: {
  highlightTeacher?: boolean
}) {
  if (options.highlightTeacher && checkHighlightTeacher(id, event)) {
    return 'no-teacher'
  } else if (/\bCM\b/.test(event.summary) || event.summary.toUpperCase().includes('AMPHI') || event.location.toUpperCase().includes('AMPHI')) {
    return 'lecture'
  } else if (/\bTP\d*\b/.test(event.summary) || event.summary.includes('TPi') || event.summary.includes('TDi') || event.summary.trim().match(/\sG\d\.\d$/)) {
    return 'lab'
  } else if ((/\bTD\b/.test(event.summary) || event.location.includes('V-B') || event.summary.trim().match(/\sG\d$/)) && !/^S\d\.\d\d/.test(event.summary) && !/contr[ôo]le/i.test(event.summary)) {
    return 'tutorial'
  } else {
    return 'other'
  }
}

function cleanLocation(l: string) {
  return l.trim()
    .replace('salle joker à distance', 'À distance')
    .replace(/(?:\.\.\. MOODLE,)?\.\.a Séance à distance asynchrone-/, 'À distance')
    .split(',')
    .map(v => v.replace(/^V-/, ''))
    .join(', ')
}

function cleanDescription(d: string) {
  return d
    .replace(/Grp \d/g, '')
    .replace(/GR \d.?\d?/g, '')
    .replace(/LP (DLIS|CYBER)/g, '')
    .replace(/\(Exporté.*\)/, '')
    .replace(/\(Exported :.*\)/, '')
    .replace(/\(Updated :.*\)/, '')
    .replace(/\(Modifié le:.*\)/, '')
    .replace(/^\s+-/, '')
    .trim()
}

function isRemoteLocation(location: string) {
  return /à distance$|EAD/.test(location.trim())
}

export function getFormattedEvents(id: string, eventsList: CalEvent[], options: {
  localeUtils: { target: string, browser: string } | null
  blocklist: string[]
  highlightTeacher: boolean
  range?: RangeOptions
}) {
  const events: (CalEvent & {
    categoryId: string
    remoteLocation: boolean
  })[] = []

  const fromDate = options.range?.from ? dayjs(options.range.from).startOf('day') : null
  const toDate = options.range?.to ? dayjs(options.range.to).endOf('day') : null

  for (const event of eventsList) {
    if (fromDate && dayjs(event.endDate).isBefore(fromDate)) continue
    if (toDate && dayjs(event.startDate).isAfter(toDate)) continue

    if (!options.blocklist.some(str => event.summary.toLowerCase().includes(str))) {
      events.push({
        uid: event.uid,
        summary: cleanName(event.summary),
        startDate: getDate(event.startDate, options.localeUtils),
        endDate: getDate(event.endDate, options.localeUtils),
        categoryId: getCategoryId(id, event, { highlightTeacher: options.highlightTeacher }),
        location: cleanLocation(event.location),
        description: cleanDescription(event.description),
        remoteLocation: isRemoteLocation(event.location),
      })
    }
  }

  return events
}

// Types for event resolution
export type EventsSource = 'db' | 'network' | 'none'
export type FailureReason = 'network_error' | 'no_data' | 'empty_schedule'

export interface ResolveEventsResult {
  events: CalEvent[] | null
  source: EventsSource
  networkFailed: boolean
  backupRefreshedAt: Date | null
  backupUpdatedAt: Date | null
  networkFailure: FetchFailure | null
}

/**
 * Resolve events for a planning.
 * @param planning - The planning object.
 * @param planning.url - The URL of the planning.
 * @param planning.fullId - The full ID of the planning.
 * @param onlyDb - Whether to only use the database.
 * @param range - Optional date range for filtering.
 * @returns The events for the planning, their source, and whether network failed.
 */
export async function resolveEvents(planning: { url: string, fullId: string }, onlyDb: boolean, range?: RangeOptions): Promise<ResolveEventsResult> {
  if (onlyDb) {
    const backup = await getBackupEvents(planning.fullId)
    return {
      events: backup ? backup.events : null,
      source: backup ? 'db' : 'none',
      networkFailed: false,
      backupRefreshedAt: backup ? backup.refreshedAt : null,
      backupUpdatedAt: backup ? backup.updatedAt : null,
      networkFailure: null,
    }
  }

  // Dedupe concurrent fetches for the same planning + range
  const inflightKey = range ? `${planning.fullId}-${range.from}-${range.to}` : planning.fullId
  let netPromise = inflight.get(inflightKey)
  const isCoalesced = !!netPromise
  if (!netPromise) {
    netPromise = fetchEventsDetailed(planning.url, range)
    inflight.set(inflightKey, netPromise)
  }

  let net: FetchEventsDetailedResult
  try {
    net = await netPromise
  } finally {
    // Only the original requester cleans up
    if (!isCoalesced) {
      inflight.delete(inflightKey)
    }
  }

  if (net.events) {
    return { events: net.events, source: 'network', networkFailed: false, backupRefreshedAt: null, backupUpdatedAt: null, networkFailure: null }
  }

  // Network failed, try DB fallback
  const backup = await getBackupEvents(planning.fullId)
  return {
    events: backup ? backup.events : null,
    source: backup ? 'db' : 'none',
    networkFailed: true,
    backupRefreshedAt: backup ? backup.refreshedAt : null,
    backupUpdatedAt: backup ? backup.updatedAt : null,
    networkFailure: net.failure,
  }
}

/**
 * Determine the failure reason based on resolution result.
 */
export function getFailureReason(result: ResolveEventsResult, nbEvents: number): FailureReason | null {
  // Network succeeded with events - no failure
  if (result.source === 'network' && nbEvents > 0) {
    return null
  }

  // Network succeeded but no events - empty schedule
  if (result.source === 'network' && nbEvents === 0) {
    return 'empty_schedule'
  }

  // Network failed but DB has events - network error with fallback
  if (result.networkFailed && result.source === 'db' && nbEvents > 0) {
    return 'network_error'
  }

  // Network failed and no data anywhere
  if (result.networkFailed && result.source === 'none') {
    return 'no_data'
  }

  // Network failed, DB returned but empty
  if (result.networkFailed && result.source === 'db' && nbEvents === 0) {
    return 'no_data'
  }

  // onlyDb mode with no data
  if (!result.networkFailed && result.source === 'none') {
    return 'no_data'
  }

  // onlyDb mode with empty data
  if (!result.networkFailed && result.source === 'db' && nbEvents === 0) {
    return 'empty_schedule'
  }

  return null
}

export const __test = {
  reset() {
    if (Bun.env.NODE_ENV !== 'test') return
    inflight.clear()
  },
  inflightSize() {
    return inflight.size
  },
}
