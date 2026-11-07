import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { flattenedPlannings } from '@api/plannings'
import { buildIcsCalendar, FixedWindowRateLimiter, TtlCache } from '@api/utils/ics'
import { hiddenEventKey } from '@libs/event-filters'

import { getApiDbMockStores, installApiDbMock, resetApiDbMockStores } from './helpers/api-db-mock'

// Minimal reader: enough to check what the feed contains without a parser dependency.
function parseVevents(body: string) {
  const unfolded = body.replace(/\r\n[ \t]/g, '')
  return unfolded.split('BEGIN:VEVENT').slice(1).map((block) => {
    const prop = (name: string) => block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'm'))?.[1]?.trim()
    return { uid: prop('UID'), summary: prop('SUMMARY'), description: prop('DESCRIPTION'), dtstart: prop('DTSTART') }
  })
}

describe('buildIcsCalendar', () => {
  const base = {
    uid: 'evt-1',
    summary: 'Math, CM; Algebra',
    startDate: new Date('2025-01-01T10:00:00Z'),
    endDate: new Date('2025-01-01T12:00:00Z'),
    location: 'Amphi A',
    description: 'Line 1\nLine 2',
  }

  it('writes a valid calendar with UTC times and escaped text', () => {
    const body = buildIcsCalendar({ name: 'Test', refreshIntervalSeconds: 300, events: [base] })
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('X-WR-CALNAME:Test')
    expect(body).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT5M')
    expect(body).toContain('DTSTART:20250101T100000Z')

    const [event] = parseVevents(body)
    expect(event!.summary).toBe('Math\\, CM\\; Algebra')
    expect(event!.description).toBe('Line 1\\nLine 2')
    expect(body).toContain('\r\n')
  })

  it('writes an event shared by 2 plannings once, and keeps UIDs unique', () => {
    const moved = { ...base, startDate: new Date('2025-01-02T10:00:00Z'), endDate: new Date('2025-01-02T12:00:00Z') }
    const body = buildIcsCalendar({ name: 'Test', refreshIntervalSeconds: 0, events: [base, { ...base }, moved] })
    const uids = parseVevents(body).map(e => e.uid)
    expect(uids).toHaveLength(2)
    expect(new Set(uids).size).toBe(2)
    expect(body).not.toContain('REFRESH-INTERVAL')
  })
})

describe('TtlCache and FixedWindowRateLimiter', () => {
  it('expires cache entries and caps the size', () => {
    const cache = new TtlCache<number>(1000, 2)
    cache.set('a', 1, 0)
    cache.set('b', 2, 0)
    cache.set('c', 3, 0)
    expect(cache.size).toBe(2)
    expect(cache.get('a', 0)).toBeUndefined()
    expect(cache.get('c', 999)).toBe(3)
    expect(cache.get('c', 1000)).toBeUndefined()
  })

  it('caps the total weight of the values', () => {
    const cache = new TtlCache<string>(1000, 10, { maxWeight: 5, weigh: s => s.length })
    cache.set('a', 'aaa', 0)
    cache.set('b', 'bb', 0)
    cache.set('c', 'cc', 0)
    expect(cache.get('a', 0)).toBeUndefined()
    expect(cache.get('b', 0)).toBe('bb')
    cache.set('d', 'dddddd', 0)
    expect(cache.get('d', 0)).toBeUndefined()
  })

  it('limits hits per window and resets after it', () => {
    const limiter = new FixedWindowRateLimiter(2, 1000)
    expect(limiter.hit('ip', 0)).toBe(0)
    expect(limiter.hit('ip', 10)).toBe(0)
    expect(limiter.hit('ip', 20)).toBe(980)
    expect(limiter.hit('other', 20)).toBe(0)
    expect(limiter.hit('ip', 1000)).toBe(0)
  })

  it('never limits when the limit is 0', () => {
    const limiter = new FixedWindowRateLimiter(0, 1000)
    for (let i = 0; i < 100; i++) expect(limiter.hit('ip', 0)).toBe(0)
  })
})

