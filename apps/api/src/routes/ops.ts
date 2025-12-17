import config from '@api/config'
import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshQueueTable, planningsTable } from '@api/db/schemas/plannings'
import { jobs } from '@api/jobs'

import { asc, desc, eq, isNull, sql } from 'drizzle-orm'
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
    const [refreshQueueRow] = await db
      .select({
        depth: sql<number>`count(*)::int`,
        ready: sql<number>`count(*) filter (
          where ${planningsRefreshQueueTable.nextAttemptAt} <= now()
            and (
              ${planningsRefreshQueueTable.lockedAt} is null
              or ${planningsRefreshQueueTable.lockedAt} < (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
            )
        )::int`,
        locked: sql<number>`count(*) filter (
          where ${planningsRefreshQueueTable.lockedAt} is not null
            and ${planningsRefreshQueueTable.lockedAt} >= (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
        )::int`,
        maxPriority: sql<number | null>`max(${planningsRefreshQueueTable.priority})::int`,
        oldestRequestedAt: sql<Date | null>`min(${planningsRefreshQueueTable.requestedAt})`,
        nextAttemptAt: sql<Date | null>`min(${planningsRefreshQueueTable.nextAttemptAt})`,
      })
      .from(planningsRefreshQueueTable)

    const [planningsAggRow] = await db
      .select({
        totalPlannings: sql<number>`count(*)::int`,
      })
      .from(planningsTable)

    const [missingBackupsRow] = await db
      .select({
        missingBackups: sql<number>`count(*)::int`,
      })
      .from(planningsTable)
      .leftJoin(planningsBackupTable, eq(planningsBackupTable.planningFullId, planningsTable.fullId))
      .where(isNull(planningsBackupTable.planningFullId))

    const [backupAggRow] = await db
      .select({
        totalBackups: sql<number>`count(*)::int`,
        oldestBackupUpdatedAt: sql<Date | null>`min(${planningsBackupTable.updatedAt})`,
        staleOver1h: sql<number>`count(*) filter (where ${planningsBackupTable.updatedAt} < (now() - interval '1 hour'))::int`,
        staleOver6h: sql<number>`count(*) filter (where ${planningsBackupTable.updatedAt} < (now() - interval '6 hours'))::int`,
        staleOver24h: sql<number>`count(*) filter (where ${planningsBackupTable.updatedAt} < (now() - interval '24 hours'))::int`,
      })
      .from(planningsBackupTable)

    const queueTop = await db
      .select({
        planningFullId: planningsRefreshQueueTable.planningFullId,
        priority: planningsRefreshQueueTable.priority,
        attempts: planningsRefreshQueueTable.attempts,
        requestedAt: planningsRefreshQueueTable.requestedAt,
        nextAttemptAt: planningsRefreshQueueTable.nextAttemptAt,
        lockedAt: planningsRefreshQueueTable.lockedAt,
        lockOwner: planningsRefreshQueueTable.lockOwner,
        lastError: planningsRefreshQueueTable.lastError,
      })
      .from(planningsRefreshQueueTable)
      .orderBy(desc(planningsRefreshQueueTable.priority), asc(planningsRefreshQueueTable.requestedAt))
      .limit(20)

    return {
      jobs: {
        runJobs: config.jobs.runJobs,
        paused: jobs.isPaused(),
        delayMs: jobs.getDelayMs(),
        quietHours: jobs.getQuietHours(),
        quietHoursTimezone: jobs.getTimezone(),
        inQuietHoursNow: jobs.isInQuietHours(),
      },
      refreshQueue: refreshQueueRow ?? {
        depth: 0,
        ready: 0,
        locked: 0,
        maxPriority: 0,
        oldestRequestedAt: null,
        nextAttemptAt: null,
      },
      backups: {
        totalPlannings: planningsAggRow?.totalPlannings ?? 0,
        totalBackups: backupAggRow?.totalBackups ?? 0,
        missingBackups: missingBackupsRow?.missingBackups ?? 0,
        oldestBackupUpdatedAt: backupAggRow?.oldestBackupUpdatedAt ?? null,
        staleOver1h: backupAggRow?.staleOver1h ?? 0,
        staleOver6h: backupAggRow?.staleOver6h ?? 0,
        staleOver24h: backupAggRow?.staleOver24h ?? 0,
      },
      queueTop,
    }
  })
