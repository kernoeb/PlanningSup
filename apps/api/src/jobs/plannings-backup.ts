import type { Database } from '@api/db'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function run(db: Database) {
  const { fetchEvents } = await import('@api/utils/events')
  const { flattenedPlannings } = await import('@api/plannings')
  const { planningsBackupTable } = await import('@api/db/schemas/plannings')
  const { sql } = await import('drizzle-orm')

  for (const planning of flattenedPlannings) {
    try {
      const events = await fetchEvents(planning.url)
      if (!events || events.length === 0) {
        console.warn(`No events fetched for planning ${planning.fullId} (${planning.url})`)
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
        console.log(`No changes for planning ${planning.fullId} (${planning.url}), skipping refresh`)
        await pause(300)
        continue
      } else {
        console.log(`Saved latest backup for planning ${planning.fullId} with ${payload.length} event(s)`)
      }
    } catch (error) {
      console.error(`Error processing planning ${planning.fullId} (${planning.url}):`, error)
    }

    // Delay between requests to avoid overwhelming the server
    await pause(300)
  }
}