describe('GET /ics', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any
  let resetRoute: () => void
  let backupStore: ReturnType<typeof getApiDbMockStores>['backupStore']

  const leaves = flattenedPlannings.filter(p => Boolean(p.url)).slice(-2)
  const [first, second] = leaves as [typeof leaves[number], typeof leaves[number]]
  const originalUrls = [first.url, second.url]
  const urls = { ok: 'http://localhost/__fake_ics_ok__', error: 'http://localhost/__fake_ics_error__' }

  const originalFetch = globalThis.fetch
  let fetchCount = 0

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanningSup Test//EN',
    'BEGIN:VEVENT',
    'UID:evt-1',
    'DTSTAMP:20250101T100000Z',
    'DTSTART:20250101T100000Z',
    'DTEND:20250101T120000Z',
    'SUMMARY:Math CM',
    'LOCATION:Amphi A',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:evt-2',
    'DTSTAMP:20250102T080000Z',
    'DTSTART:20250102T080000Z',
    'DTEND:20250102T100000Z',
    'SUMMARY:Programming TP',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  function get(query: string) {
    return app.handle(new Request(`http://local/ics?${query}`))
  }

  beforeAll(async () => {
    Bun.env.RUN_JOBS = 'false'
    Bun.env.NODE_ENV = 'test'
    installApiDbMock()
    resetApiDbMockStores()
    ;({ backupStore } = getApiDbMockStores())

    // @ts-expect-error bun types
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === urls.ok) {
        fetchCount++
        return new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar' } })
      }
      if (url === urls.error) return new Response('error', { status: 500 })
      return originalFetch(input as any, init)
    }

    const route = await import('@api/routes/ics')
    resetRoute = route.__test.reset
    app = new Elysia().use(route.default)
  })

  beforeEach(() => {
    resetRoute()
    fetchCount = 0
    ;(first as any).url = urls.ok
    ;(second as any).url = urls.ok
    backupStore[first.fullId] = undefined
    backupStore[second.fullId] = undefined
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
    ;(first as any).url = originalUrls[0]
    ;(second as any).url = originalUrls[1]
  })

  it('skips unknown plannings when at least one planning exists', async () => {
    const res = await get(`p=${encodeURIComponent(`does.not.exist,${first.fullId}`)}`)
    expect(res.status).toBe(200)
    expect(parseVevents(await res.text()).map(e => e.uid).sort()).toEqual(['evt-1', 'evt-2'])
  })

  it('rejects a missing or unknown planning list', async () => {
    expect((await get('')).status).toBe(400)
    const res = await get('p=does.not.exist')
    expect(res.status).toBe(404)
    expect((await res.json()).plannings).toEqual(['does.not.exist'])
  })

  it('returns the events of the selected plannings as ICS', async () => {
    const res = await get(`p=${encodeURIComponent(`${first.fullId},${second.fullId}`)}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    // Both plannings share the same events, so each one is written once.
    expect(parseVevents(await res.text()).map(e => e.uid).sort()).toEqual(['evt-1', 'evt-2'])
  })

  it('applies the blocklist', async () => {
    const res = await get(`p=${encodeURIComponent(first.fullId)}&blocklist=math`)
    expect(parseVevents(await res.text()).map(e => e.summary)).toEqual(['Programming TP'])
  })

  it('applies the other course filters', async () => {
    const uids = async (query: string) => parseVevents(await (await get(`p=${encodeURIComponent(first.fullId)}&${query}`)).text()).map(e => e.uid)
    // The room is matched on the cleaned location, the one users see.
    expect(await uids('rooms=amphi')).toEqual(['evt-2'])
    expect(await uids(`hidden=${hiddenEventKey('Programming TP', new Date('2025-01-02T08:00:00Z'))}`)).toEqual(['evt-1'])
    // Wednesday 1 January 2025, 11:00 to 13:00 in Paris
    expect(await uids('slots=3-1200-1400')).toEqual(['evt-2'])
    expect(await uids('slots=3-1200-1400&tz=UTC')).toEqual(['evt-1', 'evt-2'])
  })

  it('caches events per planning', async () => {
    await get(`p=${encodeURIComponent(first.fullId)}`)
    await get(`p=${encodeURIComponent(first.fullId)}&blocklist=math`)
    await get(`p=${encodeURIComponent(first.fullId)}`)
    expect(fetchCount).toBe(1)
  })

  it('returns 503 when a planning has no events at all', async () => {
    ;(second as any).url = urls.error
    const res = await get(`p=${encodeURIComponent(`${first.fullId},${second.fullId}`)}`)
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('300')
    expect((await res.json()).plannings).toEqual([second.fullId])
  })

  it('falls back to the backup when the network fails', async () => {
    ;(first as any).url = urls.error
    backupStore[first.fullId] = {
      events: [{ uid: 'backup-1', summary: 'Backup', startDate: new Date('2025-01-01T10:00:00Z'), endDate: new Date('2025-01-01T11:00:00Z'), location: '', description: '' }],
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    }
    const res = await get(`p=${encodeURIComponent(first.fullId)}`)
    expect(res.status).toBe(200)
    expect(parseVevents(await res.text()).map(e => e.uid)).toEqual(['backup-1'])
  })
})
