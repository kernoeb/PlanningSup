import type { QuietHours } from './quiet-hours'

export interface JobContext {
  isPaused: () => boolean
  quietHours: QuietHours | null
  timezone: string
  waitForResumeOrStop: (signal: AbortSignal) => Promise<void>
}
