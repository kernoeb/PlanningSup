import { env } from '@api/config/env'
import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshQueueTable, planningsRefreshStateTable, planningsTable } from '@api/db/schemas/plannings'
import { jobs } from '@api/jobs'

import { asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'

const LOCK_TTL_MINUTES = 5
const DEFAULT_MAX_ATTEMPTS = 10

function readOpsToken() {
  return env('OPS_TOKEN')
}

function isAuthorized(headers: Headers) {
  const token = readOpsToken()

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
    const maxAttempts = env('PLANNINGS_REFRESH_WORKER_MAX_ATTEMPTS', { default: DEFAULT_MAX_ATTEMPTS })

    const [refreshQueueRow] = await db
      .select({
        depth: sql<number>`count(*) filter (where ${planningsRefreshQueueTable.attempts} < ${maxAttempts})::int`,
        ready: sql<number>`count(*) filter (
          where ${planningsRefreshQueueTable.nextAttemptAt} <= now()
            and ${planningsRefreshQueueTable.attempts} < ${maxAttempts}
            and (
              ${planningsRefreshQueueTable.lockedAt} is null
              or ${planningsRefreshQueueTable.lockedAt} < (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
            )
        )::int`,
        locked: sql<number>`count(*) filter (
          where ${planningsRefreshQueueTable.lockedAt} is not null
            and ${planningsRefreshQueueTable.lockedAt} >= (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
            and ${planningsRefreshQueueTable.attempts} < ${maxAttempts}
        )::int`,
        maxPriority: sql<number | null>`max(${planningsRefreshQueueTable.priority})::int`,
        oldestRequestedAt: sql<Date | null>`min(${planningsRefreshQueueTable.requestedAt})`,
        nextAttemptAt: sql<Date | null>`min(${planningsRefreshQueueTable.nextAttemptAt})`,
      })
      .from(planningsRefreshQueueTable)

    const [refreshStateRow] = await db
      .select({
        disabled: sql<number>`count(*) filter (where ${planningsRefreshStateTable.disabledUntil} > now())::int`,
        oldestDisabledUntil: sql<Date | null>`min(${planningsRefreshStateTable.disabledUntil})`,
        mostRecentSuccessAt: sql<Date | null>`max(${planningsRefreshStateTable.lastSuccessAt})`,
      })
      .from(planningsRefreshStateTable)

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
      .where(sql`${planningsRefreshQueueTable.attempts} < ${maxAttempts}`)
      .orderBy(desc(planningsRefreshQueueTable.priority), asc(planningsRefreshQueueTable.requestedAt))
      .limit(20)

    return {
      jobs: {
        runJobs: env('RUN_JOBS', { default: true }),
        started: jobs.isStarted(),
        paused: jobs.isPaused(),
        pausedMeaning: 'manual',
        quietHours: jobs.getQuietHours(),
        quietHoursTimezone: jobs.getTimezone(),
        inQuietHoursNow: jobs.isInQuietHours(),
        quietHoursMeaning: 'advisory',
        quietHoursRespectedBy: {
          // Backfill is periodic/background and should pause during quiet hours.
          planningsBackfill: true,
          // Refresh worker is user-triggered/low-latency and intentionally ignores quiet hours.
          planningsRefreshWorker: false,
        },
        runtime: jobs.getRuntime(),
      },
      workers: {
        refreshWorker: {
          minPollMs: env('PLANNINGS_REFRESH_WORKER_MIN_POLL_MS', { default: 1_000 }),
          maxPollMs: env('PLANNINGS_REFRESH_WORKER_MAX_POLL_MS', { default: 30_000 }),
          batchSize: env('PLANNINGS_REFRESH_WORKER_BATCH_SIZE', { default: 50 }),
          concurrency: env('PLANNINGS_REFRESH_WORKER_CONCURRENCY', { default: 2 }),
          perHostConcurrency: env('PLANNINGS_REFRESH_WORKER_PER_HOST_CONCURRENCY', { default: 2 }),
          drainBudgetMs: env('PLANNINGS_REFRESH_WORKER_DRAIN_BUDGET_MS', { default: 20_000 }),
          maxAttempts: env('PLANNINGS_REFRESH_WORKER_MAX_ATTEMPTS', { default: 10 }),
        },
        backfill: {
          intervalMs: env('PLANNINGS_BACKFILL_INTERVAL_MS', { default: 10 * 60_000 }),
          staleAfterHours: env('PLANNINGS_BACKFILL_STALE_AFTER_HOURS', { default: 6 }),
          missingLimit: env('PLANNINGS_BACKFILL_MISSING_LIMIT', { default: 500 }),
          staleLimit: env('PLANNINGS_BACKFILL_STALE_LIMIT', { default: 500 }),
        },
      },
      refreshQueue: refreshQueueRow ?? {
        depth: 0,
        ready: 0,
        locked: 0,
        maxPriority: 0,
        oldestRequestedAt: null,
        nextAttemptAt: null,
      },
      refreshState: refreshStateRow ?? {
        disabled: 0,
        oldestDisabledUntil: null,
        mostRecentSuccessAt: null,
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
