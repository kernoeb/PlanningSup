import { describe, expect, it } from 'bun:test'

type CalEvent = {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

describe('plannings-refresh-queue job', () => {
  const fullId = 'test.planning.1'
  const url = 'http://localhost/__fake_ics__'

  const sampleEvents: CalEvent[] = [
    {
      uid: 'evt-1',
      summary: 'A',
      startDate: new Date('2025-01-01T10:00:00Z'),
      endDate: new Date('2025-01-01T11:00:00Z'),
      location: 'L',
      description: 'D',
    },
  ]

  function createFakeDb(executeRows: Array<{ planningFullId: string, attempts: number, priority: number }>) {
    const calls: {
      deleted: string[]
      updated: Array<{ id: string, lastError?: string }>
      stateUpserts: Array<{ id: string, lastFailureKind?: string | null, lastError?: string | null, disabledUntilSql?: string | null }>
    } = { deleted: [], updated: [], stateUpserts: [] }

    let executeCalls = 0

    const fakeDb = {
      async execute(_q: any) {
        executeCalls += 1
        return executeCalls === 1 ? executeRows : []
      },
      delete(_table: any) {
        return {
          where() {
            calls.deleted.push(fullId)
            return Promise.resolve([])
          },
        }
      },
      update(_table: any) {
        return {
          set(values: any) {
            return {
              where() {
                calls.updated.push({ id: fullId, lastError: values.lastError })
                return Promise.resolve([])
              },
            }
          },
        }
      },
      insert(_table: any) {
        return {
          values(values: any) {
            return {
              onConflictDoUpdate() {
                return {
                  then(onFulfilled: any, onRejected: any) {
                    const disabledUntilSql = values.disabledUntil?.queryChunks
                      ? values.disabledUntil.queryChunks
                          .map((chunk: any) => {
                            if (typeof chunk === 'string') return chunk
                            if (chunk && typeof chunk === 'object' && Array.isArray(chunk.value)) return chunk.value.join('')
                            return ''
                          })
                          .join('')
                      : null
                    calls.stateUpserts.push({
                      id: values.planningFullId ?? fullId,
                      lastFailureKind: values.lastFailureKind ?? null,
                      lastError: values.lastError ?? null,
                      disabledUntilSql,
                    })
                    return Promise.resolve([]).then(onFulfilled, onRejected)
                  },
                }
              },
            }
          },
        }
      },
      transaction<T>(fn: (tx: any) => Promise<T>) {
        return fn(this)
      },
    } as any

    return { fakeDb, calls }
  }

  it('claims a row, refreshes from network, upserts backup, then deletes the queue row', async () => {
    const callsUpsert: string[] = []
    // In production, the claim query increments attempts and returns the updated value.
    const { fakeDb, calls } = createFakeDb([{ planningFullId: fullId, attempts: 1, priority: 10 }])

    const { drainRefreshQueue } = await import('@api/jobs/plannings-refresh-queue')
    await drainRefreshQueue(fakeDb, {
      planningUrlById: new Map([[fullId, url]]),
      async fetchEvents() {
        return { events: sampleEvents, failure: null }
      },
      async upsertPlanningBackup(_db: any, planningFullId: string) {
        callsUpsert.push(planningFullId)
        return { changed: true, nbEvents: 1 }
      },
    })

    expect(callsUpsert).toEqual([fullId])
    expect(calls.deleted).toEqual([fullId])
    expect(calls.updated).toEqual([])
    expect(calls.stateUpserts.length).toBeGreaterThan(0)
  })

  it('backs off and keeps row when network fetch fails', async () => {
    const callsUpsert: string[] = []
    const { fakeDb, calls } = createFakeDb([{ planningFullId: fullId, attempts: 2, priority: 10 }])

    const { drainRefreshQueue } = await import('@api/jobs/plannings-refresh-queue')
    await drainRefreshQueue(fakeDb, {
      planningUrlById: new Map([[fullId, url]]),
      async fetchEvents() {
        return { events: null, failure: { kind: 'timeout', status: null, code: null, retryAfterMs: null, message: null } }
      },
      async upsertPlanningBackup(_db: any, planningFullId: string) {
        callsUpsert.push(planningFullId)
        return { changed: true, nbEvents: 1 }
      },
    })

    expect(callsUpsert).toEqual([])
    expect(calls.deleted).toEqual([])
    expect(calls.updated).toEqual([{ id: fullId, lastError: 'timeout' }])
    expect(calls.stateUpserts).toEqual([{ id: fullId, lastFailureKind: 'timeout', lastError: 'timeout', disabledUntilSql: null }])
  })

  it('gives up after max attempts', async () => {
    const callsUpsert: string[] = []
    // attempts returned by claim is already incremented.
    const { fakeDb, calls } = createFakeDb([{ planningFullId: fullId, attempts: 10, priority: 10 }])

    const { drainRefreshQueue } = await import('@api/jobs/plannings-refresh-queue')
    await drainRefreshQueue(
      fakeDb,
      {
        planningUrlById: new Map([[fullId, url]]),
        async fetchEvents() {
          callsUpsert.push('fetch_called')
          return { events: null, failure: { kind: 'timeout', status: null, code: null, retryAfterMs: null, message: null } }
        },
        async upsertPlanningBackup(_db: any, planningFullId: string) {
          callsUpsert.push(planningFullId)
          return { changed: true, nbEvents: 1 }
        },
      },
      undefined,
      { maxAttempts: 10 },
    )

    expect(callsUpsert).toEqual(['fetch_called'])
    expect(calls.updated).toEqual([])
    expect(calls.deleted).toEqual([fullId])
    expect(calls.stateUpserts.length).toBeGreaterThan(0)
  })

  it('stops retrying on permanent HTTP 4xx', async () => {
    const { fakeDb, calls } = createFakeDb([{ planningFullId: fullId, attempts: 2, priority: 10 }])

    const { drainRefreshQueue } = await import('@api/jobs/plannings-refresh-queue')
    await drainRefreshQueue(fakeDb, {
      planningUrlById: new Map([[fullId, url]]),
      async fetchEvents() {
        return { events: null, failure: { kind: 'http_4xx', status: 404, code: null, retryAfterMs: null, message: null } }
      },
      async upsertPlanningBackup() {
        throw new Error('should_not_upsert')
      },
    })

    expect(calls.updated).toEqual([])
    expect(calls.deleted).toEqual([fullId])
    expect(calls.stateUpserts.length).toBeGreaterThan(0)

    const lastUpsert = calls.stateUpserts.at(-1)
    expect(lastUpsert?.disabledUntilSql).toContain('::interval')
  })
})
