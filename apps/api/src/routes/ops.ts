import config from '@api/config'
import { env } from '@api/config/env'
import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshQueueTable, planningsRefreshStateTable, planningsTable } from '@api/db/schemas/plannings'
import { jobs } from '@api/jobs'

import { asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'

const LOCK_TTL_MINUTES = 5
const DEFAULT_MAX_ATTEMPTS = 10

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface HealthCheck {
  status: HealthStatus
  issues: string[]
  checkedAt: Date
}

function readOpsToken() {
  return env('OPS_TOKEN')
}

function isAuthorized(headers: Headers) {
  const token = readOpsToken()

  // In production, require an explicit token.
  if (config.isProduction) {
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
        total: sql<number>`count(*)::int`,
        disabled: sql<number>`count(*) filter (where ${planningsRefreshStateTable.disabledUntil} > now())::int`,
        oldestDisabledUntil: sql<Date | null>`min(${planningsRefreshStateTable.disabledUntil}) filter (where ${planningsRefreshStateTable.disabledUntil} > now())`,
        mostRecentSuccessAt: sql<Date | null>`max(${planningsRefreshStateTable.lastSuccessAt})`,
        // Actual refresh freshness (based on last_success_at, not content change)
        refreshedLast1h: sql<number>`count(*) filter (where ${planningsRefreshStateTable.lastSuccessAt} > now() - interval '1 hour')::int`,
        refreshedLast6h: sql<number>`count(*) filter (where ${planningsRefreshStateTable.lastSuccessAt} > now() - interval '6 hours')::int`,
        refreshedLast24h: sql<number>`count(*) filter (where ${planningsRefreshStateTable.lastSuccessAt} > now() - interval '24 hours')::int`,
        neverRefreshed: sql<number>`count(*) filter (where ${planningsRefreshStateTable.lastSuccessAt} is null)::int`,
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

    // Compute health status
    const now = Date.now()
    const runtime = jobs.getRuntime()
    const backfillIntervalMs = env('PLANNINGS_BACKFILL_INTERVAL_MS', { default: 10 * 60_000 })
    const refreshWorkerMaxPollMs = env('PLANNINGS_REFRESH_WORKER_MAX_POLL_MS', { default: 30_000 })
    const totalPlannings = planningsAggRow?.totalPlannings ?? 0
    const totalBackups = backupAggRow?.totalBackups ?? 0
    const disabled = refreshStateRow?.disabled ?? 0

    const issues: string[] = []

    // Check if jobs system is running
    if (!jobs.isStarted()) {
      issues.push('Jobs system not started')
    } else if (jobs.isPaused()) {
      issues.push('Jobs system paused')
    }

    // Check backfill job health (should loop within 2x interval)
    const backfillRuntime = runtime['plannings-backfill']
    if (backfillRuntime) {
      const lastLoopAt = backfillRuntime.lastLoopAt ? new Date(backfillRuntime.lastLoopAt).getTime() : 0
      const backfillStaleMs = backfillIntervalMs * 2.5
      if (lastLoopAt > 0 && now - lastLoopAt > backfillStaleMs) {
        issues.push(`Backfill job stale (last loop ${Math.round((now - lastLoopAt) / 60_000)}m ago, expected every ${Math.round(backfillIntervalMs / 60_000)}m)`)
      }
    }

    // Check refresh worker health (should loop within 2x max poll)
    const refreshRuntime = runtime['plannings-refresh-worker']
    if (refreshRuntime) {
      const lastLoopAt = refreshRuntime.lastLoopAt ? new Date(refreshRuntime.lastLoopAt).getTime() : 0
      const refreshStaleMs = refreshWorkerMaxPollMs * 3
      if (lastLoopAt > 0 && now - lastLoopAt > refreshStaleMs) {
        issues.push(`Refresh worker stale (last loop ${Math.round((now - lastLoopAt) / 1_000)}s ago)`)
      }
    }

    // Check for stuck queue (items ready but none being processed)
    const queueReady = refreshQueueRow?.ready ?? 0
    const queueLocked = refreshQueueRow?.locked ?? 0
    if (queueReady > 100 && queueLocked === 0 && refreshRuntime?.state === 'idle') {
      issues.push(`Queue has ${queueReady} ready items but refresh worker is idle`)
    }

    // Check disabled ratio (warn if > 10% of plannings are disabled)
    const disabledRatio = totalPlannings > 0 ? disabled / totalPlannings : 0
    if (disabledRatio > 0.1) {
      issues.push(`High disabled ratio: ${disabled}/${totalPlannings} (${(disabledRatio * 100).toFixed(1)}%)`)
    }

    // Check for missing backups that aren't disabled
    const missingBackups = missingBackupsRow?.missingBackups ?? 0
    const missingNotDisabled = missingBackups - disabled
    if (missingNotDisabled > 50) {
      issues.push(`${missingNotDisabled} plannings missing backups (not disabled)`)
    }

    // Determine overall status
    let status: HealthStatus = 'healthy'
    if (issues.length > 0) {
      // Critical issues make it unhealthy
      const criticalPatterns = ['not started', 'stale', 'stuck']
      const hasCritical = issues.some(i => criticalPatterns.some(p => i.toLowerCase().includes(p)))
      status = hasCritical ? 'unhealthy' : 'degraded'
    }

    const health: HealthCheck = {
      status,
      issues,
      checkedAt: new Date(),
    }

    return {
      health,
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
        runtime,
      },
      workers: {
        refreshWorker: {
          minPollMs: env('PLANNINGS_REFRESH_WORKER_MIN_POLL_MS', { default: 1_000 }),
          maxPollMs: refreshWorkerMaxPollMs,
          batchSize: env('PLANNINGS_REFRESH_WORKER_BATCH_SIZE', { default: 50 }),
          concurrency: env('PLANNINGS_REFRESH_WORKER_CONCURRENCY', { default: 2 }),
          perHostConcurrency: env('PLANNINGS_REFRESH_WORKER_PER_HOST_CONCURRENCY', { default: 2 }),
          drainBudgetMs: env('PLANNINGS_REFRESH_WORKER_DRAIN_BUDGET_MS', { default: 20_000 }),
          maxAttempts,
        },
        backfill: {
          intervalMs: backfillIntervalMs,
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
      refreshState: {
        total: refreshStateRow?.total ?? 0,
        disabled: refreshStateRow?.disabled ?? 0,
        oldestDisabledUntil: refreshStateRow?.oldestDisabledUntil ?? null,
        mostRecentSuccessAt: refreshStateRow?.mostRecentSuccessAt ?? null,
        // Actual refresh freshness (when plannings were last fetched, regardless of content change)
        refreshedLast1h: refreshStateRow?.refreshedLast1h ?? 0,
        refreshedLast6h: refreshStateRow?.refreshedLast6h ?? 0,
        refreshedLast24h: refreshStateRow?.refreshedLast24h ?? 0,
        neverRefreshed: refreshStateRow?.neverRefreshed ?? 0,
      },
      backups: {
        totalPlannings,
        totalBackups,
        missingBackups,
        missingExplained: `${disabled} disabled + ${Math.max(0, missingBackups - disabled)} other`,
        oldestBackupUpdatedAt: backupAggRow?.oldestBackupUpdatedAt ?? null,
        // Content staleness (when backup content last changed, NOT when last refreshed)
        contentStaleOver1h: backupAggRow?.staleOver1h ?? 0,
        contentStaleOver6h: backupAggRow?.staleOver6h ?? 0,
        contentStaleOver24h: backupAggRow?.staleOver24h ?? 0,
        contentStaleMeaning: 'Measures when content last CHANGED, not when last refreshed. High numbers are normal if calendars are stable.',
      },
      queueTop,
    }
  })
