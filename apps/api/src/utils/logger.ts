import { ansiColorFormatter, configure, getConsoleSink, getLogger } from '@logtape/logtape'

await configure({
  sinks: {
    console: getConsoleSink({
      formatter: ansiColorFormatter,
    }),
  },
  loggers: [
    { category: ['logtape', 'meta'], sinks: [] },
    { category: 'planningsup', lowestLevel: 'debug', sinks: ['console'] },
    { category: ['elysia'], lowestLevel: 'info', sinks: ['console'] },
    { category: ['jobs'], lowestLevel: 'info', sinks: ['console'] },
  ],
})

export const defaultLogger = getLogger('planningsup')
export const elysiaLogger = getLogger(['elysia'])
export const jobsLogger = getLogger(['jobs'])
