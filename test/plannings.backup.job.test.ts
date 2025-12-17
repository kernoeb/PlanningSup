import { beforeAll, describe, expect, it } from 'bun:test'

type CalEvent = {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

describe('plannings-backup job', () => {
  const p1 = { fullId: 'p.1', url: 'http://localhost/p1.ics' }
  const p2 = { fullId: 'p.2', url: 'http://localhost/p2.ics' }

  const events: CalEvent[] = [
    {
      uid: 'u1',
      summary: 'S',
      startDate: new Date('2025-01-01T10:00:00Z'),
      endDate: new Date('2025-01-01T11:00:00Z'),
      location: 'L',
      description: 'D',
    },
  ]

  beforeAll(() => {
    Bun.env.NODE_ENV = 'test'
    Bun.env.JOBS_PLANNINGS_BACKUP_PAUSE_MS = '0'
  })

  it('upserts backups for plannings with events (including empty schedules)', async () => {
    const calls: Array<{ fullId: string, nbEvents: number }> = []

    const { runPlanningsBackup } = await import('@api/jobs/plannings-backup')
    await runPlanningsBackup(
      {} as any,
      {
        flattenedPlannings: [p1, p2],
        async fetchEvents(url: string) {
          if (url === p1.url) return events
          if (url === p2.url) return []
          return null
        },
        async upsertPlanningBackup(_db: any, planningFullId: string, evts: any[]) {
          calls.push({ fullId: planningFullId, nbEvents: evts.length })
          return { changed: true, nbEvents: evts.length }
        },
      },
    )

    expect(calls).toEqual([
      { fullId: p1.fullId, nbEvents: 1 },
      { fullId: p2.fullId, nbEvents: 0 },
    ])
  })

  it('skips when fetchEvents returns null and respects AbortSignal between plannings', async () => {
    const calls: string[] = []
    const ac = new AbortController()

    const { runPlanningsBackup } = await import('@api/jobs/plannings-backup')
    await runPlanningsBackup(
      {} as any,
      {
        flattenedPlannings: [p1, p2],
        async fetchEvents(url: string) {
          if (url === p1.url) return null
          if (url === p2.url) return events
          return null
        },
        async upsertPlanningBackup(_db: any, planningFullId: string, evts: any[]) {
          calls.push(`${planningFullId}:${evts.length}`)
          // Abort as soon as we process one planning to ensure the loop stops early.
          ac.abort('stop')
          return { changed: true, nbEvents: evts.length }
        },
      },
      ac.signal,
    )

    // p1 is skipped (null). p2 would be processed, but we abort immediately after that upsert.
    expect(calls).toEqual([`${p2.fullId}:1`])
  })
})
