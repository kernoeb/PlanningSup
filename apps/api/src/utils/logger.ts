import { ansiColorFormatter, configure, getConsoleSink, getLogger } from '@logtape/logtape'

const isTest = Bun.env.NODE_ENV === 'test'

await configure({
  sinks: {
    console: getConsoleSink({
      formatter: ansiColorFormatter,
    }),
  },
  loggers: [
    { category: ['logtape', 'meta'], sinks: [] },
    { category: 'planningsup', lowestLevel: 'debug', sinks: isTest ? [] : ['console'] },
    { category: ['elysia'], lowestLevel: 'info', sinks: isTest ? [] : ['console'] },
    { category: ['jobs'], lowestLevel: 'info', sinks: isTest ? [] : ['console'] },
  ],
})

export const defaultLogger = getLogger('planningsup')
export const elysiaLogger = getLogger(['elysia'])
export const jobsLogger = getLogger(['jobs'])
