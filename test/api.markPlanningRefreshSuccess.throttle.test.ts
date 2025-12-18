import { describe, expect, it, mock } from 'bun:test'
import { planningsRefreshStateTable } from '@api/db/schemas/plannings'

describe('markPlanningRefreshSuccess write throttling', () => {
  it('adds a DB-level where clause when throttle is enabled', async () => {
    const prevNodeEnv = Bun.env.NODE_ENV
    const prevThrottle = Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS

    try {
      Bun.env.NODE_ENV = 'production'
      delete Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS

      let captured: any = null

      mock.module('@api/db', () => {
        return {
          db: {
            insert() {
              return {
                values() {
                  return {
                    onConflictDoUpdate(cfg: any) {
                      captured = cfg
                      return Promise.resolve()
                    },
                  }
                },
              }
            },
          },
        }
      })

      const { markPlanningRefreshSuccess } = await import('@api/utils/plannings-backup')
      await markPlanningRefreshSuccess('planning:fullId:test')

      expect(captured).toBeTruthy()
      expect(captured.where).toBeTruthy()

      const chunks = captured.where?.queryChunks
      expect(Array.isArray(chunks)).toBeTrue()
      expect(chunks.includes(planningsRefreshStateTable.lastSuccessAt)).toBeTrue()
    } finally {
      if (prevNodeEnv == null) delete Bun.env.NODE_ENV
      else Bun.env.NODE_ENV = prevNodeEnv

      if (prevThrottle == null) delete Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS
      else Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS = prevThrottle

      mock.restore()
    }
  })

  it('does not add a where clause when throttle is disabled', async () => {
    const prevNodeEnv = Bun.env.NODE_ENV
    const prevThrottle = Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS

    try {
      Bun.env.NODE_ENV = 'production'
      Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS = '0'

      let captured: any = null

      mock.module('@api/db', () => {
        return {
          db: {
            insert() {
              return {
                values() {
                  return {
                    onConflictDoUpdate(cfg: any) {
                      captured = cfg
                      return Promise.resolve()
                    },
                  }
                },
              }
            },
          },
        }
      })

      const { markPlanningRefreshSuccess } = await import('@api/utils/plannings-backup')
      await markPlanningRefreshSuccess('planning:fullId:test')

      expect(captured).toBeTruthy()
      expect(captured.where).toBeUndefined()
    } finally {
      if (prevNodeEnv == null) delete Bun.env.NODE_ENV
      else Bun.env.NODE_ENV = prevNodeEnv

      if (prevThrottle == null) delete Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS
      else Bun.env.PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS = prevThrottle

      mock.restore()
    }
  })
})
