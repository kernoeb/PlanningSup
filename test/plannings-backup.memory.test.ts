import { afterEach, beforeAll, describe, expect, it } from 'bun:test'

import { installApiDbMock, resetApiDbMockStores } from './helpers/api-db-mock'

type CalEvent = {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

describe('plannings backup in-memory state', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test'
    Bun.env.NODE_ENV = 'test'

    installApiDbMock()
    resetApiDbMockStores()
  })

  afterEach(async () => {
    const { __test } = await import('@api/utils/plannings-backup')
    __test.reset()
  })

  it('caps refresh throttle map size under load', async () => {
    const { requestPlanningRefresh, __test } = await import('@api/utils/plannings-backup')
    __test.reset()

    for (let i = 0; i < 2_000; i++) {
      // Unique ids to simulate abuse or extreme churn.
      // eslint-disable-next-line no-await-in-loop
      await requestPlanningRefresh(`p.${i}`, 10)
    }

    expect(__test.sizes().refreshState).toBeLessThanOrEqual(200)
  })

  it('caps async write-through map size under load', async () => {
    const { schedulePlanningBackupWrite, __test } = await import('@api/utils/plannings-backup')
    __test.reset()

    const evts: CalEvent[] = [
      {
        uid: 'u',
        summary: 's',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-01-01T01:00:00Z'),
        location: 'l',
        description: 'd',
      },
    ]

    for (let i = 0; i < 2_000; i++) {
      schedulePlanningBackupWrite(`p.${i}`, evts)
    }

    // Allow microtasks to flush in-flight promises.
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(__test.sizes().writeState).toBeLessThanOrEqual(200)
  })
})
