import type { CalEvent, FetchEventsDetailedResult } from '@api/utils/events'
import { fetchWithTimeout } from '@api/utils/http'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Some ADE installs expose no working anonymous iCal export: `anonymous_cal.jsp`
 * answers "Le projet est invalide" for every id. On those, the only channel that
 * serves events without a login is the legacy RSS module, reached through a guest
 * session:
 *
 *   GET anonymous_cal.jsp   -> mints a guest JSESSIONID (the error body is ignored)
 *   GET /jsp/rss?...        -> the events, as RSS, for the resources passed
 *
 * One guest cookie serves every group of an install, so we mint it once and reuse it.
 * The stored planning URL is the real `/jsp/rss?...` URL; the matching JSON file is
 * built by a generator under scripts/.
 */

// ADE RSS gives wall-clock times with no zone. Every ADE install we read is a French
// university, so interpret them in Europe/Paris. Revisit if a non-French one is added.
const TIMEZONE = 'Europe/Paris'
const SESSION_TTL_MS = 10 * 60 * 1000

const ITEM_RE = /<item>([\s\S]*?)<\/item>/g
const GUID_RE = /<guid>([^<]*)<\/guid>/
const TITLE_RE = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/
const DESC_RE = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/
// "07/09/2026 10h00 - 12h00"
const WHEN_RE = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})/
// A room: "Amphi 1", "A108", "B204", "V-B23".
const ROOM_RE = /^(?:amphi\b|[a-z]{1,2}-?\d{1,3}[a-z]?$)/i
// A teacher: "DURAND Alice" (upper-case surname, then a capitalised first name).
const TEACHER_RE = /^\p{Lu}[\p{Lu}'’-]+(?:\s+[\p{Lu}'’-]+)*\s+\p{Lu}\p{Ll}/u

export function isAdeRssUrl(url: string): boolean {
  try {
    return new URL(url).pathname === '/jsp/rss'
  } catch {
    return false
  }
}

/** Pull the resource lines that follow "Ressources" out of an item description. */
function resourceLines(description: string): string[] {
  const after = description.split(/Ressources\s*<\/b>/i)[1] ?? ''
  return after
    .split(/<br\s*\/?>/i)
    .map(line => line.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, '\'').trim())
    .filter(Boolean)
}

/** Parse an ADE RSS feed into calendar events. Pure, so it is unit tested directly. */
export function parseAdeRss(xml: string): CalEvent[] {
  const events: CalEvent[] = []

  for (const [, block] of xml.matchAll(ITEM_RE)) {
    const summary = block!.match(TITLE_RE)?.[1]?.trim() ?? ''
    const description = block!.match(DESC_RE)?.[1] ?? ''
    const guid = block!.match(GUID_RE)?.[1]?.trim() ?? ''

    const when = description.match(WHEN_RE)
    if (!when) continue // no date/time, nothing we can place on a calendar

    const [, dd, mm, yyyy, sh, smin, eh, emin] = when
    const start = dayjs.tz(`${yyyy}-${mm}-${dd} ${sh!.padStart(2, '0')}:${smin}`, TIMEZONE)
    const end = dayjs.tz(`${yyyy}-${mm}-${dd} ${eh!.padStart(2, '0')}:${emin}`, TIMEZONE)
    if (!start.isValid() || !end.isValid()) continue

    const lines = resourceLines(description)
    const rooms = lines.filter(l => ROOM_RE.test(l))
    const teachers = lines.filter(l => TEACHER_RE.test(l) && !ROOM_RE.test(l))

    events.push({
      // guid repeats across occurrences of a course, so key on the start too.
      uid: `ade-rss-${guid}-${start.valueOf()}`,
      summary,
      startDate: start.toDate(),
      endDate: end.toDate(),
      location: rooms.join(', '),
      description: teachers.join(', '),
    })
  }

  return events
}

// A guest cookie is only valid for the install that minted it, so cache per origin.
const sessions = new Map<string, { cookie: string, at: number }>()
const bootstrapping = new Map<string, Promise<string | null>>()

async function mintSession(origin: string, projectId: string): Promise<string | null> {
  const boot = await fetchWithTimeout(
    `${origin}/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=1&projectId=${projectId}&calType=ical&nbWeeks=4`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  )
  const set = boot.headers?.getSetCookie().find(c => c.startsWith('JSESSIONID='))
  if (!set) return null
  const cookie = set.split(';')[0]!
  sessions.set(origin, { cookie, at: Date.now() })
  return cookie
}

/**
 * Mint (or reuse) a guest JSESSIONID by hitting the anonymous export once. Concurrent
 * callers share a single bootstrap per origin, so a batch refresh does not flood the
 * ADE server.
 */
async function ensureSession(origin: string, projectId: string): Promise<{ cookie: string | null, fresh: boolean }> {
  const current = sessions.get(origin)
  if (current && Date.now() - current.at < SESSION_TTL_MS) return { cookie: current.cookie, fresh: false }
  let boot = bootstrapping.get(origin)
  if (!boot) {
    boot = mintSession(origin, projectId).finally(() => {
      bootstrapping.delete(origin)
    })
    bootstrapping.set(origin, boot)
  }
  return { cookie: await boot, fresh: true }
}

async function fetchRss(url: string, jar: string): Promise<{ ok: boolean, body: string | null }> {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'cookie': jar } })
  return { ok: res.ok, body: res.data }
}

/** Fetch and parse an ADE RSS planning, minting a guest session and retrying once. */
export async function fetchAdeRssEvents(url: string): Promise<FetchEventsDetailedResult> {
  let origin: string
  let projectId: string
  try {
    const parsed = new URL(url)
    origin = parsed.origin
    projectId = parsed.searchParams.get('projectId') ?? '1'
  } catch {
    return { events: null, failure: { kind: 'invalid_body', status: 0, code: null, retryAfterMs: null, message: 'bad_url' } }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { cookie: jar, fresh } = await ensureSession(origin, projectId)
    if (!jar) {
      return { events: null, failure: { kind: 'network_error', status: null, code: null, retryAfterMs: null, message: 'no_session' } }
    }

    const { ok, body } = await fetchRss(url, jar)
    if (!ok) {
      return { events: null, failure: { kind: 'http_5xx', status: 502, code: null, retryAfterMs: null, message: null } }
    }

    if (body && body.includes('<item>')) {
      return { events: parseAdeRss(body), failure: null }
    }

    // A reused cookie may have lapsed server-side: drop it and try one fresh mint. A
    // cookie we just minted returning no <item> means the group is genuinely empty, so
    // stop and report an empty (valid) schedule rather than re-minting.
    if (fresh) break
    sessions.delete(origin)
  }

  return { events: [], failure: null }
}

export const __adeRss = {
  reset() {
    sessions.clear()
    bootstrapping.clear()
  },
}
