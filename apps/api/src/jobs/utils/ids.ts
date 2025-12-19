export const JOB_ID = {
  planningsBackfill: 'plannings-backfill',
  planningsRefreshWorker: 'plannings-refresh-worker',
} as const

export type JobId = typeof JOB_ID[keyof typeof JOB_ID]
