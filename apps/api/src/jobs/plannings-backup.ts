import type { Database } from '@api/db'
import { jobsLogger } from '@api/utils/logger'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function run(db: Database, signal?: AbortSignal) {
  const { fetchEvents } = await import('@api/utils/events')
  const { flattenedPlannings } = await import('@api/plannings')
  const { planningsBackupTable } = await import('@api/db/schemas/plannings')
  const { sql } = await import('drizzle-orm')

  const nbPlannings = flattenedPlannings.length
  jobsLogger.info('Starting plannings backup job for {count} planning(s)', { count: nbPlannings })

  let index = 0
  for (const planning of flattenedPlannings) {
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
      const events = await fetchEvents(planning.url)
      if (!events || events.length === 0) {
        jobsLogger.warn(
          `[${index}/${nbPlannings}] No events fetched for planning {fullId}, skipping backup.`,
          { fullId: planning.fullId },
        )
        await pause(300)
        continue
      }

      // Normalize and build latest payload
      const normalize = (list: Array<{ uid: string, summary: string, startDate: Date, endDate: Date, location: string, description: string }>) =>
        list
          .map(e => ({
            uid: e.uid,
            summary: e.summary,
            startDate: e.startDate,
            endDate: e.endDate,
            location: e.location,
            description: e.description
              .replace(/\(Exporté.*\)/, '')
              .replace(/\(Exported :.*\)/, '')
              .replace(/\(Updated :.*\)/, '')
              .replace(/\(Modifié le:.*\)/, '')
              .trim(),
          }))

      const payload = normalize(events)

      const details = await db
        .insert(planningsBackupTable)
        .values({
          planningFullId: planning.fullId,
          events: payload,
          signature: sql`md5(${JSON.stringify(payload)}::text)`,
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

      if (details.length === 0) {
        jobsLogger.info(
          `[${index}/${nbPlannings}] No changes for planning {fullId}, skipping backup save.`,
          { fullId: planning.fullId },
        )
        await pause(300)
        continue
      } else {
        jobsLogger.info(
          `[${index}/${nbPlannings}] Saved backup for planning {fullId}, {count} event(s).`,
          { fullId: planning.fullId, count: payload.length },
        )
      }
    } catch (error) {
      jobsLogger.error(
        `[${index}/${nbPlannings}] Error backing up planning {fullId}: {error}`,
        { fullId: planning.fullId, error },
      )
    }

    await pause(300)

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
