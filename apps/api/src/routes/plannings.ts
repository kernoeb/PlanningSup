import { cleanedPlannings, flattenedPlannings } from '@api/plannings'
import { getFailureReason, getFormattedEvents, resolveEvents } from '@api/utils/events'
import { elysiaLogger } from '@api/utils/logger'
import { requestPlanningRefresh, schedulePlanningBackupWrite } from '@api/utils/plannings-backup'
import { Elysia } from 'elysia'

export default new Elysia({ prefix: '/plannings' })
  .get('/', () => cleanedPlannings)
  .get('/:fullId', async ({ params: { fullId }, status, query, headers }) => {
    const planning = flattenedPlannings.find(p => p.fullId === fullId)
    if (!planning) return status(404, { error: 'Planning not found' })

    const partialInfos = { id: planning.id, fullId: planning.fullId, title: planning.title }

    if (query.events === 'true') {
      const onlyDb = query.onlyDb === 'true'

      const resolveResult = await resolveEvents(planning, onlyDb)
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

      // refreshedAt semantics:
      // - network: request time
      // - db: backup updatedAt
      // - none: null
      const refreshedAt = source === 'network'
        ? Date.now()
        : source === 'db'
          ? resolveResult.backupUpdatedAt?.getTime() ?? null
          : null

      // Keep backups fresh when the UI hits the API directly:
      // - If we successfully fetched events from the network, write-through to DB asynchronously (no extra upstream fetch).
      // - If network failed (and onlyDb wasn't requested), enqueue a refresh retry with priority.
      if (!onlyDb) {
        if (source === 'network' && events) {
          schedulePlanningBackupWrite(planning.fullId, events)
        } else if (resolveResult.networkFailed) {
          // Only enqueue retries for failures that are likely transient.
          const kind = resolveResult.networkFailure?.kind
          const shouldRetry = kind !== 'http_4xx'
          if (shouldRetry) {
            void requestPlanningRefresh(planning.fullId, 10).catch((error) => {
              elysiaLogger.warn('Failed to enqueue planning refresh for {fullId}: {error}', { fullId, error })
            })
          }
        }
      }

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
        refreshedAt,
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
