import type { JobId } from './ids'

export type JobRuntimeState
  = | 'starting'
    | 'idle'
    | 'working'
    | 'paused'
    | 'quiet_hours'
    | 'stopped'
    | 'exited'
    | 'crashed'

export interface JobRuntime {
  state: JobRuntimeState
  updatedAt: Date
  startedAt?: Date
  lastLoopAt?: Date
  lastWorkAt?: Date
  lastPausedWaitAt?: Date
  lastQuietHoursSkipAt?: Date
  lastErrorAt?: Date
  lastError?: string
}

const runtimeByJobId = new Map<JobId, JobRuntime>()

export function updateJobRuntime(jobId: JobId, patch: Partial<Omit<JobRuntime, 'updatedAt'>> & { updatedAt?: Date }) {
  const prev = runtimeByJobId.get(jobId)
  const updatedAt = patch.updatedAt ?? new Date()
  const { updatedAt: _patchUpdatedAt, ...rest } = patch

  const next: JobRuntime = {
    state: prev?.state ?? 'starting',
    ...prev,
    ...rest,
    updatedAt,
  }

  runtimeByJobId.set(jobId, next)
  return next
}

export function getJobRuntime(jobId: JobId): JobRuntime | null {
  return runtimeByJobId.get(jobId) ?? null
}

export function getJobRuntimeSnapshot(): Record<JobId, JobRuntime> {
  return Object.fromEntries(runtimeByJobId.entries()) as Record<JobId, JobRuntime>
}
