import type { CalEvent } from '@api/utils/events'
import config from '@api/config'
import { flattenedPlannings, plannings } from '@api/plannings'
import { getFormattedEvents, resolveEvents } from '@api/utils/events'
import { buildIcsCalendar, FixedWindowRateLimiter, TtlCache } from '@api/utils/ics'
import { elysiaLogger } from '@api/utils/logger'
import { keepPlanningBackupFresh } from '@api/utils/plannings-backup'
import { Elysia, t } from 'elysia'

export const MAX_ICS_PLANNINGS = 50

const cacheTtlMs = config.ics.cacheTtl * 1000

// Events are cached per planning, so upstream calls stay bounded whatever combination is asked.
const eventsCache = new TtlCache<CalEvent[]>(cacheTtlMs, 2000)
// The blocklist makes feed keys unbounded, so also cap the total length of cached feeds.
const feedCache = new TtlCache<string>(cacheTtlMs, 1000, { maxWeight: 200_000_000, weigh: body => body.length })
const rateLimiter = new FixedWindowRateLimiter(config.ics.rateLimit, 60_000)

const planningsById = new Map(flattenedPlannings.map(p => [p.fullId, p]))
const rootTitles = new Map(plannings.map(p => [p.id, p.title]))

function getClientIp(request: Request, server: { requestIP: (request: Request) => { address: string } | null } | null) {
  // Behind the reverse proxy, the socket address is the proxy itself.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || server?.requestIP(request)?.address || 'unknown'
}

async function getPlanningEvents(planning: { url: string, fullId: string }) {
  const cached = eventsCache.get(planning.fullId)
  if (cached) return cached

  const result = await resolveEvents(planning, false)
  keepPlanningBackupFresh(planning.fullId, result)
  if (result.events) eventsCache.set(planning.fullId, result.events)
  return result.events
}

function parseList(raw: string | undefined, lowercase = false) {
  const values = (raw ?? '').split(',').map(s => (lowercase ? s.trim().toLowerCase() : s.trim())).filter(s => s.length > 0)
  return [...new Set(values)].sort()
}

export default new Elysia({ prefix: '/ics', tags: ['Plannings'] })
  .get('/', async ({ query, request, server, status, set }) => {
    const fullIds = parseList(query.p)
    if (fullIds.length === 0) return status(400, { error: 'Missing plannings (?p=id1,id2)' })
    if (fullIds.length > MAX_ICS_PLANNINGS) return status(400, { error: `Too many plannings (max ${MAX_ICS_PLANNINGS})` })

    const unknown = fullIds.filter(id => !planningsById.has(id))
    if (unknown.length > 0) return status(404, { error: 'Planning not found', plannings: unknown })

    const blocklist = parseList(query.blocklist, true)
    const cacheKey = `${fullIds.join(',')}|${blocklist.join(',')}`
    const icsHeaders = {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="planningsup.ics"',
      'cache-control': `public, max-age=${config.ics.cacheTtl}`,
    }

    const cachedFeed = feedCache.get(cacheKey)
    if (cachedFeed) return new Response(cachedFeed, { headers: icsHeaders })

    // Only uncached feeds count: Google and Outlook poll every subscriber's feed from a few shared IPs.
    const waitMs = rateLimiter.hit(getClientIp(request, server))
    if (waitMs > 0) {
      set.headers['retry-after'] = String(Math.ceil(waitMs / 1000))
      return status(429, { error: 'Too many requests' })
    }

    const selected = fullIds.map(id => planningsById.get(id)!)
    const results = await Promise.all(selected.map(getPlanningEvents))

    // A partial feed would make calendar apps delete the missing events, so fail instead.
    // Apps keep their last copy and try again later.
    const failed = selected.filter((_, i) => !results[i]).map(p => p.fullId)
    if (failed.length > 0) {
      elysiaLogger.warn('ICS feed unavailable, no events for {failed}', { failed })
      set.headers['retry-after'] = '300'
      return status(503, { error: 'Events unavailable for some plannings', plannings: failed })
    }

    const events = selected.flatMap((planning, i) => getFormattedEvents(planning.id, results[i]!, {
      blocklist,
      highlightTeacher: false,
      localeUtils: null,
    }))

    const name = selected.length === 1
      ? `${rootTitles.get(selected[0]!.planningId) ?? 'PlanningSup'} - ${selected[0]!.title}`
      : `PlanningSup (${selected.length} plannings)`

    const body = buildIcsCalendar({ name, refreshIntervalSeconds: config.ics.cacheTtl, events })
    feedCache.set(cacheKey, body)

    elysiaLogger.info('Serving ICS feed for {fullIds}: {nbEvents} events', { fullIds, nbEvents: events.length })
    return new Response(body, { headers: icsHeaders })
  }, {
    query: t.Object({
      p: t.Optional(t.String({ description: 'Comma-separated list of full planning IDs' })),
      blocklist: t.Optional(t.String({ description: 'Comma-separated list of keywords to filter out events' })),
    }),
    detail: {
      summary: 'Get plannings as an ICS feed',
      description: `Returns the events of one or more plannings as an iCalendar feed, for calendar apps (Google Calendar, Apple Calendar, Outlook). Results are cached for ICS_CACHE_TTL seconds. Max ${MAX_ICS_PLANNINGS} plannings.`,
    },
  })

export const __test = {
  reset() {
    eventsCache.clear()
    feedCache.clear()
    rateLimiter.clear()
  },
}
