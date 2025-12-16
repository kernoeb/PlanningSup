import { cleanedPlannings, flattenedPlannings } from '@api/plannings'
import { getFailureReason, getFormattedEvents, resolveEvents } from '@api/utils/events'
import { elysiaLogger } from '@api/utils/logger'
import { Elysia } from 'elysia'

export default new Elysia({ prefix: '/plannings' })
  .get('/', () => cleanedPlannings)
  .get('/:fullId', async ({ params: { fullId }, status, query, headers }) => {
    const planning = flattenedPlannings.find(p => p.fullId === fullId)
    if (!planning) return status(404, { error: 'Planning not found' })

    const partialInfos = { id: planning.id, fullId: planning.fullId, title: planning.title }

    if (query.events === 'true') {
      const resolveResult = await resolveEvents(planning, query.onlyDb === 'true')
      const { events, source } = resolveResult

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
      const reason = getFailureReason(resolveResult, nbEvents)

      elysiaLogger.info(`Serving events for planning {fullId} : {nbEvents} events, source: {source}, reason: {reason}, blocklist: {blocklist}, highlightTeacher: {highlightTeacher}`, {
        fullId,
        nbEvents,
        source,
        reason,
        blocklist,
        highlightTeacher,
      })

      return {
        ...partialInfos,
        timestamp: Date.now(),
        status: events ? 'ok' : 'error',
        source,
        reason,
        events: allEvents,
        nbEvents,
      }
    } else {
      elysiaLogger.info('Serving info for planning {fullId}', { fullId })
      return partialInfos
    }
  })
