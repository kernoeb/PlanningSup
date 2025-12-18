import type { Database } from '@api/db'
import type { JobContext } from './utils/types'

import { planningsBackupTable, planningsRefreshStateTable, planningsTable } from '@api/db/schemas/plannings'
import { jobsLogger } from '@api/utils/logger'
import { enqueuePlanningRefreshBatch } from '@api/utils/plannings-backup'

import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm'

import { JOB_ID } from './utils/ids'
import { isInQuietHours } from './utils/quiet-hours'
import { updateJobRuntime } from './utils/runtime'

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function waitForAbort(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

async function sleepOrAbort(ms: number, signal: AbortSignal) {
  if (signal.aborted) return
  await Promise.race([sleep(ms), waitForAbort(signal)])
}

function envNumber(key: string, fallback: number) {
  const raw = Bun.env[key]
  if (raw == null) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

export async function runOnce(db: Database) {
  const staleAfterHours = envNumber('PLANNINGS_BACKFILL_STALE_AFTER_HOURS', 6)
  const missingLimit = envNumber('PLANNINGS_BACKFILL_MISSING_LIMIT', 500)
  const staleLimit = envNumber('PLANNINGS_BACKFILL_STALE_LIMIT', 500)

  const missingRows = await db
    .select({ fullId: planningsTable.fullId })
    .from(planningsTable)
    .leftJoin(planningsBackupTable, eq(planningsBackupTable.planningFullId, planningsTable.fullId))
    .leftJoin(planningsRefreshStateTable, eq(planningsRefreshStateTable.planningFullId, planningsTable.fullId))
    .where(and(
      isNull(planningsBackupTable.planningFullId),
      or(isNull(planningsRefreshStateTable.disabledUntil), lt(planningsRefreshStateTable.disabledUntil, sql`now()`)),
    ))
    .limit(missingLimit)

  const staleRows = await db
    .select({ fullId: planningsBackupTable.planningFullId })
    .from(planningsBackupTable)
    .leftJoin(planningsRefreshStateTable, eq(planningsRefreshStateTable.planningFullId, planningsBackupTable.planningFullId))
    .where(and(
      lt(planningsBackupTable.updatedAt, sql`now() - (${staleAfterHours} * interval '1 hour')`),
      or(isNull(planningsRefreshStateTable.disabledUntil), lt(planningsRefreshStateTable.disabledUntil, sql`now()`)),
    ))
    .orderBy(asc(planningsBackupTable.updatedAt))
    .limit(staleLimit)

  const ids = new Set<string>()
  for (const row of missingRows) ids.add(row.fullId)
  for (const row of staleRows) ids.add(row.fullId)

  const planningFullIds = [...ids]
  if (planningFullIds.length === 0) {
    return { enqueued: 0 }
  }

  await enqueuePlanningRefreshBatch(planningFullIds, 1)
  return { enqueued: planningFullIds.length }
}

export async function start(db: Database, signal: AbortSignal, ctx: JobContext) {
  const intervalMs = envNumber('PLANNINGS_BACKFILL_INTERVAL_MS', 10 * 60_000)

  jobsLogger.info('Starting plannings backfill (intervalMs={intervalMs})', { intervalMs })
  updateJobRuntime(JOB_ID.planningsBackfill, { state: 'idle' })

  for (;;) {
    if (signal.aborted) return
    updateJobRuntime(JOB_ID.planningsBackfill, { lastLoopAt: new Date() })
    if (ctx.isPaused()) {
      updateJobRuntime(JOB_ID.planningsBackfill, { state: 'paused', lastPausedWaitAt: new Date() })
      await ctx.waitForResumeOrStop(signal)
      updateJobRuntime(JOB_ID.planningsBackfill, { state: 'idle' })
      continue
    }

    if (isInQuietHours(ctx.quietHours, new Date(), ctx.timezone)) {
      updateJobRuntime(JOB_ID.planningsBackfill, { state: 'quiet_hours', lastQuietHoursSkipAt: new Date() })
      await sleepOrAbort(60_000, signal)
      continue
    }

    try {
      updateJobRuntime(JOB_ID.planningsBackfill, { state: 'working' })
      const result = await runOnce(db)
      updateJobRuntime(JOB_ID.planningsBackfill, { state: 'idle', lastWorkAt: new Date() })
      jobsLogger.info('Backfill enqueued {count} planning(s)', { count: result.enqueued })
    } catch (error) {
      updateJobRuntime(JOB_ID.planningsBackfill, {
        state: 'idle',
        lastErrorAt: new Date(),
        lastError: error instanceof Error ? (error.stack || error.message) : String(error),
      })
      jobsLogger.warn('Backfill failed: {error}', { error })
    }

    await sleepOrAbort(intervalMs, signal)
  }
}
