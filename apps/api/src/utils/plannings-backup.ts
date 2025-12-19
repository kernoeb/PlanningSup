import type { Database } from '@api/db'
import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshQueueTable, planningsRefreshStateTable } from '@api/db/schemas/plannings'
import { JOB_ID, pokeJob } from '@api/jobs'
import { elysiaLogger } from '@api/utils/logger'

import { sql } from 'drizzle-orm'

interface BackupEvent {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

function normalizeDescription(description: string) {
  return description
    .replace(/\(Exporté.*\)/, '')
    .replace(/\(Exported :.*\)/, '')
    .replace(/\(Updated :.*\)/, '')
    .replace(/\(Modifié le:.*\)/, '')
    .trim()
}

function normalizeForBackup(events: BackupEvent[]): BackupEvent[] {
  // Ensure deterministic order for stable signatures and to prevent churn on upstream ordering changes.
  return events
    .map(e => ({
      uid: e.uid,
      summary: e.summary,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
      description: normalizeDescription(e.description),
    }))
    .sort((a, b) => {
      const sa = a.startDate.getTime()
      const sb = b.startDate.getTime()
      if (sa !== sb) return sa - sb

      const ea = a.endDate.getTime()
      const eb = b.endDate.getTime()
      if (ea !== eb) return ea - eb

      const s = a.summary.localeCompare(b.summary)
      if (s !== 0) return s

      const l = a.location.localeCompare(b.location)
      if (l !== 0) return l

      return a.uid.localeCompare(b.uid)
    })
}

export interface LastBackupWrite {
  planningFullId: string
  changed: boolean
  nbEvents: number
  at: Date
}

let lastBackupWrite: LastBackupWrite | null = null

export function getLastBackupWrite(): LastBackupWrite | null {
  return lastBackupWrite
}

export async function upsertPlanningBackup(targetDb: Database, planningFullId: string, events: BackupEvent[]) {
  const payload = normalizeForBackup(events)

  // Important: compute the signature from a canonicalized jsonb representation (not raw JSON text),
  // otherwise insert and update can disagree and trigger pointless rewrites.
  const signatureExpr = sql`md5(${JSON.stringify(payload)}::jsonb::text)`

  const details = await targetDb
    .insert(planningsBackupTable)
    .values({
      planningFullId,
      events: payload,
      signature: signatureExpr,
    })
    .onConflictDoUpdate({
      target: planningsBackupTable.planningFullId,
      set: {
        events: sql`excluded.events`,
        signature: sql`md5(excluded.events::text)`,
        updatedAt: sql`now()`,
      },
      where: sql`${planningsBackupTable.signature} is distinct from md5(excluded.events::text)`,
    })
    .returning()

  const changed = details.length > 0
  elysiaLogger.info('Backup upsert for {fullId}: {status} ({nbEvents} events)', {
    fullId: planningFullId,
    status: changed ? 'updated' : 'unchanged (signature match)',
    nbEvents: payload.length,
  })

  lastBackupWrite = {
    planningFullId,
    changed,
    nbEvents: payload.length,
    at: new Date(),
  }

  return {
    changed,
    nbEvents: payload.length,
  }
}

function envNumber(key: string, fallback: number) {
  const raw = Bun.env[key]
  if (raw == null) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function getWriteThrottleMs() {
  return envNumber(
    'PLANNINGS_BACKUP_WRITE_THROTTLE_MS',
    Bun.env.NODE_ENV === 'test' ? 0 : 30_000,
  )
}

function getWriteStateTtlMs() {
  return envNumber(
    'PLANNINGS_BACKUP_WRITE_STATE_TTL_MS',
    Bun.env.NODE_ENV === 'test' ? 5_000 : 60 * 60_000,
  )
}

function getWriteStateMaxKeys() {
  return envNumber(
    'PLANNINGS_BACKUP_WRITE_STATE_MAX_KEYS',
    Bun.env.NODE_ENV === 'test' ? 200 : 20_000,
  )
}

const writeState = new Map<string, {
  inFlight: Promise<void> | null
  lastWriteAt: number
  pending: BackupEvent[] | null
  lastTouchedAt: number
}>()

function pruneWriteState(now: number, ttlMs: number, maxKeys: number) {
  for (const [key, state] of writeState) {
    if (state.inFlight) continue
    if (state.pending) continue
    if (now - state.lastTouchedAt > ttlMs) writeState.delete(key)
  }
  if (writeState.size <= maxKeys) return
  // Drop oldest (in insertion order) entries until we're under the cap.
  for (const [key] of writeState) {
    writeState.delete(key)
    if (writeState.size <= maxKeys) break
  }
}

export function schedulePlanningBackupWrite(planningFullId: string, events: BackupEvent[]) {
  const now = Date.now()
  const maxKeys = getWriteStateMaxKeys()
  pruneWriteState(now, getWriteStateTtlMs(), maxKeys)

  const existing = writeState.get(planningFullId)
  if (!existing && writeState.size >= maxKeys) {
    // Hard cap to avoid unbounded memory growth in edge cases.
    elysiaLogger.warn('Backup write skipped for {fullId}: max keys reached ({maxKeys})', { fullId: planningFullId, maxKeys })
    return
  }

  const state = existing ?? { inFlight: null, lastWriteAt: 0, pending: null, lastTouchedAt: now }

  state.pending = events
  state.lastTouchedAt = now
  writeState.set(planningFullId, state)

  if (state.inFlight) {
    elysiaLogger.info('Backup write queued for {fullId} (write already in flight)', { fullId: planningFullId })
    return
  }

  elysiaLogger.info('Backup write scheduled for {fullId} ({nbEvents} events)', { fullId: planningFullId, nbEvents: events.length })

  const run = async () => {
    for (;;) {
      const current = writeState.get(planningFullId)
      if (!current?.pending) return
      current.lastTouchedAt = Date.now()
      const throttleMs = getWriteThrottleMs()
      const elapsed = Date.now() - current.lastWriteAt
      if (elapsed < throttleMs) {
        const waitMs = throttleMs - elapsed
        elysiaLogger.info('Backup write throttled for {fullId}, waiting {waitMs}ms', { fullId: planningFullId, waitMs })
        await new Promise<void>(resolve => setTimeout(resolve, waitMs))
        continue
      }

      const payload = current.pending
      current.pending = null
      current.lastWriteAt = Date.now()
      writeState.set(planningFullId, current)

      try {
        await upsertPlanningBackup(db, planningFullId, payload)
      } catch (error) {
        elysiaLogger.warn('Async backup write failed for planning {fullId}: {error}', { fullId: planningFullId, error })
      }
    }
  }

  state.inFlight = run()
    .finally(() => {
      const next = writeState.get(planningFullId)
      if (next) next.inFlight = null
    })
}

function getRefreshThrottleMs() {
  return envNumber(
    'PLANNINGS_REFRESH_THROTTLE_MS',
    Bun.env.NODE_ENV === 'test' ? 0 : 30_000,
  )
}

function getRefreshStateTtlMs() {
  return envNumber(
    'PLANNINGS_REFRESH_STATE_TTL_MS',
    Bun.env.NODE_ENV === 'test' ? 5_000 : 60 * 60_000,
  )
}

function getRefreshStateMaxKeys() {
  return envNumber(
    'PLANNINGS_REFRESH_STATE_MAX_KEYS',
    Bun.env.NODE_ENV === 'test' ? 200 : 50_000,
  )
}

const refreshState = new Map<string, { lastRequestedAt: number, lastTouchedAt: number }>()

function getRefreshSuccessWriteThrottleMs() {
  return envNumber(
    'PLANNINGS_REFRESH_SUCCESS_WRITE_THROTTLE_MS',
    Bun.env.NODE_ENV === 'test' ? 0 : 30_000,
  )
}

function pruneRefreshState(now: number, ttlMs: number, maxKeys: number) {
  for (const [key, state] of refreshState) {
    if (now - state.lastTouchedAt > ttlMs) refreshState.delete(key)
  }
  if (refreshState.size <= maxKeys) return
  for (const [key] of refreshState) {
    refreshState.delete(key)
    if (refreshState.size <= maxKeys) break
  }
}

export async function requestPlanningRefresh(planningFullId: string, priority: number = 10) {
  const now = Date.now()
  const maxKeys = getRefreshStateMaxKeys()
  pruneRefreshState(now, getRefreshStateTtlMs(), maxKeys)

  const prev = refreshState.get(planningFullId)
  if (!prev && refreshState.size >= maxKeys) {
    // Hard cap to avoid unbounded memory growth in edge cases.
    return
  }
  const last = prev?.lastRequestedAt ?? 0
  if (now - last < getRefreshThrottleMs()) return
  refreshState.set(planningFullId, { lastRequestedAt: now, lastTouchedAt: now })

  // User-triggered refresh should re-enable the planning even if it was disabled by the worker.
  await db
    .insert(planningsRefreshStateTable)
    .values({
      planningFullId,
      disabledUntil: null,
      consecutiveFailures: 0,
      lastFailureKind: null,
      lastError: null,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: planningsRefreshStateTable.planningFullId,
      set: {
        disabledUntil: null,
        consecutiveFailures: 0,
        lastFailureKind: null,
        lastError: null,
        updatedAt: sql`now()`,
      },
    })

  // Dedupe by PK, bump priority, and bring next_attempt_at forward.
  await db
    .insert(planningsRefreshQueueTable)
    .values({
      planningFullId,
      priority,
      requestedAt: sql`now()`,
      nextAttemptAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: planningsRefreshQueueTable.planningFullId,
      set: {
        priority: sql`least(100, greatest(${planningsRefreshQueueTable.priority}, excluded.priority))`,
        requestedAt: sql`excluded.requested_at`,
        lastError: sql`null`,
        nextAttemptAt: sql`least(${planningsRefreshQueueTable.nextAttemptAt}, excluded.next_attempt_at)`,
      },
      where: sql`
        ${planningsRefreshQueueTable.requestedAt} < (now() - interval '30 seconds')
        or ${planningsRefreshQueueTable.priority} < excluded.priority
      `,
    })

  pokeJob(JOB_ID.planningsRefreshWorker)
}

export async function markPlanningRefreshSuccess(planningFullId: string) {
  const throttleMs = getRefreshSuccessWriteThrottleMs()

  await db
    .insert(planningsRefreshStateTable)
    .values({
      planningFullId,
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
      // Throttle writes (cross-instance) to avoid write amplification under high concurrency.
      where: throttleMs > 0
        ? sql`${planningsRefreshStateTable.lastSuccessAt} is null or ${planningsRefreshStateTable.lastSuccessAt} < (now() - (${throttleMs} * interval '1 millisecond'))`
        : undefined,
    })
}

export async function enqueuePlanningRefreshBatch(planningFullIds: string[], priority: number) {
  if (planningFullIds.length === 0) return

  await db
    .insert(planningsRefreshQueueTable)
    .values(planningFullIds.map(planningFullId => ({
      planningFullId,
      priority,
      requestedAt: sql`now()`,
      nextAttemptAt: sql`now()`,
    })))
    .onConflictDoUpdate({
      target: planningsRefreshQueueTable.planningFullId,
      set: {
        // Backfill: don't churn "dead" rows (max attempts or permanent HTTP 4xx).
        priority: sql`
          case
            when ${planningsRefreshQueueTable.lastError} like 'http_4%' then ${planningsRefreshQueueTable.priority}
            when ${planningsRefreshQueueTable.lastError} = 'max_attempts' then ${planningsRefreshQueueTable.priority}
            else least(100, greatest(${planningsRefreshQueueTable.priority}, excluded.priority))
          end
        `,
        requestedAt: sql`
          case
            when ${planningsRefreshQueueTable.lastError} like 'http_4%' then ${planningsRefreshQueueTable.requestedAt}
            when ${planningsRefreshQueueTable.lastError} = 'max_attempts' then ${planningsRefreshQueueTable.requestedAt}
            else excluded.requested_at
          end
        `,
        nextAttemptAt: sql`
          case
            when ${planningsRefreshQueueTable.lastError} like 'http_4%' then ${planningsRefreshQueueTable.nextAttemptAt}
            when ${planningsRefreshQueueTable.lastError} = 'max_attempts' then ${planningsRefreshQueueTable.nextAttemptAt}
            else least(${planningsRefreshQueueTable.nextAttemptAt}, excluded.next_attempt_at)
          end
        `,
      },
    })

  pokeJob(JOB_ID.planningsRefreshWorker)
}

export const __test = {
  reset() {
    if (Bun.env.NODE_ENV !== 'test') return
    writeState.clear()
    refreshState.clear()
  },
  sizes() {
    return {
      writeState: writeState.size,
      refreshState: refreshState.size,
    }
  },
}
