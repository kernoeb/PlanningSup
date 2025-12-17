import { beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { treaty } from '@elysiajs/eden'

import { configureApiDbMock, installApiDbMock, resetApiDbMockStores } from './helpers/api-db-mock'

describe('Ops routes', () => {
  let app: Elysia
  let api: ReturnType<typeof treaty>

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_ENABLED = 'false'
    process.env.TRUSTED_ORIGINS = 'http://localhost'
    process.env.OPS_TOKEN = 'secret'
    Bun.env.NODE_ENV = 'test'
    Bun.env.AUTH_ENABLED = 'false'
    Bun.env.TRUSTED_ORIGINS = 'http://localhost'
    Bun.env.OPS_TOKEN = 'secret'

    installApiDbMock()
    resetApiDbMockStores()
    configureApiDbMock({
      // The ops route performs 6 selects in this order:
      // 1) refreshQueue aggregates
      // 2) refreshState aggregates
      // 3) total plannings
      // 4) missing backups
      // 5) backups aggregates
      // 6) queue top list
      opsSelectRowsByCall: [
        [{
          depth: 2,
          ready: 1,
          locked: 1,
          maxPriority: 42,
          oldestRequestedAt: new Date('2025-01-01T00:00:00Z'),
          nextAttemptAt: new Date('2025-01-01T00:10:00Z'),
        }],
        [{
          disabled: 3,
          oldestDisabledUntil: new Date('2025-01-02T00:00:00Z'),
          mostRecentSuccessAt: new Date('2025-01-03T00:00:00Z'),
        }],
        [{ totalPlannings: 100 }],
        [{ missingBackups: 10 }],
        [{
          totalBackups: 90,
          oldestBackupUpdatedAt: new Date('2025-01-01T00:00:00Z'),
          staleOver1h: 5,
          staleOver6h: 3,
          staleOver24h: 1,
        }],
        [{
          planningFullId: 'p.1',
          priority: 42,
          attempts: 2,
          requestedAt: new Date('2025-01-01T00:00:00Z'),
          nextAttemptAt: new Date('2025-01-01T00:10:00Z'),
          lockedAt: null,
          lockOwner: null,
          lastError: null,
        }],
      ],
    })

    const { default: apiRoutes } = await import('@api/api')
    app = new Elysia().use(apiRoutes)
    api = treaty(app)
  })

  it('returns 404 without token in tests when opsToken is set', async () => {
    const { response } = await api.api.ops.plannings.get()
    expect(response.status).toBe(404)
  })

  it('returns metrics with a valid token', async () => {
    const { data, response } = await api.api.ops.plannings.get({
      headers: { 'x-ops-token': 'secret' },
    })
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('refreshQueue')
    expect((data as any).refreshQueue.depth).toBe(2)
    expect((data as any).backups.missingBackups).toBe(10)
    expect(Array.isArray((data as any).queueTop)).toBeTrue()
  })
})
