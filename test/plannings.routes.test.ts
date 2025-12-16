import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { Elysia } from 'elysia'
import { treaty } from '@elysiajs/eden'
import { flattenedPlannings } from '@api/plannings'

/**
 * Test goals:
 * - Don't mock utils; import the real utils/events implementation.
 * - Mock only @api/db to avoid requiring a real DB and to provide backup events.
 * - Mock global fetch to serve ICS content for the selected planning URL.
 * - Cover:
 *   - base listing (/plannings)
 *   - info route (/plannings/:fullId)
 *   - events=true with blocklist
 *   - fallback to backup events when ICS fetch fails
 *   - colors and highlightTeacher query flags
 *   - timezone handling via headers and query
 */

type CalEvent = {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

// Sample events used both for ICS and for backup
const sampleEvents: CalEvent[] = [
  {
    uid: 'evt-1',
    summary: 'Math CM - Algebra',
    startDate: new Date('2025-01-01T10:00:00Z'),
    endDate: new Date('2025-01-01T12:00:00Z'),
    location: 'Amphi A',
    description: 'Algebra basics',
  },
  {
    uid: 'evt-2',
    summary: 'Programming TP',
    startDate: new Date('2025-01-02T08:00:00Z'),
    endDate: new Date('2025-01-02T10:00:00Z'),
    location: 'Lab 1',
    description: 'Intro to TP',
  },
  {
    uid: 'evt-3',
    summary: 'History',
    startDate: new Date('2025-01-03T08:00:00Z'),
    endDate: new Date('2025-01-03T09:00:00Z'),
    location: 'Room 42',
    description: 'No math here',
  },
]

// Build a minimal ICS string that ical.js can parse
function buildICS(events: CalEvent[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanningSup Test//EN',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${toICS(e.startDate)}`,
      `DTSTART:${toICS(e.startDate)}`,
      `DTEND:${toICS(e.endDate)}`,
      `SUMMARY:${e.summary}`,
      `LOCATION:${e.location}`,
      `DESCRIPTION:${e.description}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

function toICS(d: Date) {
  // Format as YYYYMMDDTHHmmssZ
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

describe('Plannings routes (no util mocks, fetch+DB mocked)', () => {
  let app: Elysia
  let api: ReturnType<typeof treaty>

  const anyLeaf = flattenedPlannings.find(p => Boolean(p.url)) || flattenedPlannings[0]
  const targetFullId = anyLeaf.fullId
  let targetUrl: string

  const originalFetch = globalThis.fetch
  let fetchMode: 'ok' | 'error' = 'ok'

  // A simple in-memory backup "DB"
  const backupStore: Record<string, CalEvent[] | undefined> = {}

  beforeAll(async () => {
    Bun.env.RUN_JOBS = 'false'

   // Overwrite the planning URL to a local fake endpoint to ensure our fetch mock intercepts it
   targetUrl = 'http://localhost/__fake_ics__'
   ;(anyLeaf as any).url = targetUrl

   // Mock only @api/db to satisfy utils/events.getBackupEvents path
    mock.module('@api/db', () => {
      return {
        db: {
          query: {
            planningsBackupTable: {
              // match interface used in getBackupEvents
              async findFirst(_args: any) {
                // We only support a single planning id in tests
                const events = backupStore[targetFullId]
                if (!events) return undefined
                return { events }
              },
            },
          },
        },
      }
    })

    // Mock global fetch to serve ICS for the selected planning URL
    // @ts-expect-error bun types
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === targetUrl) {
        if (fetchMode === 'ok') {
          const body = buildICS(sampleEvents)
          return new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'text/calendar' },
          })
        } else {
          // Simulate a page/HTML or server error so fetchEvents returns null
          return new Response('<!DOCTYPE html><html><body>error</body></html>', {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
          })
        }
      }
      // Fallback to original behavior for anything else
      return originalFetch(input as any, init)
    }

    // Import the routes after mocks are in place
    const { default: planningsRoutes } = await import('@api/routes/plannings')

    // Mount only the plannings routes under their original prefix
    app = new Elysia().use(planningsRoutes)
    api = treaty(app)
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('GET /plannings returns a list without raw URLs', async () => {
    const { data, response } = await api.plannings.get()
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBeTrue()
    expect(data.length).toBeGreaterThan(0)

    // Check presence/absence of keys
    const first = data[0] as any
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('fullId')
    expect(first).toHaveProperty('title')
    expect(first).toHaveProperty('children')
    expect(first).not.toHaveProperty('url')
    expect(first).not.toHaveProperty('flatten')

    // Ensure no 'url' in the tree
    const stack = [...(first.children as any[])]
    while (stack.length) {
      const node = stack.pop()
      expect(node).not.toHaveProperty('url')
      if (Array.isArray(node?.children)) stack.push(...node.children)
    }
  })

  it('GET /plannings/:fullId returns partial info for a valid id', async () => {
    const res = await app.handle(
      new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: anyLeaf.id,
      fullId: targetFullId,
      title: anyLeaf.title,
    })
    expect(body).not.toHaveProperty('events')
  })

  it('GET /plannings/:fullId with events=true returns events and respects blocklist', async () => {
    fetchMode = 'ok'
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&blocklist=${encodeURIComponent('math')}`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(Array.isArray(body.events)).toBeTrue()
    const summaries = (body.events as any[]).map((e: any) => e.summary)
    // "Math CM - Algebra" should be filtered out
    expect(summaries.some((s: string) => /Math CM/i.test(s))).toBeFalse()
    // Other events remain
    expect(body.nbEvents).toBeGreaterThan(0)
    expect(body.nbEvents).toBe((body.events as any[]).length)

    // Categories are inferred by summary/location ("CM"->lecture, "TP"->lab)
    const cats = (body.events as any[]).map((e: any) => e.categoryId)
    expect(cats.includes('lecture') || cats.includes('lab') || cats.includes('other')).toBeTrue()
  })

  it('uses backup events when ICS fetch fails', async () => {
    // Set backup events for this planning id
    backupStore[targetFullId] = sampleEvents
    // Flip fetch to error
    fetchMode = 'error'

    const res = await app.handle(
      new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    // Even though fetch failed, we should get "ok" with backup events
    expect(body.status).toBe('ok')
    expect(Array.isArray(body.events)).toBeTrue()
    expect(body.nbEvents).toBe((body.events as any[]).length)

    // Clean up backup
    backupStore[targetFullId] = undefined
    // Restore fetch OK for next tests
    fetchMode = 'ok'
  })

  it('accepts highlightTeacher query param', async () => {
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&highlightTeacher=true`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')

    // Ensure we still receive categorized events
    expect(Array.isArray(body.events)).toBeTrue()
    const cats = (body.events as any[]).map((e: any) => e.categoryId)
    expect(cats.length).toBeGreaterThan(0)
  })

  it('derives timezone from headers (browser: Europe/Paris, target: UTC)', async () => {
    // For the first event: 2025-01-01T10:00:00Z
    // Convert UTC -> Europe/Paris but keep local time (10:00 Paris) => 09:00Z in winter (+1)
    const req = new Request(
      `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true`,
      {
        headers: {
          'x-timezone': 'Europe/Paris',
          'x-target-timezone': 'UTC',
        },
      },
    )
    const res = await app.handle(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    const first = (body.events as any[])[0]
    const received = new Date(first.startDate).getTime()
    const original = sampleEvents[0].startDate.getTime()
    // Expect -1 hour shift (Europe/Paris in winter)
    expect(received).toBe(original - 60 * 60 * 1000)
  })

  it('derives timezone from query (browser: Asia/Tokyo, target: UTC)', async () => {
    // 10:00 UTC -> keep local time 10:00 in Tokyo => 01:00:00Z
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&browserTimezone=Asia/Tokyo&targetTimezone=UTC`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(200)
    const body = await res.json()

    const first = (body.events as any[])[0]
    const received = new Date(first.startDate).getTime()
    const original = sampleEvents[0].startDate.getTime()
    // Expect -9 hours shift (Asia/Tokyo)
    expect(received).toBe(original - 9 * 60 * 60 * 1000)
  })

  it('GET /plannings/:fullId returns 404 for unknown id', async () => {
    const res = await app.handle(new Request('http://local/plannings/__not_a_real_id__'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ error: 'Planning not found' })
  })

  it('uses only database when onlyDb=true (skips network fetch)', async () => {
    // Set backup events for this planning id
    backupStore[targetFullId] = sampleEvents
    // Keep fetch in OK mode - but it should NOT be called
    fetchMode = 'ok'

    // Track whether fetch was called for the target URL
    let fetchCalled = false
    const prevFetch = globalThis.fetch
    // @ts-expect-error bun types
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === targetUrl) {
        fetchCalled = true
      }
      return prevFetch(input as any, init)
    }

    const res = await app.handle(
      new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&onlyDb=true`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    // Should get events from DB, source should be 'db'
    expect(body.status).toBe('ok')
    expect(body.source).toBe('db')
    expect(Array.isArray(body.events)).toBeTrue()
    expect(body.nbEvents).toBe((body.events as any[]).length)

    // Verify fetch was NOT called for the planning URL
    expect(fetchCalled).toBeFalse()

    // Restore fetch
    globalThis.fetch = prevFetch
    // Clean up backup
    backupStore[targetFullId] = undefined
  })

  it('returns source=none when onlyDb=true and no backup exists', async () => {
    // Ensure no backup
    backupStore[targetFullId] = undefined

    const res = await app.handle(
      new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&onlyDb=true`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    // No events available
    expect(body.status).toBe('error')
    expect(body.source).toBe('none')
    expect(body.events).toBeNull()
  })

  // Tests for the 'reason' field
  describe('reason field', () => {
    it('returns reason=null when network succeeds with events', async () => {
      fetchMode = 'ok'
      backupStore[targetFullId] = undefined

      const res = await app.handle(
        new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.status).toBe('ok')
      expect(body.source).toBe('network')
      expect(body.reason).toBeNull()
      expect(body.nbEvents).toBeGreaterThan(0)
    })

    it('returns reason=network_error when network fails but DB has backup', async () => {
      backupStore[targetFullId] = sampleEvents
      fetchMode = 'error'

      const res = await app.handle(
        new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.status).toBe('ok')
      expect(body.source).toBe('db')
      expect(body.reason).toBe('network_error')
      expect(body.nbEvents).toBeGreaterThan(0)

      // Cleanup
      backupStore[targetFullId] = undefined
      fetchMode = 'ok'
    })

    it('returns reason=no_data when network fails and no DB backup', async () => {
      backupStore[targetFullId] = undefined
      fetchMode = 'error'

      const res = await app.handle(
        new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.status).toBe('error')
      expect(body.source).toBe('none')
      expect(body.reason).toBe('no_data')
      expect(body.events).toBeNull()

      // Cleanup
      fetchMode = 'ok'
    })

    it('returns reason=no_data when onlyDb=true and no backup exists', async () => {
      backupStore[targetFullId] = undefined

      const res = await app.handle(
        new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&onlyDb=true`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.status).toBe('error')
      expect(body.source).toBe('none')
      expect(body.reason).toBe('no_data')
    })

    it('returns reason=null when onlyDb=true and DB has events', async () => {
      backupStore[targetFullId] = sampleEvents

      const res = await app.handle(
        new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&onlyDb=true`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.status).toBe('ok')
      expect(body.source).toBe('db')
      expect(body.reason).toBeNull()
      expect(body.nbEvents).toBeGreaterThan(0)

      // Cleanup
      backupStore[targetFullId] = undefined
    })

    it('returns reason=empty_schedule when network succeeds but no events', async () => {
      fetchMode = 'ok'
      // Override fetch to return empty ICS
      const prevFetch = globalThis.fetch
      // @ts-expect-error bun types
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === targetUrl) {
          // Return valid ICS with no events
          const emptyICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PlanningSup Test//EN\r\nEND:VCALENDAR'
          return new Response(emptyICS, {
            status: 200,
            headers: { 'Content-Type': 'text/calendar' },
          })
        }
        return prevFetch(input as any, init)
      }

      const res = await app.handle(
        new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.status).toBe('ok')
      expect(body.source).toBe('network')
      expect(body.reason).toBe('empty_schedule')
      expect(body.nbEvents).toBe(0)
      expect(body.events).toEqual([])

      // Restore fetch
      globalThis.fetch = prevFetch
    })

    it('returns reason=empty_schedule when onlyDb=true and DB has empty events', async () => {
      backupStore[targetFullId] = [] // Empty array

      const res = await app.handle(
        new Request(`http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&onlyDb=true`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.status).toBe('ok')
      expect(body.source).toBe('db')
      expect(body.reason).toBe('empty_schedule')
      expect(body.nbEvents).toBe(0)

      // Cleanup
      backupStore[targetFullId] = undefined
    })
  })
})
