import { cleanedPlannings, flattenedPlannings } from '@api/plannings'
import { fetchEvents, getBackupEvents, getFormattedEvents } from '@api/utils/events'
import { elysiaLogger } from '@api/utils/logger'
import { Elysia } from 'elysia'

export default new Elysia({ prefix: '/plannings' })
  .get('/', () => cleanedPlannings)
  .get('/:fullId', async ({ params: { fullId }, status, query, headers }) => {
    const planning = flattenedPlannings.find(p => p.fullId === fullId)
    if (!planning) return status(404, { error: 'Planning not found' })

    const partialInfos = { id: planning.id, fullId: planning.fullId, title: planning.title }

    if (query.events === 'true') {
      let events = await fetchEvents(planning.url)
      if (!events) events = await getBackupEvents(planning.fullId)

      // blocklist ?blocklist=string (comma-separated)
      const blocklist = query.blocklist?.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0) || []

      // colors ?colors[amphi|tp|td|other]=string
      const colors: Record<string, string> = {}
      for (const key of ['amphi', 'tp', 'td', 'other']) {
        const color = query[`colors[${key}]`]
        if (color) colors[key] = color
      }

      // highlightTeacher ?highlightTeacher=boolean
      const highlightTeacher = query.highlightTeacher === 'true'

      let localeUtils: { target: string, browser: string } | null = null
      const browser = headers['x-timezone'] || headers['x-browser-timezone'] || query.browserTimezone
      const target = headers['x-target-timezone'] || query.targetTimezone
      if (browser && target) localeUtils = { browser, target }

      const allEvents = events
        ? getFormattedEvents(planning.id, events, {
            blocklist,
            colors,
            highlightTeacher,
            localeUtils,
          })
        : null

      const nbEvents = allEvents ? allEvents.length : 0

      elysiaLogger.info(`Serving events for planning {fullId} : {events} events, blocklist: {blocklist}, colors: {colors}, highlightTeacher: {highlightTeacher}`, {
        fullId,
        nbEvents,
        blocklist,
        colors,
        highlightTeacher,
      })

      return {
        ...partialInfos,
        timestamp: Date.now(),
        status: events ? 'ok' : 'error',
        events: allEvents,
        nbEvents,
      }
    } else {
      elysiaLogger.info('Serving info for planning {fullId}', { fullId })
      return partialInfos
    }
  })
