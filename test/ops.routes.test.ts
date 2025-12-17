import { beforeAll, describe, expect, it, mock } from 'bun:test'
import { Elysia } from 'elysia'
import { treaty } from '@elysiajs/eden'

describe('Ops routes', () => {
  let app: Elysia
  let api: ReturnType<typeof treaty>

  beforeAll(async () => {
    Bun.env.NODE_ENV = 'test'
    Bun.env.AUTH_ENABLED = 'false'
    Bun.env.TRUSTED_ORIGINS = 'http://localhost'
    Bun.env.OPS_TOKEN = 'secret'

    mock.module('@api/db', () => ({
      db: {
        async execute(_q: any) {
          // The ops route calls execute 3 times: queueAgg, backupAgg, topQueue
          this._i = (this._i ?? 0) + 1
          if (this._i === 1) {
            return {
              rows: [{
                depth: 2,
                ready: 1,
                locked: 1,
                maxPriority: 42,
                oldestRequestedAt: new Date('2025-01-01T00:00:00Z'),
                nextAttemptAt: new Date('2025-01-01T00:10:00Z'),
              }],
            }
          }
          if (this._i === 2) {
            return {
              rows: [{
                totalPlannings: 100,
                totalBackups: 90,
                missingBackups: 10,
                oldestBackupUpdatedAt: new Date('2025-01-01T00:00:00Z'),
                staleOver1h: 5,
                staleOver6h: 3,
                staleOver24h: 1,
              }],
            }
          }
          return {
            rows: [{
              planningFullId: 'p.1',
              priority: 42,
              attempts: 2,
              requestedAt: new Date('2025-01-01T00:00:00Z'),
              nextAttemptAt: new Date('2025-01-01T00:10:00Z'),
              lockedAt: null,
              lockOwner: null,
              lastError: null,
            }],
          }
        },
      },
    }))

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
