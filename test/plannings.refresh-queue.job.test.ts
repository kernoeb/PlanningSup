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

  it('claims a row, refreshes from network, upserts backup, then deletes the queue row', async () => {
    const calls: { upsert: string[], deleted: string[], updated: string[] } = { upsert: [], deleted: [], updated: [] }

    let executeCalls = 0
    const fakeDb = {
      async execute(_q: any) {
        executeCalls += 1
        if (executeCalls === 1) {
          return [{ planningFullId: fullId, attempts: 0, priority: 10 }]
        }
        return []
      },
      delete(_table: any) {
        return {
          where(_cond: any) {
            calls.deleted.push(fullId)
            return Promise.resolve([])
          },
        }
      },
      update(_table: any) {
        return {
          set(_values: any) {
            return {
              where(_cond: any) {
                calls.updated.push(fullId)
                return Promise.resolve([])
              },
            }
          },
        }
      },
    } as any

    const { drainRefreshQueue } = await import('@api/jobs/plannings-refresh-queue')
    await drainRefreshQueue(fakeDb, {
      flattenedPlannings: [{ fullId, url }],
      async fetchEvents(_url: string) {
        return sampleEvents
      },
      async upsertPlanningBackup(_db: any, planningFullId: string, _events: any[]) {
        calls.upsert.push(planningFullId)
        return { changed: true, nbEvents: 1 }
      },
    })

    expect(calls.upsert).toEqual([fullId])
    expect(calls.deleted).toEqual([fullId])
    expect(calls.updated).toEqual([])
  })

  it('backs off and keeps row when network fetch fails', async () => {
    const calls: { upsert: string[], deleted: string[], updated: string[] } = { upsert: [], deleted: [], updated: [] }

    let executeCalls = 0
    const fakeDb = {
      async execute(_q: any) {
        executeCalls += 1
        if (executeCalls === 1) {
          return [{ planningFullId: fullId, attempts: 1, priority: 10 }]
        }
        return []
      },
      delete(_table: any) {
        return {
          where(_cond: any) {
            calls.deleted.push(fullId)
            return Promise.resolve([])
          },
        }
      },
      update(_table: any) {
        return {
          set(_values: any) {
            return {
              where(_cond: any) {
                calls.updated.push(fullId)
                return Promise.resolve([])
              },
            }
          },
        }
      },
    } as any

    const { drainRefreshQueue } = await import('@api/jobs/plannings-refresh-queue')
    await drainRefreshQueue(fakeDb, {
      flattenedPlannings: [{ fullId, url }],
      async fetchEvents(_url: string) {
        return null
      },
      async upsertPlanningBackup(_db: any, planningFullId: string, _events: any[]) {
        calls.upsert.push(planningFullId)
        return { changed: true, nbEvents: 1 }
      },
    })

    expect(calls.upsert).toEqual([])
    expect(calls.deleted).toEqual([])
    expect(calls.updated).toEqual([fullId])
  })
})
