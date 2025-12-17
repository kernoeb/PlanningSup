import type { Database } from '@api/db'
import { jobsLogger } from '@api/utils/logger'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function runPlanningsBackup(db: Database, deps: {
  fetchEvents: (url: string) => Promise<Array<{ uid: string, summary: string, startDate: Date, endDate: Date, location: string, description: string }> | null>
  upsertPlanningBackup: (db: Database, planningFullId: string, events: Array<{ uid: string, summary: string, startDate: Date, endDate: Date, location: string, description: string }>) => Promise<{ changed: boolean, nbEvents: number }>
  flattenedPlannings: Array<{ fullId: string, url: string }>
}, signal?: AbortSignal) {
  const pauseMs = Number(Bun.env.JOBS_PLANNINGS_BACKUP_PAUSE_MS ?? 300)

  const nbPlannings = deps.flattenedPlannings.length
  jobsLogger.info('Starting plannings backup job for {count} planning(s)', { count: nbPlannings })

  let index = 0
  for (const planning of deps.flattenedPlannings) {
    index++

    // Check if job was aborted
    if (signal?.aborted) {
      jobsLogger.info('Plannings backup job aborted at planning {index}/{total}', {
        index,
        total: nbPlannings,
      })
      return
    }

    try {
      const events = await deps.fetchEvents(planning.url)
      if (!events) {
        jobsLogger.warn(
          `[${index}/${nbPlannings}] No events fetched for planning {fullId}, skipping backup.`,
          { fullId: planning.fullId },
        )
        if (pauseMs > 0) await pause(pauseMs)
        continue
      }

      const result = await deps.upsertPlanningBackup(db, planning.fullId, events)

      if (!result.changed) {
        jobsLogger.info(
          `[${index}/${nbPlannings}] No changes for planning {fullId}, skipping backup save.`,
          { fullId: planning.fullId },
        )
        if (pauseMs > 0) await pause(pauseMs)
        continue
      } else {
        jobsLogger.info(
          `[${index}/${nbPlannings}] Saved backup for planning {fullId}, {count} event(s).`,
          { fullId: planning.fullId, count: result.nbEvents },
        )
      }
    } catch (error) {
      jobsLogger.error(
        `[${index}/${nbPlannings}] Error backing up planning {fullId}: {error}`,
        { fullId: planning.fullId, error },
      )
    }

    if (pauseMs > 0) await pause(pauseMs)

    // Check for abort signal between plannings
    if (signal?.aborted) {
      jobsLogger.info('Plannings backup job aborted after processing planning {index}/{total}', {
        index,
        total: nbPlannings,
      })
      return
    }
  }
}

export async function run(db: Database, signal?: AbortSignal) {
  const { fetchEvents } = await import('@api/utils/events')
  const { upsertPlanningBackup } = await import('@api/utils/plannings-backup')
  const { flattenedPlannings } = await import('@api/plannings')

  return runPlanningsBackup(db, { fetchEvents, upsertPlanningBackup, flattenedPlannings }, signal)
}
