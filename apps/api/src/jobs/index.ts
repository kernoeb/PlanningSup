import type { Database } from '@api/db'

import type { JobId } from './utils/ids'
import type { QuietHours } from './utils/quiet-hours'
import type { JobContext } from './utils/types'

import config from '@api/config'
import { jobsLogger } from '@api/utils/logger'

import { JOB_ID } from './utils/ids'
import { formatQuietHours, isInQuietHours, parseQuietHours } from './utils/quiet-hours'
import { getJobRuntimeSnapshot, updateJobRuntime } from './utils/runtime'

export { formatQuietHours, isInQuietHours, parseQuietHours }
export type { QuietHours }
export { JOB_ID } from './utils/ids'
export { pokeJob } from './utils/poke'

interface JobModule {
  id: JobId
  name: string
  restartOnExit?: boolean
  start: (db: Database, signal: AbortSignal, ctx: JobContext) => Promise<void>
}

function toPrettyName(id: string) {
  return id.replace(/[-_.]+/g, ' ')
}

function waitForAbort(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

let started = false
let paused = false

let resumeResolve: (() => void) | null = null
let resumePromise: Promise<void> = Promise.resolve()

const running = new Map<JobId, AbortController>()

function ensureResumePromise() {
  if (!paused) return
  if (resumeResolve) return
  resumePromise = new Promise<void>((resolve) => {
    resumeResolve = resolve
  })
}

async function waitForResumeOrStop(signal: AbortSignal) {
  for (;;) {
    if (signal.aborted) return
    if (!paused) return
    ensureResumePromise()
    await Promise.race([resumePromise, waitForAbort(signal)])
  }
}

const JOB_REGISTRY: Record<JobId, JobModule> = {
  [JOB_ID.planningsRefreshWorker]: {
    id: JOB_ID.planningsRefreshWorker,
    name: toPrettyName(JOB_ID.planningsRefreshWorker),
    restartOnExit: true,
    async start(db, signal, ctx) {
      const mod = await import('./plannings-refresh-worker')
      return mod.start(db, signal, ctx)
    },
  },
  [JOB_ID.planningsBackfill]: {
    id: JOB_ID.planningsBackfill,
    name: toPrettyName(JOB_ID.planningsBackfill),
    restartOnExit: true,
    async start(db, signal, ctx) {
      const mod = await import('./plannings-backfill')
      return mod.start(db, signal, ctx)
    },
  },
}

function readAllowedJobIdsFromEnv(): readonly JobId[] {
  const raw = config.jobs.allowedJobs
  if (!raw) {
    return Object.freeze<JobId[]>([JOB_ID.planningsRefreshWorker, JOB_ID.planningsBackfill])
  }
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean) as JobId[]
  if (ids.length === 1 && ids[0] === ('*' as JobId)) {
    return Object.keys(JOB_REGISTRY) as JobId[]
  }
  return ids
}

function resolveAllowedJobs(): JobModule[] {
  const requested = readAllowedJobIdsFromEnv()
  const resolved: JobModule[] = []

  for (const id of requested) {
    const job = JOB_REGISTRY[id]
    if (!job) {
      jobsLogger.warn('Requested job id not in registry: {id}', { id })
      continue
    }
    resolved.push(job)
  }

  if (resolved.length === 0) {
    jobsLogger.warn('No jobs resolved from allowlist. Requested: {requested}', {
      requested: requested.join(', ') || '(none)',
    })
  } else {
    jobsLogger.info('Resolved {count} job(s) from allowlist: {names}', {
      count: resolved.length,
      names: resolved.map(j => j.name).join(', '),
    })
  }

  return resolved
}

export interface JobsControls {
  stop: () => void
  pause: () => void
  resume: () => void
  isPaused: () => boolean
  isStarted: () => boolean
  getQuietHours: () => QuietHours | null
  getTimezone: () => string
  isInQuietHours: () => boolean
  getRuntime: () => ReturnType<typeof getJobRuntimeSnapshot>
}

export interface JobsApi extends JobsControls {
  start: (db: Database) => JobsControls
}

