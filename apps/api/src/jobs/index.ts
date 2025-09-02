import type { Database } from '@api/db'
import { jobsLogger } from '@api/utils/logger'

// ----- Explicit job registry (whitelist) -----
// Add new jobs by importing their run() function and registering here.
import { run as runPlanningsBackup } from './plannings-backup'

// Environment variable names supported:
// - RUN_JOBS: "false" | "0" disables the job runner, everything else enables it (default: enabled)
// - DELAY_BETWEEN_JOBS: delay between cycles (supports ms number or "60s", "1m", "500ms", "1h")
// - ALLOWED_JOBS | JOBS_ALLOWLIST | JOBS_WHITELIST: comma-separated list of job IDs to run, or "*" for all registered jobs.
//   Example: ALLOWED_JOBS="plannings-backup,another-job"
//
// A "job" is any module that exports an async `run(db: Database): Promise<void>` function.
// Jobs must be added to the JOB_REGISTRY below, which is an explicit allowlist.

interface JobModule {
  name: string
  run: (db: Database) => Promise<void>
}

let isRunning = false
let isStopped = false
let paused = false

const DEFAULT_DELAY_MS = 60_000

function readEnvBoolean(value: string | undefined | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const v = String(value).trim().toLowerCase()
  if (['false', '0', 'no', 'off', 'disabled'].includes(v)) return false
  if (['true', '1', 'yes', 'on', 'enabled'].includes(v)) return true
  return defaultValue
}

function parseDelayMs(): number {
  const parsed = parseDurationToMs(Bun.env.DELAY_BETWEEN_JOBS)
  if (parsed != null) return parsed
  return DEFAULT_DELAY_MS
}

function parseDurationToMs(input: string | undefined | null): number | null {
  if (!input) return null
  const raw = String(input).trim().toLowerCase()
  if (raw === '') return null

  // Pure number -> ms
  if (/^\d+$/.test(raw)) {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) return n
    return null
  }

  // Simple "500ms", "10s", "2m", "1h"
  const m = /^(?<n>\d+)(?<u>ms|[smh])$/.exec(raw)
  if (m?.groups) {
    const n = Number(m.groups.n)
    const unit = m.groups.u
    if (!Number.isFinite(n)) return null
    switch (unit) {
      case 'ms': return n
      case 's': return n * 1000
      case 'm': return n * 60_000
      case 'h': return n * 3_600_000
    }
  }

  return null
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function formatDuration(ms: number): string {
  const parts: string[] = []
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const millis = ms % 1000
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (seconds) parts.push(`${seconds}s`)
  if (millis || parts.length === 0) parts.push(`${millis}ms`)
  return parts.join(' ')
}

function toPrettyName(id: string) {
  // Turn "foo/bar-baz.ts" into "bar baz"
  const base = id.replace(/\.[^.]+$/, '').split('/').pop() ?? id
  return base.replace(/[-_.]+/g, ' ')
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { message: String(error) }
}

const JOB_REGISTRY: Record<string, JobModule['run']> = {
  // id: run function
  'plannings-backup': runPlanningsBackup,
}

const DEFAULT_ALLOWED_JOBS = Object.freeze<string[]>(['plannings-backup'])

function readAllowedJobIdsFromEnv(): readonly string[] {
  const raw = Bun.env.ALLOWED_JOBS
  if (!raw) return DEFAULT_ALLOWED_JOBS
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (ids.length === 1 && ids[0] === '*') {
    return Object.keys(JOB_REGISTRY)
  }
  return ids
}

function resolveAllowedJobs(): JobModule[] {
  const requested = readAllowedJobIdsFromEnv()
  const jobs: JobModule[] = []

  for (const id of requested) {
    const run = JOB_REGISTRY[id]
    if (!run) {
      jobsLogger.warn('Requested job id not in registry: {id}', { id })
      continue
    }
    jobs.push({ name: toPrettyName(id), run })
  }

  if (jobs.length === 0) {
    jobsLogger.warn('No jobs resolved from allowlist. Requested: {requested}', {
      requested: requested.join(', ') || '(none)',
    })
  } else {
    jobsLogger.info('Resolved {count} job(s) from allowlist: {names}', {
      count: jobs.length,
      names: jobs.map(j => j.name).join(', '),
    })
  }

  return jobs
}

