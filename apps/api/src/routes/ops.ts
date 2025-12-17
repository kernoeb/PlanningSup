import config from '@api/config'
import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshQueueTable, planningsTable } from '@api/db/schemas/plannings'
import { jobs } from '@api/jobs'

import { sql } from 'drizzle-orm'
import { Elysia } from 'elysia'

const LOCK_TTL_MINUTES = 5

function isAuthorized(headers: Headers) {
  const token = config.opsToken

  // In production, require an explicit token.
  if (import.meta.env.NODE_ENV === 'production') {
    if (!token) return false
    return headers.get('x-ops-token') === token
  }

  // In non-production, allow by default (still accepts token if set).
  if (!token) return true
  return headers.get('x-ops-token') === token
}

export default new Elysia({ prefix: '/ops' })
  .onBeforeHandle(({ request, set }) => {
    if (!isAuthorized(request.headers)) {
      set.status = 404
      return { error: 'NOT_FOUND' }
    }
  })
  .get('/plannings', async () => {
    const queueAgg = await db.execute(sql`
      select
        count(*)::int as "depth",
        count(*) filter (
          where ${planningsRefreshQueueTable.nextAttemptAt} <= now()
            and (
              ${planningsRefreshQueueTable.lockedAt} is null
              or ${planningsRefreshQueueTable.lockedAt} < (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
            )
        )::int as "ready",
        count(*) filter (
          where ${planningsRefreshQueueTable.lockedAt} is not null
            and ${planningsRefreshQueueTable.lockedAt} >= (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
        )::int as "locked",
        max(${planningsRefreshQueueTable.priority})::int as "maxPriority",
        min(${planningsRefreshQueueTable.requestedAt}) as "oldestRequestedAt",
        min(${planningsRefreshQueueTable.nextAttemptAt}) as "nextAttemptAt"
      from ${planningsRefreshQueueTable}
    `)

    const backupAgg = await db.execute(sql`
      select
        (select count(*) from ${planningsTable})::int as "totalPlannings",
        (select count(*) from ${planningsBackupTable})::int as "totalBackups",
        (select count(*) from ${planningsTable} p left join ${planningsBackupTable} b on b.planning_full_id = p.full_id where b.planning_full_id is null)::int as "missingBackups",
        (select min(updated_at) from ${planningsBackupTable}) as "oldestBackupUpdatedAt",
        (select count(*) from ${planningsBackupTable} where updated_at < (now() - interval '1 hour'))::int as "staleOver1h",
        (select count(*) from ${planningsBackupTable} where updated_at < (now() - interval '6 hours'))::int as "staleOver6h",
        (select count(*) from ${planningsBackupTable} where updated_at < (now() - interval '24 hours'))::int as "staleOver24h"
    `)

    const topQueue = await db.execute(sql`
      select
        planning_full_id as "planningFullId",
        priority,
        attempts,
        requested_at as "requestedAt",
        next_attempt_at as "nextAttemptAt",
        locked_at as "lockedAt",
        lock_owner as "lockOwner",
        last_error as "lastError"
      from ${planningsRefreshQueueTable}
      order by priority desc, requested_at asc
      limit 20
    `)

    return {
      timestamp: Date.now(),
      jobs: {
        runJobs: config.jobs.runJobs,
        paused: jobs.isPaused(),
        delayMs: jobs.getDelayMs(),
        quietHours: jobs.getQuietHours(),
        quietHoursTimezone: jobs.getTimezone(),
        inQuietHoursNow: jobs.isInQuietHours(),
      },
      refreshQueue: (queueAgg as any).rows?.[0] ?? {
        depth: 0,
        ready: 0,
        locked: 0,
        maxPriority: 0,
        oldestRequestedAt: null,
        nextAttemptAt: null,
      },
      backups: (backupAgg as any).rows?.[0] ?? {
        totalPlannings: 0,
        totalBackups: 0,
        missingBackups: 0,
        oldestBackupUpdatedAt: null,
        staleOver1h: 0,
        staleOver6h: 0,
        staleOver24h: 0,
      },
      queueTop: (topQueue as any).rows ?? [],
    }
  })
