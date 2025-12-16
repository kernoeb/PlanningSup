import type { CalEvent } from '@api/utils/events'
import { cleanedPlannings, flattenedPlannings } from '@api/plannings'
import { fetchEvents, getBackupEvents, getFormattedEvents } from '@api/utils/events'
import { elysiaLogger } from '@api/utils/logger'
import { Elysia } from 'elysia'

type EventsSource = 'db' | 'network' | 'none'

/**
 * Resolve events for a planning.
 * @param planning - The planning object.
 * @param planning.url - The URL of the planning.
 * @param planning.fullId - The full ID of the planning.
 * @param onlyDb - Whether to only use the database.
 * @returns The events for the planning and their source.
 */
async function resolveEvents(planning: { url: string, fullId: string }, onlyDb: boolean): Promise<{ events: CalEvent[] | null, source: EventsSource }> {
  if (onlyDb) {
    const events = await getBackupEvents(planning.fullId)
    return { events, source: events ? 'db' : 'none' }
  }

  const networkEvents = await fetchEvents(planning.url)
  if (networkEvents) {
    return { events: networkEvents, source: 'network' }
  }

  const dbEvents = await getBackupEvents(planning.fullId)
  return { events: dbEvents, source: dbEvents ? 'db' : 'none' }
}

export default new Elysia({ prefix: '/plannings' })
  .get('/', () => cleanedPlannings)
  .get('/:fullId', async ({ params: { fullId }, status, query, headers }) => {
    const planning = flattenedPlannings.find(p => p.fullId === fullId)
    if (!planning) return status(404, { error: 'Planning not found' })

    const partialInfos = { id: planning.id, fullId: planning.fullId, title: planning.title }

    if (query.events === 'true') {
      const { events, source } = await resolveEvents(planning, query.onlyDb === 'true')

      // blocklist ?blocklist=string (comma-separated)
      const blocklist = query.blocklist?.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0) || []

      // highlightTeacher ?highlightTeacher=boolean
      const highlightTeacher = query.highlightTeacher === 'true'

      let localeUtils: { target: string, browser: string } | null = null
      const browser = headers['x-timezone'] || headers['x-browser-timezone'] || query.browserTimezone
      const target = headers['x-target-timezone'] || query.targetTimezone
      if (browser && target) localeUtils = { browser, target }

      const allEvents = events
        ? getFormattedEvents(planning.id, events, {
            blocklist,
            highlightTeacher,
            localeUtils,
          })
        : null

      const nbEvents = allEvents ? allEvents.length : 0

      elysiaLogger.info(`Serving events for planning {fullId} : {nbEvents} events, source: {source}, blocklist: {blocklist}, highlightTeacher: {highlightTeacher}`, {
        fullId,
        nbEvents,
        source,
        blocklist,
        highlightTeacher,
      })

      return {
        ...partialInfos,
        timestamp: Date.now(),
        status: events ? 'ok' : 'error',
        source,
        events: allEvents,
        nbEvents,
      }
    } else {
      elysiaLogger.info('Serving info for planning {fullId}', { fullId })
      return partialInfos
    }
  })