export interface JobsController {
  stop: () => void
  pause: () => void
  resume: () => void
  isPaused: () => boolean
  getDelayMs: () => number
}

const controller: JobsController = {
  stop() {
    if (!isRunning) {
      jobsLogger.warn('Jobs runner is not running.')
      return
    }
    isStopped = true
    jobsLogger.info('Stop signal received for jobs loop.')
  },
  pause() {
    if (!paused) {
      paused = true
      jobsLogger.info('Jobs runner paused.')
    }
  },
  resume() {
    if (paused) {
      paused = false
      jobsLogger.info('Jobs runner resumed.')
    }
  },
  isPaused() {
    return paused
  },
  getDelayMs() {
    return parseDelayMs()
  },
}

/**
 * Starts the jobs loop in the background.
 * - Loads job modules from the explicit allowlist (no directory reads).
 * - Runs each job's `run()` sequentially.
 * - Logs duration per job and total cycle duration.
 * - Continues indefinitely with a delay between cycles (configurable via env).
 * - Supports pause/resume via exported controller methods.
 * - If RUN_JOBS=false, this function logs and returns a no-op controller.
 */
export function startJobs(db: Database): JobsController {
  if (isRunning) {
    jobsLogger.warn('Jobs runner is already running.')
    return controller
  }

  const runJobs = readEnvBoolean(Bun.env.RUN_JOBS, true)
  if (!runJobs) {
    jobsLogger.info('Jobs runner disabled by RUN_JOBS=false, not starting.')
    return controller
  }

  isRunning = true
  isStopped = false
  const delayMs = parseDelayMs()

  ;(async () => {
    jobsLogger.info('Starting jobs loop with delay {delay} ({ms} ms)', {
      delay: formatDuration(delayMs),
      ms: delayMs,
    })

    const jobs = resolveAllowedJobs()

    for (;;) {
      if (isStopped) break
      const iterationStart = Date.now()

      // Wait while paused (in 5s ticks to allow timely resume/stop)
      for (;;) {
        if (isStopped || !paused) break
        jobsLogger.info('Jobs are paused. Waiting to resume...')
        await sleep(5_000)
      }
      if (isStopped) break

      // Run each job sequentially
      for (const job of jobs) {
        const t0 = Date.now()
        try {
          jobsLogger.info('Starting job: {name}', { name: job.name })
          await job.run(db)
          const dur = Date.now() - t0
          jobsLogger.info('Finished job: {name} in {duration} ({ms} ms)', {
            name: job.name,
            duration: formatDuration(dur),
            ms: dur,
          })
        } catch (err) {
          const dur = Date.now() - t0
          jobsLogger.error('Job failed: {name} after {duration}', {
            name: job.name,
            duration: formatDuration(dur),
            error: normalizeError(err),
          })
          // Continue to next job
        }
      }

      const iterDur = Date.now() - iterationStart
      jobsLogger.info('Jobs cycle completed in {duration} ({ms} ms)', {
        duration: formatDuration(iterDur),
        ms: iterDur,
      })

      // Sleep until next run, unless stopped/paused interrupts in between
      const wakeAt = Date.now() + delayMs
      for (;;) {
        if (isStopped || Date.now() >= wakeAt) break
        // If paused during sleep, break and go to pause loop
        if (paused) break
        const remaining = Math.max(0, wakeAt - Date.now())
        await sleep(Math.min(remaining, 1_000))
      }
    }

    jobsLogger.info('Jobs loop stopped.')
    isRunning = false
  })().catch((err) => {
    jobsLogger.error('Fatal error in jobs loop', { error: normalizeError(err) })
    isRunning = false
  })

  return controller
}

export const jobs: {
  start: (db: Database) => JobsController
  stop: () => void
  pause: () => void
  resume: () => void
  isPaused: () => boolean
  getDelayMs: () => number
} = {
  start: startJobs,
  stop: controller.stop,
  pause: controller.pause,
  resume: controller.resume,
  isPaused: controller.isPaused,
  getDelayMs: controller.getDelayMs,
}

export default jobs
