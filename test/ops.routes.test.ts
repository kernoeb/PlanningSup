import { beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { treaty } from '@elysiajs/eden'

import { configureApiDbMock, installApiDbMock, resetApiDbMockStores } from './helpers/api-db-mock'

describe('Ops routes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any
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
      // The simplified ops route performs 5 selects:
      // 1) queue stats (depth, ready, locked)
      // 2) backup coverage (total, withBackup)
      // 3) disabled count
      // 4) failed hosts (grouped by host)
      // 5) recent failures (top 5)
      opsSelectRowsByCall: [
        [{ depth: 5, ready: 3, locked: 1 }],
        [{ total: 100, withBackup: 90 }],
        [{ count: 8 }],
        [
          { host: 'uni-a', count: 5, lastFailure: 'http_4xx' },
          { host: 'uni-b', count: 3, lastFailure: 'timeout' },
        ],
        [
          { planningFullId: 'uni-a.test.1', failureKind: 'http_4xx', failures: 10, disabledUntil: new Date('2025-01-02T00:00:00Z') },
        ],
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

  it('returns simplified metrics with a valid token', async () => {
    const { data, response } = await api.api.ops.plannings.get({
      headers: { 'x-ops-token': 'secret' },
    })
    expect(response.status).toBe(200)

    // Top level status
    expect(data).toHaveProperty('status')
    expect((data as any).status).toBeOneOf(['healthy', 'degraded', 'unhealthy'])
    expect(Array.isArray((data as any).issues)).toBeTrue()

    // Workers state
    expect(data).toHaveProperty('workers')
    expect((data as any).workers).toHaveProperty('backfill')
    expect((data as any).workers).toHaveProperty('refreshWorker')

    // Queue metrics
    expect(data).toHaveProperty('queue')
    expect((data as any).queue.depth).toBe(5)
    expect((data as any).queue.ready).toBe(3)
    expect((data as any).queue.locked).toBe(1)

    // Backups summary
    expect(data).toHaveProperty('backups')
    expect((data as any).backups.total).toBe(100)
    expect((data as any).backups.covered).toBe(90)
    expect((data as any).backups.disabled).toBe(8)

    // Last backup write (may be null)
    expect(data).toHaveProperty('lastBackupWrite')

    // Failed hosts (grouped)
    expect(data).toHaveProperty('failedHosts')
    expect(Array.isArray((data as any).failedHosts)).toBeTrue()
    expect((data as any).failedHosts[0]).toHaveProperty('host')
    expect((data as any).failedHosts[0]).toHaveProperty('count')

    // Recent failures
    expect(data).toHaveProperty('recentFailures')
    expect(Array.isArray((data as any).recentFailures)).toBeTrue()

    // Quiet hours flag
    expect(data).toHaveProperty('inQuietHours')
    expect(typeof (data as any).inQuietHours).toBe('boolean')
  })
})
