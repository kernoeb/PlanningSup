import { cleanedPlannings, flattenedPlannings } from '@api/plannings'
import { getFailureReason, getFormattedEvents, resolveEvents } from '@api/utils/events'
import { elysiaLogger } from '@api/utils/logger'
import { markPlanningRefreshSuccess, requestPlanningRefresh, schedulePlanningBackupWrite } from '@api/utils/plannings-backup'
import dayjs from 'dayjs'
import { Elysia, t } from 'elysia'

export default new Elysia({ prefix: '/plannings', tags: ['Plannings'] })
  .get('/', () => cleanedPlannings, {
    detail: {
      summary: 'List all plannings',
      description: 'Returns all available university plannings organized by host',
    },
  })
  .get('/:fullId', async ({ params: { fullId }, status, query, headers }) => {
    const planning = flattenedPlannings.find(p => p.fullId === fullId)
    if (!planning) return status(404, { error: 'Planning not found' })

    const partialInfos = { id: planning.id, fullId: planning.fullId, title: planning.title }

    if (query.events === 'true') {
      const onlyDb = query.onlyDb === 'true'
      const from = query.from
      const to = query.to
      const hasRange = !!(from || to)

      if (hasRange && onlyDb) {
        return status(400, { error: 'Range filtering is only supported for network-first calls' })
      }

      if (hasRange) {
        const start = from ? dayjs(from) : (to ? dayjs(to).subtract(2, 'year') : dayjs().subtract(1, 'month'))
        const end = to ? dayjs(to) : (from ? dayjs(from).add(2, 'year') : dayjs().add(2, 'year'))

        if (!start.isValid() || !end.isValid()) {
          return status(400, { error: 'Invalid range dates' })
        }

        if (end.diff(start, 'day') > 731) {
          return status(400, { error: 'Range too large (max 2 years)' })
        }
      }

      const range = hasRange ? { from, to } : undefined

      const resolveResult = await resolveEvents(planning, onlyDb, range)
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
            range,
          })
        : null

      const nbEvents = allEvents ? allEvents.length : 0
      const reason = getFailureReason(resolveResult, nbEvents)

      // refreshedAt semantics:
      // - network: request time
      // - db: last successful refresh (worker/UI), regardless of backup churn
      // - none: null
      const refreshedAt = source === 'network'
        ? Date.now()
        : source === 'db'
          ? resolveResult.backupRefreshedAt?.getTime() ?? resolveResult.backupUpdatedAt?.getTime() ?? null
          : null

      // Keep backups fresh when the UI hits the API directly:
      // - If we successfully fetched events from the network, write-through to DB asynchronously (no extra upstream fetch).
      // - If network failed (and onlyDb wasn't requested), enqueue a refresh retry with priority.
      // - SKIP if a custom range was requested (partial data shouldn't overwrite full backup).
      if (!onlyDb && !hasRange) {
        if (source === 'network') {
          void markPlanningRefreshSuccess(planning.fullId).catch((error) => {
            elysiaLogger.warn('Failed to mark planning refresh success for {fullId}: {error}', { fullId, error })
          })
        }

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

      elysiaLogger.info(`Serving events for planning {fullId} : {nbEvents} events, source: {source}, reason: {reason}, range: {range}, blocklist: {blocklist}, highlightTeacher: {highlightTeacher}`, {
        fullId,
        nbEvents,
        source,
        reason,
        range,
        blocklist,
        highlightTeacher,
      })

      return {
        ...partialInfos,
        refreshedAt,
        backupUpdatedAt: resolveResult.backupUpdatedAt?.getTime() ?? null,
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
  }, {
    params: t.Object({
      fullId: t.String({ description: 'Full planning ID (e.g., "host.planning-id")' }),
    }),
    query: t.Object({
      events: t.Optional(t.String({ description: 'Set to "true" to include calendar events' })),
      onlyDb: t.Optional(t.String({ description: 'Set to "true" to only fetch from database (no network)' })),
      from: t.Optional(t.String({ description: 'Start date for filtering (YYYY-MM-DD)' })),
      to: t.Optional(t.String({ description: 'End date for filtering (YYYY-MM-DD)' })),
      blocklist: t.Optional(t.String({ description: 'Comma-separated list of keywords to filter out events' })),
      highlightTeacher: t.Optional(t.String({ description: 'Set to "true" to highlight teacher names' })),
      browserTimezone: t.Optional(t.String({ description: 'Browser timezone (fallback for x-timezone header)' })),
      targetTimezone: t.Optional(t.String({ description: 'Target timezone for event times (fallback for x-target-timezone header)' })),
    }),
    detail: {
      summary: 'Get planning by ID',
      description: 'Returns a planning by its full ID. When events=true, fetches and returns calendar events with optional filtering and timezone conversion.',
    },
  })
