import type { Database } from '@api/db'
import type { JobContext } from './utils/types'

import process from 'process'

import { jobsLogger } from '@api/utils/logger'

import { JOB_ID } from './utils/ids'
import { registerJobPoke } from './utils/poke'
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

function createWakeup() {
  let resolve: (() => void) | null = null
  let promise = new Promise<void>((r) => {
    resolve = r
  })

  return {
    poke() {
      resolve?.()
      promise = new Promise<void>((r) => {
        resolve = r
      })
    },
    async wait(ms: number, signal: AbortSignal) {
      if (signal.aborted) return
      await Promise.race([promise, sleep(ms), waitForAbort(signal)])
    },
  }
}

function envNumber(key: string, fallback: number) {
  const raw = Bun.env[key]
  if (raw == null) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function envLogIntervalMs() {
  // In tests we disable periodic logs by default to keep output clean.
  const fallback = Bun.env.NODE_ENV === 'test' ? 0 : 30_000
  return envNumber('PLANNINGS_REFRESH_WORKER_LOG_INTERVAL_MS', fallback)
}

function envSweepIntervalMs() {
  const fallback = Bun.env.NODE_ENV === 'test' ? 0 : 10 * 60_000
  return envNumber('PLANNINGS_REFRESH_WORKER_SWEEP_INTERVAL_MS', fallback)
}

export async function start(db: Database, signal: AbortSignal, ctx: JobContext) {
  const { fetchEventsDetailed: fetchEventsBase } = await import('@api/utils/events')
  const { upsertPlanningBackup } = await import('@api/utils/plannings-backup')
  const { flattenedPlannings } = await import('@api/plannings')
  const { drainRefreshQueue, sweepLegacyDeadQueueRows } = await import('./plannings-refresh-queue')
  const { createPerKeySemaphore } = await import('./utils/per-key-semaphore')

  const minPollMs = envNumber('PLANNINGS_REFRESH_WORKER_MIN_POLL_MS', 1_000)
  const maxPollMs = envNumber('PLANNINGS_REFRESH_WORKER_MAX_POLL_MS', 30_000)
  const batchSize = envNumber('PLANNINGS_REFRESH_WORKER_BATCH_SIZE', 50)
  const drainBudgetMs = envNumber('PLANNINGS_REFRESH_WORKER_DRAIN_BUDGET_MS', 20_000)
  const concurrency = envNumber('PLANNINGS_REFRESH_WORKER_CONCURRENCY', 2)
  const maxAttempts = envNumber('PLANNINGS_REFRESH_WORKER_MAX_ATTEMPTS', 10)
  const perHostConcurrency = envNumber('PLANNINGS_REFRESH_WORKER_PER_HOST_CONCURRENCY', 2)
  const logIntervalMs = envLogIntervalMs()
  const sweepIntervalMs = envSweepIntervalMs()
  const sweepLimit = envNumber('PLANNINGS_REFRESH_WORKER_SWEEP_LIMIT', 250)

  const hostSem = createPerKeySemaphore<string>(perHostConcurrency)
  const fetchEvents = async (url: string) => {
    let host = 'unknown'
    try {
      host = new URL(url).host || 'unknown'
    } catch {}

    await hostSem.acquire(host)
    try {
      return await fetchEventsBase(url)
    } finally {
      hostSem.release(host)
    }
  }

  const wakeup = createWakeup()
  registerJobPoke(JOB_ID.planningsRefreshWorker, wakeup.poke)

  const owner = `refresh-worker:${process.pid}:${crypto.randomUUID()}`
  const planningUrlById = new Map(flattenedPlannings.map(p => [p.fullId, p.url]))

  let idleMs = minPollMs
  let lastLogAt = 0
  let lastSweepAt = 0
  let accPicked = 0
  let accDeleted = 0
  let accRequeued = 0
  let accFailed = 0

  jobsLogger.info(
    'Starting refresh worker (minPollMs={minPollMs}, maxPollMs={maxPollMs}, batchSize={batchSize}, concurrency={concurrency}, drainBudgetMs={drainBudgetMs})',
    { minPollMs, maxPollMs, batchSize, concurrency, drainBudgetMs, perHostConcurrency },
  )
  updateJobRuntime(JOB_ID.planningsRefreshWorker, { state: 'idle' })

  for (;;) {
    if (signal.aborted) return
    if (ctx.isPaused()) {
      updateJobRuntime(JOB_ID.planningsRefreshWorker, { state: 'paused', lastPausedWaitAt: new Date() })
      await ctx.waitForResumeOrStop(signal)
      updateJobRuntime(JOB_ID.planningsRefreshWorker, { state: 'idle' })
      idleMs = minPollMs
      continue
    }

    updateJobRuntime(JOB_ID.planningsRefreshWorker, { lastLoopAt: new Date() })
    const result = await drainRefreshQueue(
      db,
      { fetchEvents, upsertPlanningBackup, planningUrlById },
      signal,
      {
        batchSize,
        concurrency,
        maxRuntimeMs: drainBudgetMs,
        maxAttempts,
        pauseMs: 0,
        owner,
      },
    )

    if (signal.aborted) return

    accPicked += result.picked
    accDeleted += result.deleted
    accRequeued += result.requeued
    accFailed += result.failed

    if (result.picked > 0) {
      updateJobRuntime(JOB_ID.planningsRefreshWorker, { state: 'working', lastWorkAt: new Date() })
    } else {
      updateJobRuntime(JOB_ID.planningsRefreshWorker, { state: 'idle' })
    }

    if (sweepIntervalMs > 0) {
      const now = Date.now()
      if (now - lastSweepAt >= sweepIntervalMs) {
        lastSweepAt = now
        try {
          const sweep = await sweepLegacyDeadQueueRows(db, { maxAttempts, limit: sweepLimit })
          if (sweep.moved > 0) {
            jobsLogger.info('Refresh worker sweep: migrated {count} dead queue row(s) into refresh_state', { count: sweep.moved })
          }
        } catch (error) {
          jobsLogger.warn('Refresh worker sweep failed: {error}', { error })
        }
      }
    }

    if (logIntervalMs > 0) {
      const now = Date.now()
      if (now - lastLogAt >= logIntervalMs) {
        lastLogAt = now

        // Only compute queue aggregates when we are going to log (keeps CPU/DB light).
        const { planningsRefreshQueueTable } = await import('@api/db/schemas/plannings')
        const { sql } = await import('drizzle-orm')
        const LOCK_TTL_MINUTES = 5

        const [queue] = await db
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

        const shouldLog = accPicked > 0 || (queue?.depth ?? 0) > 0
        if (shouldLog) {
          jobsLogger.info(
            'Refresh worker progress (picked={picked}, deleted={deleted}, requeued={requeued}, failed={failed}, depth={depth}, ready={ready}, locked={locked}, maxPriority={maxPriority})',
            {
              picked: accPicked,
              deleted: accDeleted,
              requeued: accRequeued,
              failed: accFailed,
              depth: queue?.depth ?? 0,
              ready: queue?.ready ?? 0,
              locked: queue?.locked ?? 0,
              maxPriority: queue?.maxPriority ?? 0,
              oldestRequestedAt: queue?.oldestRequestedAt ?? null,
              nextAttemptAt: queue?.nextAttemptAt ?? null,
              owner,
            },
          )
        }

        accPicked = 0
        accDeleted = 0
        accRequeued = 0
        accFailed = 0
      }
    }

    if (result.picked > 0) {
      idleMs = minPollMs
      continue
    }

    await wakeup.wait(idleMs, signal)
    idleMs = Math.min(maxPollMs, Math.max(minPollMs, idleMs * 2))
  }
}
