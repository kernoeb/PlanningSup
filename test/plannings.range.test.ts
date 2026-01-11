import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { flattenedPlannings } from '@api/plannings'
import { getApiDbMockStores, installApiDbMock, resetApiDbMockStores } from './helpers/api-db-mock'

type CalEvent = {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

const sampleEvents: CalEvent[] = [
  {
    uid: 'evt-1',
    summary: 'Event 1',
    startDate: new Date('2026-01-01T10:00:00Z'),
    endDate: new Date('2026-01-01T12:00:00Z'),
    location: 'Room A',
    description: 'Desc 1',
  },
  {
    uid: 'evt-2',
    summary: 'Event 2',
    startDate: new Date('2026-02-01T10:00:00Z'),
    endDate: new Date('2026-02-01T12:00:00Z'),
    location: 'Room B',
    description: 'Desc 2',
  },
  {
    uid: 'evt-3',
    summary: 'Event 3',
    startDate: new Date('2026-03-01T10:00:00Z'),
    endDate: new Date('2026-03-01T12:00:00Z'),
    location: 'Room C',
    description: 'Desc 3',
  },
]

function buildICS(events: CalEvent[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanningSup Test//EN',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
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
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

describe('Plannings range filtering', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any
  const anyLeaf = flattenedPlannings.find(p => Boolean(p.url)) || flattenedPlannings[0]
  const targetFullId = anyLeaf.fullId
  let targetUrl: string
  const originalFetch = globalThis.fetch

  let backupStore: Record<string, { events: CalEvent[], updatedAt: Date } | undefined>
  let refreshQueueStore: Map<string, { priority: number }>

  beforeAll(async () => {
    process.env.RUN_JOBS = 'false'
    process.env.NODE_ENV = 'test'
    installApiDbMock()
    resetApiDbMockStores()
    ;({ backupStore, refreshQueueStore } = getApiDbMockStores())

    targetUrl = 'http://localhost/__fake_ics_range__'
    ;(anyLeaf as any).url = targetUrl

    // @ts-expect-error bun types
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith(targetUrl)) {
        return new Response(buildICS(sampleEvents), {
          status: 200,
          headers: { 'Content-Type': 'text/calendar' },
        })
      }
      return originalFetch(input as any)
    }

    const { default: planningsRoutes } = await import('@api/routes/plannings')
    app = new Elysia().use(planningsRoutes)
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('filters events locally by range', async () => {
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&from=2026-01-15&to=2026-02-15`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.events).toHaveLength(1)
    expect(body.events[0].summary).toBe('Event 2')
  })

  it('handles "from" only', async () => {
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&from=2026-02-15`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.events).toHaveLength(1)
    expect(body.events[0].summary).toBe('Event 3')
  })

  it('handles "to" only', async () => {
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&to=2026-01-15`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.events).toHaveLength(1)
    expect(body.events[0].summary).toBe('Event 1')
  })

  it('returns 400 for range too large', async () => {
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&from=2020-01-01&to=2025-01-01`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Range too large (max 2 years)')
  })

  it('returns 400 for invalid dates', async () => {
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&from=invalid-date`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid range dates')
  })

  it('returns 400 for range with onlyDb=true', async () => {
    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&from=2025-01-01&onlyDb=true`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Range filtering is only supported for network-first calls')
  })

  it('does NOT enqueue refresh or write backup when range is used', async () => {
    backupStore[targetFullId] = undefined
    refreshQueueStore.clear()

    const url = `http://local/plannings/${encodeURIComponent(targetFullId)}?events=true&from=2025-01-01&to=2025-01-02`
    const res = await app.handle(new Request(url))
    expect(res.status).toBe(200)

    // Give some time for async ops (even if they should NOT happen)
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(backupStore[targetFullId]).toBeUndefined()
    expect(refreshQueueStore.has(targetFullId)).toBeFalse()
  })
})
