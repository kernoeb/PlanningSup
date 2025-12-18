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
          total: 50,
          disabled: 3,
          oldestDisabledUntil: new Date('2025-01-02T00:00:00Z'),
          mostRecentSuccessAt: new Date('2025-01-03T00:00:00Z'),
          refreshedLast1h: 20,
          refreshedLast6h: 35,
          refreshedLast24h: 45,
          neverRefreshed: 5,
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

    // Health check at top level
    expect(data).toHaveProperty('health')
    expect((data as any).health.status).toBeOneOf(['healthy', 'degraded', 'unhealthy'])
    expect(Array.isArray((data as any).health.issues)).toBeTrue()

    // Queue metrics
    expect(data).toHaveProperty('refreshQueue')
    expect((data as any).refreshQueue.depth).toBe(2)

    // Refresh state with freshness metrics
    expect(data).toHaveProperty('refreshState')
    expect((data as any).refreshState.total).toBe(50)
    expect((data as any).refreshState.disabled).toBe(3)
    expect((data as any).refreshState.refreshedLast1h).toBe(20)
    expect((data as any).refreshState.refreshedLast6h).toBe(35)

    // Backups with renamed content stale fields
    expect((data as any).backups.missingBackups).toBe(10)
    expect((data as any).backups.contentStaleOver1h).toBe(5)
    expect((data as any).backups).toHaveProperty('missingExplained')
    expect((data as any).backups).toHaveProperty('contentStaleMeaning')

    expect(Array.isArray((data as any).queueTop)).toBeTrue()
  })
})
