import type { Database } from '@api/db'
import config from '@api/config'

import { jobsLogger } from '@api/utils/logger'
// ----- Explicit job registry (whitelist) -----
// Add new jobs by importing their run() function and registering here.
import { run as runPlanningsBackup } from './plannings-backup'
import { run as runPlanningsRefreshQueue } from './plannings-refresh-queue'

// Environment variable names supported:
// - RUN_JOBS: "false" | "0" disables the job runner, everything else enables it (default: enabled)
// - DELAY_BETWEEN_JOBS: delay between cycles (supports ms number or "60s", "1m", "500ms", "1h")
// - ALLOWED_JOBS: comma-separated list of job IDs to run, or "*" for all registered jobs.
//   Example: ALLOWED_JOBS="plannings-backup,another-job"
// - JOBS_QUIET_HOURS: time range when jobs should not run (default: "21:00–06:00")
//   Examples: "21:00–06:00" (crosses midnight), "02:00–04:00" (same day), "" (disabled)
//   Supports both en dash (–) and hyphen (-) as separators
// - JOBS_QUIET_HOURS_TIMEZONE: timezone for quiet hours (default: "Europe/Paris")
//   Examples: "Europe/Paris", "UTC", "America/New_York"
//
// A "job" is any module that exports an async `run(db: Database, signal?: AbortSignal): Promise<void>` function.
// Jobs must be added to the JOB_REGISTRY below, which is an explicit allowlist.
//
// Quiet Hours Feature:
// - Jobs are skipped if the current time falls within the configured quiet hours
// - If quiet hours begin while a job is running, the job receives an abort signal
// - Jobs should check the abort signal periodically and handle graceful shutdown
// - Quiet hours can cross midnight (e.g., 21:00–06:00) or stay within the same day (e.g., 02:00–04:00)
// - Times are evaluated in the configured timezone (default: Europe/Paris)

interface JobModule {
  name: string
  run: (db: Database, signal?: AbortSignal) => Promise<void>
}

let isRunning = false
let isStopped = false
let paused = false
let currentJobAbortController: AbortController | null = null

const DEFAULT_DELAY_MS = 60_000

export interface QuietHours {
  start: { hour: number, minute: number }
  end: { hour: number, minute: number }
  crossesMidnight: boolean
}

function parseDelayMs(): number {
  const parsed = parseDurationToMs(config.jobs.delayBetweenJobs)
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

export function parseQuietHours(input: string | undefined | null): QuietHours | null {
  if (!input) return null
  const raw = String(input).trim()
  if (raw === '') return null

  // Support both en dash (–) and hyphen (-) as separator
  const match = /^(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) return null

  const startHour = Number(match[1])
  const startMinute = Number(match[2])
  const endHour = Number(match[3])
  const endMinute = Number(match[4])

  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23
    || startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
    return null
  }

  const start = { hour: startHour, minute: startMinute }
  const end = { hour: endHour, minute: endMinute }

  // Check if the range crosses midnight (e.g., 21:00–06:00)
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  const crossesMidnight = startMinutes >= endMinutes

  return { start, end, crossesMidnight }
}

