import config from '@api/config'
import { env } from '@api/config/env'
import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshQueueTable, planningsRefreshStateTable, planningsTable } from '@api/db/schemas/plannings'
import { jobs } from '@api/jobs'
import { getLastBackupWrite } from '@api/utils/plannings-backup'

import { desc, eq, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'

const LOCK_TTL_MINUTES = 5
const DEFAULT_MAX_ATTEMPTS = 10

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

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

const HealthStatusSchema = t.Union([
  t.Literal('healthy'),
  t.Literal('degraded'),
  t.Literal('unhealthy'),
], { description: 'Overall health status of the plannings system' })

const JobRuntimeStateSchema = t.Union([
  t.Literal('starting'),
  t.Literal('idle'),
  t.Literal('working'),
  t.Literal('paused'),
  t.Literal('quiet_hours'),
  t.Literal('stopped'),
  t.Literal('exited'),
  t.Literal('crashed'),
  t.Literal('unknown'),
], { description: 'State of a background job worker' })

const LastBackupWriteSchema = t.Object({
  planningFullId: t.String({ description: 'ID of the planning that was backed up' }),
  changed: t.Boolean({ description: 'Whether the backup data changed from the previous version' }),
  nbEvents: t.Number({ description: 'Number of events in the backup' }),
  at: t.Date({ description: 'Timestamp when the backup was written' }),
}, { description: 'Information about the most recent backup write operation' })

const OpsHealthResponse = t.Object({
  status: HealthStatusSchema,
  issues: t.Array(t.String(), { description: 'List of detected health issues' }),
  workers: t.Object({
    backfill: JobRuntimeStateSchema,
    refreshWorker: JobRuntimeStateSchema,
  }, { description: 'Current state of background workers' }),
  inQuietHours: t.Boolean({ description: 'Whether the system is currently in quiet hours (reduced activity)' }),
  queue: t.Object({
    depth: t.Number({ description: 'Total items in the refresh queue' }),
    ready: t.Number({ description: 'Items ready to be processed' }),
    locked: t.Number({ description: 'Items currently being processed' }),
  }, { description: 'Refresh queue statistics' }),
  backups: t.Object({
    total: t.Number({ description: 'Total number of plannings' }),
    covered: t.Number({ description: 'Number of plannings with backups' }),
    disabled: t.Number({ description: 'Number of plannings with disabled refresh' }),
  }, { description: 'Backup coverage statistics' }),
  lastBackupWrite: t.Nullable(LastBackupWriteSchema),
  failedHosts: t.Nullable(t.Array(t.Object({
    host: t.String({ description: 'Host name' }),
    count: t.Number({ description: 'Number of failed plannings on this host' }),
    lastFailure: t.Nullable(t.String({ description: 'Most recent failure type' })),
  })), { description: 'Hosts with the most failures' }),
  recentFailures: t.Nullable(t.Array(t.Object({
    planningFullId: t.String({ description: 'Full planning ID' }),
    failureKind: t.Nullable(t.String({ description: 'Type of failure' })),
    failures: t.Number({ description: 'Consecutive failure count' }),
    disabledUntil: t.Nullable(t.Date({ description: 'When the planning will be re-enabled' })),
  })), { description: 'Most recently failed plannings' }),
})

export default new Elysia({
  prefix: '/ops',
  tags: ['Operations'],
  detail: {
    security: [{ opsToken: [] }],
  },
})
  .onBeforeHandle(({ request, set }) => {
    if (!isAuthorized(request.headers)) {
      set.status = 404
      return { error: 'NOT_FOUND' }
    }
  })
  .get('/plannings', async () => {
    const maxAttempts = env('PLANNINGS_REFRESH_WORKER_MAX_ATTEMPTS', { default: DEFAULT_MAX_ATTEMPTS })
    const backfillIntervalMs = env('PLANNINGS_BACKFILL_INTERVAL_MS', { default: 10 * 60_000 })
    const refreshWorkerMaxPollMs = env('PLANNINGS_REFRESH_WORKER_MAX_POLL_MS', { default: 30_000 })

    // Queue stats
    const [queueRow] = await db
      .select({
        depth: sql<number>`count(*) filter (where ${planningsRefreshQueueTable.attempts} < ${maxAttempts})::int`,
        ready: sql<number>`count(*) filter (
          where ${planningsRefreshQueueTable.nextAttemptAt} <= now()
            and ${planningsRefreshQueueTable.attempts} < ${maxAttempts}
            and (${planningsRefreshQueueTable.lockedAt} is null or ${planningsRefreshQueueTable.lockedAt} < (now() - (${LOCK_TTL_MINUTES} * interval '1 minute')))
        )::int`,
        locked: sql<number>`count(*) filter (
          where ${planningsRefreshQueueTable.lockedAt} is not null
            and ${planningsRefreshQueueTable.lockedAt} >= (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
            and ${planningsRefreshQueueTable.attempts} < ${maxAttempts}
        )::int`,
      })
      .from(planningsRefreshQueueTable)

    // Backup coverage
    const [backupRow] = await db
      .select({
        total: sql<number>`count(*)::int`,
        withBackup: sql<number>`count(${planningsBackupTable.planningFullId})::int`,
      })
      .from(planningsTable)
      .leftJoin(planningsBackupTable, eq(planningsBackupTable.planningFullId, planningsTable.fullId))

    // Disabled count
    const [disabledRow] = await db
      .select({
        count: sql<number>`count(*) filter (where ${planningsRefreshStateTable.disabledUntil} > now())::int`,
      })
      .from(planningsRefreshStateTable)

    // Problematic hosts (group failures by host)
    const failedHosts = await db
      .select({
        host: sql<string>`split_part(${planningsRefreshStateTable.planningFullId}, '.', 1)`,
        count: sql<number>`count(*)::int`,
        lastFailure: sql<string>`max(${planningsRefreshStateTable.lastFailureKind})`,
      })
      .from(planningsRefreshStateTable)
      .where(sql`${planningsRefreshStateTable.disabledUntil} > now()`)
      .groupBy(sql`split_part(${planningsRefreshStateTable.planningFullId}, '.', 1)`)
      .orderBy(desc(sql`count(*)`))
      .limit(5)

    // Recent failures (last 5 plannings that failed)
    const recentFailures = await db
      .select({
        planningFullId: planningsRefreshStateTable.planningFullId,
        failureKind: planningsRefreshStateTable.lastFailureKind,
        failures: planningsRefreshStateTable.consecutiveFailures,
        disabledUntil: planningsRefreshStateTable.disabledUntil,
      })
      .from(planningsRefreshStateTable)
      .where(sql`${planningsRefreshStateTable.disabledUntil} > now()`)
      .orderBy(desc(planningsRefreshStateTable.updatedAt))
      .limit(5)

    // Compute health
    const now = Date.now()
    const runtime = jobs.getRuntime()
    const issues: string[] = []

    if (!jobs.isStarted()) {
      issues.push('Jobs not started')
    } else if (jobs.isPaused()) {
      issues.push('Jobs paused')
    }

    const backfillRuntime = runtime['plannings-backfill']
    if (backfillRuntime?.lastLoopAt) {
      const lastLoopAt = new Date(backfillRuntime.lastLoopAt).getTime()
      if (now - lastLoopAt > backfillIntervalMs * 2.5) {
        issues.push(`Backfill stale (${Math.round((now - lastLoopAt) / 60_000)}m ago)`)
      }
    }

    const refreshRuntime = runtime['plannings-refresh-worker']
    if (refreshRuntime?.lastLoopAt) {
      const lastLoopAt = new Date(refreshRuntime.lastLoopAt).getTime()
      if (now - lastLoopAt > refreshWorkerMaxPollMs * 3) {
        issues.push(`Refresh worker stale (${Math.round((now - lastLoopAt) / 1_000)}s ago)`)
      }
    }

    const queueReady = queueRow?.ready ?? 0
    const queueLocked = queueRow?.locked ?? 0
    if (queueReady > 100 && queueLocked === 0 && refreshRuntime?.state === 'idle') {
      issues.push(`Queue stuck: ${queueReady} ready but worker idle`)
    }

    const disabled = disabledRow?.count ?? 0
    const total = backupRow?.total ?? 0
    if (total > 0 && disabled / total > 0.1) {
      issues.push(`High disabled: ${disabled}/${total} (${(disabled / total * 100).toFixed(0)}%)`)
    }

    let status: HealthStatus = 'healthy'
    if (issues.length > 0) {
      const critical = ['not started', 'stale', 'stuck']
      status = issues.some(i => critical.some(c => i.toLowerCase().includes(c))) ? 'unhealthy' : 'degraded'
    }

    return {
      status,
      issues,
      workers: {
        backfill: backfillRuntime?.state ?? 'unknown',
        refreshWorker: refreshRuntime?.state ?? 'unknown',
      },
      inQuietHours: jobs.isInQuietHours(),
      queue: {
        depth: queueRow?.depth ?? 0,
        ready: queueReady,
        locked: queueLocked,
      },
      backups: {
        total,
        covered: backupRow?.withBackup ?? 0,
        disabled,
      },
      lastBackupWrite: getLastBackupWrite(),
      failedHosts: failedHosts.length > 0 ? failedHosts : null,
      recentFailures: recentFailures.length > 0 ? recentFailures : null,
    }
  }, {
    response: OpsHealthResponse,
    detail: {
      summary: 'Get plannings health status',
      description: 'Returns health status of the plannings refresh system including queue stats, backup coverage, and recent failures. Requires x-ops-token header.',
    },
  })
