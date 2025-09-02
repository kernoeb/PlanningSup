import type { Database } from '.'
import { planningsTable } from '@api/db/schemas/plannings'
import { plannings } from '@api/plannings'
import { defaultLogger as logger } from '@api/utils/logger'
import { inArray, not, sql } from 'drizzle-orm'

export async function init(db: Database) {
  logger.info('Starting up and syncing plannings...')

  // Build the complete list of leaf plannings from resources
  const allFlat = plannings.flatMap(p => p.flatten)

  // Track duplicates by fullId and keep the first occurrence for upsert
  type Flat = typeof allFlat[number]
  const uniqueFlatMap = new Map<string, Flat>()
  const duplicates = new Map<string, { total: number, first: Flat, dups: Flat[] }>()

  for (const f of allFlat) {
    const existing = uniqueFlatMap.get(f.fullId)
    if (!existing) {
      uniqueFlatMap.set(f.fullId, f)
    } else {
      const rec = duplicates.get(f.fullId) ?? { total: 1, first: existing, dups: [] }
      rec.total += 1
      if (rec.dups.length < 5) rec.dups.push(f) // cap examples to keep logs readable
      duplicates.set(f.fullId, rec)
    }
  }

  const uniqueFlat = [...uniqueFlatMap.values()]
  const dupCount = allFlat.length - uniqueFlat.length

  if (dupCount > 0) {
    const summary = [...duplicates.entries()].map(([fullId, rec]) => ({
      fullId,
      totalOccurrences: rec.total,
      first: {
        planningId: rec.first.planningId,
        title: rec.first.title,
        url: rec.first.url,
      },
      examplesOfDuplicates: rec.dups.map(d => ({
        planningId: d.planningId,
        title: d.title,
        url: d.url,
      })),
    }))

    logger.warn(
      `Detected ${summary.length} duplicate fullId(s). Skipped ${dupCount} entries during upsert.`,
      { summary },
    )

    // Optional: write the duplicate details to a file for later inspection
    try {
      await Bun.write('duplicates.log.json', JSON.stringify(summary, null, 2))
      logger.warn('Wrote duplicate details to duplicates.log.json')
    } catch (e) {
      logger.warn('Failed to write duplicates.log.json:', { error: e })
    }
  }

  // Upsert plannings with unique fullId
  if (uniqueFlat.length > 0) {
    const details = await db.insert(planningsTable)
      .values(uniqueFlat.map(f => ({
        fullId: f.fullId,
        planningId: f.planningId,
        url: f.url,
        title: f.title,
        // updatedAt omitted — created by DB default on insert
      })))
      .onConflictDoUpdate({
        target: planningsTable.fullId,
        set: {
          planningId: sql`excluded.planning_id`,
          url: sql`excluded.url`,
          title: sql`excluded.title`,
          // Only set updated_at when something actually changed:
          updatedAt: sql`now()`,
        },
        where: sql`
          ${planningsTable.planningId} is distinct from excluded.planning_id
          or ${planningsTable.url} is distinct from excluded.url
          or ${planningsTable.title} is distinct from excluded.title
        `,
      })
      .returning()
    if (details.length > 0) {
      logger.info(`Upserted ${details.length} planning(s) from resources.`)
    }
  }

  // Delete rows that no longer exist in resources (use unique set of IDs)
  const fullIds = uniqueFlat.map(f => f.fullId)
  if (fullIds.length > 0) {
    const details = await db.delete(planningsTable).where(not(inArray(planningsTable.fullId, fullIds))).returning()
    if (details.length > 0) {
      logger.info(`Deleted ${details.length} planning(s) no longer present in resources.`)
    }
  } else {
    // If no resources are present, clear the table
    await db.delete(planningsTable)
  }

  logger.info('Sync complete.')
}
