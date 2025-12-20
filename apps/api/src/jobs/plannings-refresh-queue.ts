import type { Database } from '@api/db'
import type { FetchEventsDetailedResult } from '@api/utils/events'

import process from 'process'

import { jobsLogger } from '@api/utils/logger'

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const DEFAULT_BATCH_SIZE = 25
const DEFAULT_MAX_RUNTIME_MS = 20_000
const DEFAULT_PAUSE_MS = 100
const LOCK_TTL_MINUTES = 5
const DEFAULT_CONCURRENCY = 1

function jitterMs(ms: number) {
  if (Bun.env.NODE_ENV === 'test') return ms
  // +/- 20%
  const factor = 0.8 + (Math.random() * 0.4)
  return Math.max(0, Math.round(ms * factor))
}

function backoffMs(attempt: number, baseMs: number = 5_000) {
  // Exponential backoff with cap: 5s, 10s, 20s, ... up to 10m
  const ms = baseMs * 2 ** Math.max(0, attempt - 1)
  return Math.min(ms, 10 * 60_000)
}

function disabledUntilForFailure(failure: FetchEventsDetailedResult['failure']): string {
  // SQL interval literal.
  if (!failure) return '6 hours'
  if (failure.kind === 'http_4xx') {
    if (failure.status === 404) return '30 days'
    return '7 days'
  }
  if (failure.kind === 'parse_error' || failure.kind === 'invalid_body') return '24 hours'
  if (failure.kind === 'connection_refused') return '12 hours'
  return '6 hours'
}

export interface DrainResult {
  picked: number
  deleted: number
  requeued: number
  failed: number
}

