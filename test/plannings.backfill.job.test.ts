import { afterEach, describe, expect, it, mock } from 'bun:test'

describe('plannings-backfill job', () => {
  afterEach(() => {
    mock.restore()
  })

  it('enqueues missing and stale plannings (deduped)', async () => {
    const enqueued: Array<{ ids: string[], priority: number }> = []

    mock.module('@api/utils/plannings-backup', () => ({
      enqueuePlanningRefreshBatch: async (ids: string[], priority: number) => {
        enqueued.push({ ids, priority })
      },
    }))

    let selectCalls = 0
    const fakeDb = {
      select() {
        selectCalls++

        const rows = selectCalls === 1
          ? [{ fullId: 'p.1' }, { fullId: 'p.2' }]
          : [{ fullId: 'p.2' }, { fullId: 'p.3' }]

        return {
          from() {
            return this
          },
          leftJoin() {
            return this
          },
          where() {
            return this
          },
          orderBy() {
            return this
          },
          limit() {
            return Promise.resolve(rows)
          },
        }
      },
    } as any

    const { runOnce } = await import('@api/jobs/plannings-backfill')
    const res = await runOnce(fakeDb)

    expect(res.enqueued).toBe(3)
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0].priority).toBe(1)
    expect(new Set(enqueued[0].ids)).toEqual(new Set(['p.1', 'p.2', 'p.3']))
  })

  it('does nothing when there is nothing to enqueue', async () => {
    const enqueued: Array<{ ids: string[], priority: number }> = []

    mock.module('@api/utils/plannings-backup', () => ({
      enqueuePlanningRefreshBatch: async (ids: string[], priority: number) => {
        enqueued.push({ ids, priority })
      },
    }))

    let selectCalls = 0
    const fakeDb = {
      select() {
        selectCalls++
        const rows: Array<{ fullId: string }> = []
        return {
          from() {
            return this
          },
          leftJoin() {
            return this
          },
          where() {
            return this
          },
          orderBy() {
            return this
          },
          limit() {
            return Promise.resolve(rows)
          },
        }
      },
    } as any

    const { runOnce } = await import('@api/jobs/plannings-backfill')
    const res = await runOnce(fakeDb)

    expect(res.enqueued).toBe(0)
    expect(enqueued).toHaveLength(0)
  })
})
