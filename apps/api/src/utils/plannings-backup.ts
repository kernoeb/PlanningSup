import type { Database } from '@api/db'
import { db } from '@api/db'
import { planningsBackupTable, planningsRefreshQueueTable } from '@api/db/schemas/plannings'
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

  return {
    changed: details.length > 0,
    nbEvents: payload.length,
  }
}

const WRITE_THROTTLE_MS = Bun.env.NODE_ENV === 'test' ? 0 : 30_000
const writeState = new Map<string, { inFlight: Promise<void> | null, lastQueuedAt: number }>()

export function schedulePlanningBackupWrite(planningFullId: string, events: BackupEvent[]) {
  const state = writeState.get(planningFullId) ?? { inFlight: null, lastQueuedAt: 0 }
  const now = Date.now()

  if (state.inFlight) return
  if (now - state.lastQueuedAt < WRITE_THROTTLE_MS) return

  state.lastQueuedAt = now
  const p = upsertPlanningBackup(db, planningFullId, events)
    .then(() => {})
    .catch((error) => {
      elysiaLogger.warn('Async backup write failed for planning {fullId}: {error}', { fullId: planningFullId, error })
    })
    .finally(() => {
      const next = writeState.get(planningFullId)
      if (next) next.inFlight = null
    })

  state.inFlight = p
  writeState.set(planningFullId, state)
}

const REFRESH_THROTTLE_MS = Bun.env.NODE_ENV === 'test' ? 0 : 30_000
const refreshState = new Map<string, number>()

export async function requestPlanningRefresh(planningFullId: string, priority: number = 10) {
  const now = Date.now()
  const last = refreshState.get(planningFullId) ?? 0
  if (now - last < REFRESH_THROTTLE_MS) return
  refreshState.set(planningFullId, now)

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
        nextAttemptAt: sql`least(${planningsRefreshQueueTable.nextAttemptAt}, excluded.next_attempt_at)`,
      },
      where: sql`
        ${planningsRefreshQueueTable.requestedAt} < (now() - interval '30 seconds')
        or ${planningsRefreshQueueTable.priority} < excluded.priority
      `,
    })
}