export async function drainRefreshQueue(db: Database, deps: {
  fetchEvents: (url: string) => Promise<FetchEventsDetailedResult>
  upsertPlanningBackup: (db: Database, planningFullId: string, events: Array<{ uid: string, summary: string, startDate: Date, endDate: Date, location: string, description: string }>) => Promise<{ changed: boolean, nbEvents: number }>
  planningUrlById: ReadonlyMap<string, string>
}, signal?: AbortSignal, options?: {
  batchSize?: number
  maxRuntimeMs?: number
  pauseMs?: number
  concurrency?: number
  maxAttempts?: number
  owner?: string
}) {
  const { planningsRefreshQueueTable } = await import('@api/db/schemas/plannings')
  const { planningsRefreshStateTable } = await import('@api/db/schemas/plannings')
  const { eq, sql } = await import('drizzle-orm')

  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
  const maxRuntimeMs = options?.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS
  const pauseMs = options?.pauseMs ?? DEFAULT_PAUSE_MS
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 10)

  const owner = options?.owner ?? `jobs:${process.pid}:${crypto.randomUUID()}`
  const start = Date.now()

  const totals: DrainResult = { picked: 0, deleted: 0, requeued: 0, failed: 0 }

  for (;;) {
    if (signal?.aborted) return totals
    if (Date.now() - start > maxRuntimeMs) return totals

    // Claim a batch with SKIP LOCKED so multiple workers can cooperate safely.
    const rows = await db.execute<{ planningFullId: string, attempts: number, priority: number }>(sql`
      with picked as (
        select planning_full_id
        from ${planningsRefreshQueueTable}
        where ${planningsRefreshQueueTable.nextAttemptAt} <= now()
          and ${planningsRefreshQueueTable.attempts} < ${maxAttempts}
          and (
            ${planningsRefreshQueueTable.lockedAt} is null
            or ${planningsRefreshQueueTable.lockedAt} < (now() - (${LOCK_TTL_MINUTES} * interval '1 minute'))
          )
        order by ${planningsRefreshQueueTable.priority} desc, ${planningsRefreshQueueTable.requestedAt} asc
        limit ${batchSize}
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

    if (rows.length === 0) {
      if (totals.picked > 0) {
        jobsLogger.info('Refresh queue drained (picked={picked}, deleted={deleted}, requeued={requeued}, failed={failed}, owner={owner})', {
          ...totals,
          owner,
        })
      }
      return totals
    }

    totals.picked += rows.length

    let nextIndex = 0
    const runOne = async () => {
      for (;;) {
        if (signal?.aborted) return
        const idx = nextIndex++
        const row = rows[idx]
        if (!row) return

        // `attempts` is incremented when claiming the row, and the returning value reflects it.
        // We allow exactly `maxAttempts` fetch attempts.
        const attemptNumber = row.attempts

        const url = deps.planningUrlById.get(row.planningFullId)
        if (!url) {
          // Planning no longer exists in resources; drop it from queue.
          await db.delete(planningsRefreshQueueTable).where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
          totals.deleted++
          continue
        }

        try {
          const { events, failure } = await deps.fetchEvents(url)
          if (!events) {
            if (attemptNumber >= maxAttempts) {
              await db.transaction(async (tx) => {
                const interval = disabledUntilForFailure(failure)
                await tx
                  .insert(planningsRefreshStateTable)
                  .values({
                    planningFullId: row.planningFullId,
                    disabledUntil: sql`now() + (${interval}::interval)`,
                    consecutiveFailures: attemptNumber,
                    lastFailureKind: failure?.kind ?? 'max_attempts',
                    lastError: 'max_attempts',
                    lastAttemptAt: sql`now()`,
                    updatedAt: sql`now()`,
                  })
                  .onConflictDoUpdate({
                    target: planningsRefreshStateTable.planningFullId,
                    set: {
                      disabledUntil: sql`now() + (${interval}::interval)`,
                      consecutiveFailures: sql`${planningsRefreshStateTable.consecutiveFailures} + 1`,
                      lastFailureKind: failure?.kind ?? 'max_attempts',
                      lastError: 'max_attempts',
                      lastAttemptAt: sql`now()`,
                      updatedAt: sql`now()`,
                    },
                  })
                await tx.delete(planningsRefreshQueueTable).where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
              })
              totals.failed++
              totals.deleted++
              continue
            }

            if (failure?.kind === 'http_4xx') {
              const status = Number.isFinite(failure.status ?? Number.NaN) ? (failure.status as number) : 400
              await db.transaction(async (tx) => {
                const interval = disabledUntilForFailure(failure)
                await tx
                  .insert(planningsRefreshStateTable)
                  .values({
                    planningFullId: row.planningFullId,
                    disabledUntil: sql`now() + (${interval}::interval)`,
                    consecutiveFailures: sql`1`,
                    lastFailureKind: failure.kind,
                    lastError: `http_${status}`,
                    lastAttemptAt: sql`now()`,
                    updatedAt: sql`now()`,
                  })
                  .onConflictDoUpdate({
                    target: planningsRefreshStateTable.planningFullId,
                    set: {
                      disabledUntil: sql`now() + (${interval}::interval)`,
                      consecutiveFailures: sql`${planningsRefreshStateTable.consecutiveFailures} + 1`,
                      lastFailureKind: failure.kind,
                      lastError: `http_${status}`,
                      lastAttemptAt: sql`now()`,
                      updatedAt: sql`now()`,
                    },
                  })
                await tx.delete(planningsRefreshQueueTable).where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
              })
              totals.failed++
              totals.deleted++
              continue
            }

            let baseMs = 5_000
            if (failure?.kind === 'connection_refused') baseMs = 30_000
            if (failure?.kind === 'timeout') baseMs = 10_000
            if (failure?.kind === 'parse_error' || failure?.kind === 'invalid_body') baseMs = 60_000

            let delayMs = backoffMs(attemptNumber, baseMs)
            if (failure?.kind === 'http_429' && failure.retryAfterMs != null) {
              delayMs = Math.max(delayMs, failure.retryAfterMs)
            }
            delayMs = jitterMs(delayMs)

            await db
              .update(planningsRefreshQueueTable)
              .set({
                lockedAt: null,
                lockOwner: null,
                lastError: failure?.kind ? String(failure.kind) : 'network_failed',
                nextAttemptAt: sql`now() + (${delayMs} * interval '1 millisecond')`,
              })
              .where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
            await db
              .insert(planningsRefreshStateTable)
              .values({
                planningFullId: row.planningFullId,
                consecutiveFailures: sql`1`,
                lastFailureKind: failure?.kind ?? 'network_failed',
                lastError: failure?.kind ? String(failure.kind) : 'network_failed',
                lastAttemptAt: sql`now()`,
                updatedAt: sql`now()`,
              })
              .onConflictDoUpdate({
                target: planningsRefreshStateTable.planningFullId,
                set: {
                  consecutiveFailures: sql`${planningsRefreshStateTable.consecutiveFailures} + 1`,
                  lastFailureKind: failure?.kind ?? 'network_failed',
                  lastError: failure?.kind ? String(failure.kind) : 'network_failed',
                  lastAttemptAt: sql`now()`,
                  updatedAt: sql`now()`,
                },
              })
            totals.requeued++
            continue
          }

          await deps.upsertPlanningBackup(db, row.planningFullId, events)
          await db.delete(planningsRefreshQueueTable).where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
          totals.deleted++
          await db
            .insert(planningsRefreshStateTable)
            .values({
              planningFullId: row.planningFullId,
              disabledUntil: null,
              consecutiveFailures: 0,
              lastFailureKind: null,
              lastError: null,
              lastAttemptAt: sql`now()`,
              lastSuccessAt: sql`now()`,
              updatedAt: sql`now()`,
            })
            .onConflictDoUpdate({
              target: planningsRefreshStateTable.planningFullId,
              set: {
                disabledUntil: null,
                consecutiveFailures: 0,
                lastFailureKind: null,
                lastError: null,
                lastAttemptAt: sql`now()`,
                lastSuccessAt: sql`now()`,
                updatedAt: sql`now()`,
              },
            })
        } catch (error) {
          if (attemptNumber >= maxAttempts) {
            jobsLogger.warn('Giving up refreshing planning {fullId} after max attempts: {error}', { fullId: row.planningFullId, error })
            await db.transaction(async (tx) => {
              await tx
                .insert(planningsRefreshStateTable)
                .values({
                  planningFullId: row.planningFullId,
                  disabledUntil: sql`now() + interval '6 hours'`,
                  consecutiveFailures: attemptNumber,
                  lastFailureKind: 'max_attempts',
                  lastError: String(error),
                  lastAttemptAt: sql`now()`,
                  updatedAt: sql`now()`,
                })
                .onConflictDoUpdate({
                  target: planningsRefreshStateTable.planningFullId,
                  set: {
                    disabledUntil: sql`now() + interval '6 hours'`,
                    consecutiveFailures: sql`${planningsRefreshStateTable.consecutiveFailures} + 1`,
                    lastFailureKind: 'max_attempts',
                    lastError: String(error),
                    lastAttemptAt: sql`now()`,
                    updatedAt: sql`now()`,
                  },
                })
              await tx.delete(planningsRefreshQueueTable).where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
            })
            totals.failed++
            totals.deleted++
            continue
          }

          jobsLogger.warn('Error refreshing planning {fullId}: {error}', { fullId: row.planningFullId, error })
          await db
            .update(planningsRefreshQueueTable)
            .set({
              lockedAt: null,
              lockOwner: null,
              lastError: String(error),
              nextAttemptAt: sql`now() + (${jitterMs(backoffMs(attemptNumber, 30_000))} * interval '1 millisecond')`,
            })
            .where(eq(planningsRefreshQueueTable.planningFullId, row.planningFullId))
          await db
            .insert(planningsRefreshStateTable)
            .values({
              planningFullId: row.planningFullId,
              consecutiveFailures: sql`1`,
              lastFailureKind: 'network_error',
              lastError: String(error),
              lastAttemptAt: sql`now()`,
              updatedAt: sql`now()`,
            })
            .onConflictDoUpdate({
              target: planningsRefreshStateTable.planningFullId,
              set: {
                consecutiveFailures: sql`${planningsRefreshStateTable.consecutiveFailures} + 1`,
                lastFailureKind: 'network_error',
                lastError: String(error),
                lastAttemptAt: sql`now()`,
                updatedAt: sql`now()`,
              },
            })
          totals.failed++
        }

        if (pauseMs > 0) await pause(pauseMs)
      }
    }

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => runOne())
    await Promise.all(workers)
  }
}

export async function sweepLegacyDeadQueueRows(db: Database, options: {
  maxAttempts: number
  limit?: number
}) {
  const { planningsRefreshQueueTable, planningsRefreshStateTable } = await import('@api/db/schemas/plannings')
  const { sql } = await import('drizzle-orm')

  const maxAttempts = Math.max(1, options.maxAttempts)
  const limit = Math.max(1, options.limit ?? 250)

  // These rows can never be picked again (attempts >= maxAttempts), so a worker won't ever touch them.
  // We migrate them into plannings_refresh_state and remove them from the queue to keep the queue small.
  // This is mainly for cleaning up legacy data created before we started deleting rows on give-up.
  const moved = await db.execute<{ planningFullId: string }>(sql`
    with picked as (
      select planning_full_id
      from ${planningsRefreshQueueTable}
      where ${planningsRefreshQueueTable.attempts} >= ${maxAttempts}
      limit ${limit}
      for update skip locked
    ),
    deleted as (
      delete from ${planningsRefreshQueueTable} q
      using picked
      where q.planning_full_id = picked.planning_full_id
      returning
        q.planning_full_id as "planningFullId",
        q.attempts as "attempts",
        q.last_error as "lastError"
    )
    insert into ${planningsRefreshStateTable} (
      planning_full_id,
      disabled_until,
      consecutive_failures,
      last_failure_kind,
      last_error,
      last_attempt_at,
      updated_at
    )
    select
      d."planningFullId",
      now() + interval '6 hours',
      d."attempts",
      'max_attempts',
      coalesce(d."lastError", 'max_attempts'),
      now(),
      now()
    from deleted d
    on conflict (planning_full_id) do update set
      disabled_until = excluded.disabled_until,
      consecutive_failures = greatest(plannings_refresh_state.consecutive_failures, excluded.consecutive_failures),
      last_failure_kind = excluded.last_failure_kind,
      last_error = excluded.last_error,
      last_attempt_at = excluded.last_attempt_at,
      updated_at = excluded.updated_at
    returning planning_full_id as "planningFullId"
  `)

  return { moved: moved.length }
}