export function isInQuietHours(quietHours: QuietHours | null, now: Date = new Date(), timezone: string = config.jobs.quietHoursTimezone): boolean {
  if (!quietHours) return false

  // Convert current time to the specified timezone
  const timeInTimezone = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const currentHour = timeInTimezone.getHours()
  const currentMinute = timeInTimezone.getMinutes()
  const currentMinutes = currentHour * 60 + currentMinute

  const startMinutes = quietHours.start.hour * 60 + quietHours.start.minute
  const endMinutes = quietHours.end.hour * 60 + quietHours.end.minute

  if (quietHours.crossesMidnight) {
    // Range crosses midnight (e.g., 21:00–06:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  } else {
    // Range within same day (e.g., 02:00–04:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
}

export function formatQuietHours(quietHours: QuietHours | null): string {
  if (!quietHours) return 'disabled'

  const formatTime = (time: { hour: number, minute: number }) =>
    `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`

  return `${formatTime(quietHours.start)}–${formatTime(quietHours.end)}`
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
  'plannings-refresh-queue': runPlanningsRefreshQueue,
  'plannings-backup': runPlanningsBackup,
}

const DEFAULT_ALLOWED_JOBS = Object.freeze<string[]>(['plannings-refresh-queue', 'plannings-backup'])

function readAllowedJobIdsFromEnv(): readonly string[] {
  const raw = config.jobs.allowedJobs
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
  getQuietHours: () => QuietHours | null
  getTimezone: () => string
  isInQuietHours: () => boolean
}

const controller: JobsController = {
  stop() {
    if (!isRunning) {
      jobsLogger.warn('Jobs runner is not running.')
      return
    }
    isStopped = true
    // Abort any currently running job
    if (currentJobAbortController) {
      currentJobAbortController.abort('Jobs system stopping')
    }
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

  if (!config.jobs.runJobs) {
    jobsLogger.info('Jobs runner disabled by RUN_JOBS=false, not starting.')
    return controller
  }

  isRunning = true
  isStopped = false
  const delayMs = parseDelayMs()
  const quietHours = parseQuietHours(config.jobs.quietHours)
  const timezone = config.jobs.quietHoursTimezone

  ;(async () => {
    jobsLogger.info('Starting jobs loop with delay {delay} ({ms} ms), quiet hours: {quietHours} ({timezone})', {
      delay: formatDuration(delayMs),
      ms: delayMs,
      quietHours: formatQuietHours(quietHours),
      timezone,
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
        if (isStopped) break

        // Check quiet hours before starting job
        if (isInQuietHours(quietHours, new Date(), timezone)) {
          jobsLogger.info('Skipping job {name} due to quiet hours ({quietHours} in {timezone})', {
            name: job.name,
            quietHours: formatQuietHours(quietHours),
            timezone,
          })
          continue
        }

        const t0 = Date.now()
        currentJobAbortController = new AbortController()

        try {
          jobsLogger.info('Starting job: {name}', { name: job.name })

          // Start monitoring for quiet hours during job execution
          const quietHoursChecker = setInterval(() => {
            if (isInQuietHours(quietHours, new Date(), timezone) && currentJobAbortController && !currentJobAbortController.signal.aborted) {
              jobsLogger.info('Aborting job {name} due to quiet hours starting', { name: job.name })
              currentJobAbortController.abort('Quiet hours started')
            }
          }, 30_000) // Check every 30 seconds

          await job.run(db, currentJobAbortController.signal)
          clearInterval(quietHoursChecker)

          const dur = Date.now() - t0
          jobsLogger.info('Finished job: {name} in {duration} ({ms} ms)', {
            name: job.name,
            duration: formatDuration(dur),
            ms: dur,
          })
        } catch (err) {
          const dur = Date.now() - t0
          if (currentJobAbortController?.signal.aborted) {
            jobsLogger.info('Job aborted: {name} after {duration} (reason: {reason})', {
              name: job.name,
              duration: formatDuration(dur),
              reason: currentJobAbortController.signal.reason || 'Unknown',
            })
          } else {
            jobsLogger.error('Job failed: {name} after {duration}', {
              name: job.name,
              duration: formatDuration(dur),
              error: normalizeError(err),
            })
          }
          // Continue to next job
        } finally {
          currentJobAbortController = null
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
  getQuietHours: () => QuietHours | null
  getTimezone: () => string
  isInQuietHours: () => boolean
} = {
  start: startJobs,
  stop: controller.stop,
  pause: controller.pause,
  resume: controller.resume,
  isPaused: controller.isPaused,
  getDelayMs: controller.getDelayMs,
  getQuietHours: controller.getQuietHours,
  getTimezone: controller.getTimezone,
  isInQuietHours: controller.isInQuietHours,
}

export default jobs
