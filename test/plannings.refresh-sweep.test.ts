import { describe, expect, it } from 'bun:test'

describe('plannings refresh queue sweeper', () => {
  it('migrates legacy dead rows via a single execute call', async () => {
    let executeCalls = 0
    const fakeDb = {
      async execute(_q: any) {
        executeCalls += 1
        return [{ planningFullId: 'p.1' }, { planningFullId: 'p.2' }]
      },
    } as any

    const { sweepLegacyDeadQueueRows } = await import('@api/jobs/plannings-refresh-queue')
    const res = await sweepLegacyDeadQueueRows(fakeDb, { maxAttempts: 10, limit: 100 })

    expect(executeCalls).toBe(1)
    expect(res.moved).toBe(2)
  })
})