const controller: JobsControls = {
  stop() {
    for (const ac of running.values()) {
      ac.abort('Jobs system stopping')
    }
    running.clear()
  },
  pause() {
    if (!paused) {
      paused = true
      ensureResumePromise()
      jobsLogger.info('Jobs paused.')
    }
  },
  resume() {
    if (paused) {
      paused = false
      resumeResolve?.()
      resumeResolve = null
      resumePromise = Promise.resolve()
      jobsLogger.info('Jobs resumed.')
    }
  },
  isPaused() {
    return paused
  },
  isStarted() {
    return started
  },
  getQuietHours() {
    return parseQuietHours(config.jobs.quietHours)
  },
  getTimezone() {
    return config.jobs.quietHoursTimezone
  },
  isInQuietHours() {
    const quietHours = parseQuietHours(config.jobs.quietHours)
    const timezone = config.jobs.quietHoursTimezone
    return isInQuietHours(quietHours, new Date(), timezone)
  },
  getRuntime() {
    return getJobRuntimeSnapshot()
  },
}

export function startJobs(db: Database): JobsControls {
  if (started) return controller
  started = true

  if (!config.jobs.runJobs) {
    jobsLogger.info('Jobs disabled by RUN_JOBS=false, not starting.')
    return controller
  }

  const quietHours = parseQuietHours(config.jobs.quietHours)
  const timezone = config.jobs.quietHoursTimezone
  jobsLogger.info('Starting jobs (quiet hours: {quietHours} in {timezone})', {
    quietHours: formatQuietHours(quietHours),
    timezone,
  })

  const ctx: JobContext = {
    isPaused: () => paused,
    quietHours,
    timezone,
    waitForResumeOrStop,
  }

  const jobs = resolveAllowedJobs()
  for (const job of jobs) {
    const ac = new AbortController()
    running.set(job.id, ac)

    ;(async () => {
      let backoffMs = 2_000
      const maxBackoffMs = 60_000

      for (;;) {
        if (ac.signal.aborted) break

        try {
          jobsLogger.info('Starting job: {name}', { name: job.name })
          updateJobRuntime(job.id, { state: 'starting', startedAt: new Date() })
          await job.start(db, ac.signal, ctx)

          if (ac.signal.aborted) {
            jobsLogger.info('Job aborted: {name} (reason: {reason})', {
              name: job.name,
              reason: ac.signal.reason || 'unknown',
            })
            updateJobRuntime(job.id, { state: 'stopped' })
            break
          }

          jobsLogger.warn('Job exited unexpectedly: {name}', { name: job.name })
          updateJobRuntime(job.id, { state: 'exited' })
        } catch (error) {
          if (ac.signal.aborted) {
            jobsLogger.info('Job aborted: {name} (reason: {reason})', {
              name: job.name,
              reason: ac.signal.reason || 'unknown',
            })
            updateJobRuntime(job.id, { state: 'stopped' })
            break
          }
          jobsLogger.error('Job crashed: {name}', { name: job.name, error })
          updateJobRuntime(job.id, {
            state: 'crashed',
            lastErrorAt: new Date(),
            lastError: error instanceof Error ? (error.stack || error.message) : String(error),
          })
        }

        if (!job.restartOnExit) {
          jobsLogger.info('Not restarting job: {name}', { name: job.name })
          break
        }

        const jitter = Bun.env.NODE_ENV === 'test' ? 0 : Math.floor(Math.random() * 500)
        const delay = Math.min(maxBackoffMs, backoffMs) + jitter
        jobsLogger.warn('Restarting job {name} in {delay}ms', { name: job.name, delay })
        await Promise.race([sleep(delay), waitForAbort(ac.signal)])
        backoffMs = Math.min(maxBackoffMs, backoffMs * 2)
      }

      running.delete(job.id)
    })()
  }

  if (jobs.length === 0) {
    jobsLogger.warn('No jobs enabled by allowlist.')
  }

  return controller
}

export const jobs: JobsApi = {
  start: startJobs,
  stop: controller.stop,
  pause: controller.pause,
  resume: controller.resume,
  isPaused: controller.isPaused,
  isStarted: controller.isStarted,
  getQuietHours: controller.getQuietHours,
  getTimezone: controller.getTimezone,
  isInQuietHours: controller.isInQuietHours,
  getRuntime: controller.getRuntime,
}

export default jobs
