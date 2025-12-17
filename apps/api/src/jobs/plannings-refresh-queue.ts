import type { Database } from '@api/db'

import process from 'process'

import { jobsLogger } from '@api/utils/logger'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const DEFAULT_BATCH_SIZE = 25
const DEFAULT_MAX_RUNTIME_MS = 20_000
const LOCK_TTL_MINUTES = 5

function backoffMs(attempt: number) {
  // Exponential backoff with cap: 5s, 10s, 20s, ... up to 10m
  const base = 5_000
  const ms = base * 2 ** Math.max(0, attempt - 1)
  return Math.min(ms, 10 * 60_000)
}

export async function drainRefreshQueue(db: Database, deps: {
  fetchEvents: (url: string) => Promise<Array<{ uid: string, summary: string, startDate: Date, endDate: Date, location: string, description: string }> | null>
  upsertPlanningBackup: (db: Database, planningFullId: string, events: Array<{ uid: string, summary: string, startDate: Date, endDate: Date, location: string, description: string }>) => Promise<{ changed: boolean, nbEvents: number }>
  flattenedPlannings: Array<{ fullId: string, url: string }>
}, signal?: AbortSignal) {
  const { planningsRefreshQueueTable } = await import('@api/db/schemas/plannings')
  const { eq, sql } = await import('drizzle-orm')

  const owner = `jobs:${process.pid}:${crypto.randomUUID()}`
  const start = Date.now()

  jobsLogger.info('Starting plannings refresh queue drain (owner={owner})', { owner })

  for (;;) {
    if (signal?.aborted) return
    if (Date.now() - start > DEFAULT_MAX_RUNTIME_MS) return

    // Claim a batch with SKIP LOCKED so multiple workers can cooperate safely.
    const rows = await db.execute<{ planningFullId: string, attempts: number, priority: number }>(sql`
      with picked as (
        select planning_full_id
        from ${planningsRefreshQueueTable}
        where ${planningsRefreshQueueTable.nextAttemptAt} <= now()
          and (
            ${planningsRefreshQueueTable.lockedAt} is null
            or ${planningsRefreshQueueTable.lockedAt} < (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
          )
        order by ${planningsRefreshQueueTable.priority} desc, ${planningsRefreshQueueTable.requestedAt} asc
        limit ${DEFAULT_BATCH_SIZE}
        for update skip locked
      )
      update ${planningsRefreshQueueTable} q
      set
        locked_at = now(),
        lock_owner = ${owner},
        attempts = q.attempts + 1
      from picked
      where q.planning_full_id = picked.planning_full_id
      returning
        q.planning_full_id as "planningFullId",
        q.attempts as "attempts",
        q.priority as "priority"
    `)

    if (rows.length === 0) return

    for (const row of rows) {
      if (signal?.aborted) return

      const planning = deps.flattenedPlannings.find(p => p.fullId === row.planningFullId)
      if (!planning) {
        // Planning no longer exists in resources; drop it from queue.
        await db.delete(planningsRefreshQueueTable).where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
        continue
      }

      try {
        const events = await deps.fetchEvents(planning.url)
        if (!events) {
          const delayMs = backoffMs(row.attempts)
          await db
            .update(planningsRefreshQueueTable)
            .set({
              lockedAt: null,
              lockOwner: null,
              lastError: 'network_failed',
              nextAttemptAt: sql`now() + (${delayMs} * interval '1 millisecond')`,
            })
            .where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
          continue
        }

        await deps.upsertPlanningBackup(db, row.planningFullId, events)
        await db.delete(planningsRefreshQueueTable).where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
      } catch (error) {
        const delayMs = backoffMs(row.attempts)
        jobsLogger.warn('Error refreshing planning {fullId}: {error}', { fullId: row.planningFullId, error })
        await db
          .update(planningsRefreshQueueTable)
          .set({
            lockedAt: null,
            lockOwner: null,
            lastError: String(error),
            nextAttemptAt: sql`now() + (${delayMs} * interval '1 millisecond')`,
          })
          .where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
      }

      await pause(50)
    }
  }
}

export async function run(db: Database, signal?: AbortSignal) {
  const { fetchEvents } = await import('@api/utils/events')
  const { upsertPlanningBackup } = await import('@api/utils/plannings-backup')
  const { flattenedPlannings } = await import('@api/plannings')

  return drainRefreshQueue(db, { fetchEvents, upsertPlanningBackup, flattenedPlannings }, signal)
}
