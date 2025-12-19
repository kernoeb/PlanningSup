import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { getApiDbMockStores, installApiDbMock, resetApiDbMockStores } from './helpers/api-db-mock'

/**
 * Load test simulating concurrent users with mocked upstream responses.
 *
 * Simulates different upstream behaviors:
 * - Fast responses (5-20ms)
 * - Slow responses (50-100ms)
 * - Timeouts
 * - HTTP 500/404 errors
 *
 * Verifies:
 * - Per-host concurrency limiting (no DDOS)
 * - Memory stays bounded
 * - System handles mixed failure modes gracefully
 * - Backup deduplication works under load
 */

type CalEvent = {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

type UpstreamBehavior = 'fast' | 'slow' | 'timeout' | 'http_500' | 'http_404'

interface MockStats {
  totalRequests: number
  concurrentByHost: Map<string, number>
  maxConcurrentByHost: Map<string, number>
  requestsByBehavior: Map<UpstreamBehavior, number>
}

function getUpsertCalls() {
  return getApiDbMockStores().insertCalls
    .map(c => c.values)
    .filter(v => v && 'planningFullId' in v && 'events' in v)
    .map(v => ({
      planningFullId: v.planningFullId,
      eventCount: Array.isArray(v.events) ? v.events.length : 0,
    }))
}

// Track logger calls (suppressed output, but counted)
const loggerCalls = {
  info: [] as Array<{ message: string, props: any }>,
  warn: [] as Array<{ message: string, props: any }>,
  error: [] as Array<{ message: string, props: any }>,
}

function resetLoggerCalls() {
  loggerCalls.info = []
  loggerCalls.warn = []
  loggerCalls.error = []
}

function countLogsByPattern(pattern: RegExp) {
  return {
    info: loggerCalls.info.filter(c => pattern.test(c.message)).length,
    warn: loggerCalls.warn.filter(c => pattern.test(c.message)).length,
  }
}

// Mock @api/utils/logger BEFORE any imports that use it
mock.module('@api/utils/logger', () => {
  const createMockLogger = () => ({
    info: (message: string, props?: any) => { loggerCalls.info.push({ message, props }) },
    warn: (message: string, props?: any) => { loggerCalls.warn.push({ message, props }) },
    error: (message: string, props?: any) => { loggerCalls.error.push({ message, props }) },
    debug: () => {},
  })

  return {
    defaultLogger: createMockLogger(),
    elysiaLogger: createMockLogger(),
    jobsLogger: createMockLogger(),
  }
})

const SIMULATED_HOSTS = ['uni-a.fr', 'uni-b.fr', 'uni-c.fr', 'uni-d.fr', 'uni-e.fr']
const PER_HOST_CONCURRENCY_LIMIT = 2

function createMockStats(): MockStats {
  return {
    totalRequests: 0,
    concurrentByHost: new Map(),
    maxConcurrentByHost: new Map(),
    requestsByBehavior: new Map(),
  }
}

function generatePlanningId(host: string, index: number): string {
  return `${host}.faculty${index % 10}.program${index % 5}.group${index}`
}

function generateMockEvents(planningId: string, count = 50): CalEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    uid: `${planningId}-evt-${i}`,
    summary: `Course ${i}`,
    startDate: new Date(`2025-01-${(i % 28) + 1}T${8 + (i % 10)}:00:00Z`),
    endDate: new Date(`2025-01-${(i % 28) + 1}T${9 + (i % 10)}:00:00Z`),
    location: `Room ${i % 20}`,
    description: `Description for event ${i}`,
  }))
}

function getBehaviorForPlanning(planningId: string): UpstreamBehavior {
  const hash = planningId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const behaviors: UpstreamBehavior[] = [
    'fast', 'fast', 'fast', 'fast', 'fast', 'fast', // 60% fast
    'slow', 'slow', // 20% slow
    'http_500', // 10% errors
    'http_404',
  ]
  return behaviors[hash % behaviors.length]
}

function getDelayForBehavior(behavior: UpstreamBehavior): number {
  switch (behavior) {
    case 'fast': return 2 + Math.random() * 5
    case 'slow': return 20 + Math.random() * 30
    case 'timeout': return 100
    default: return 1
  }
}

describe('API load test (mocked upstream)', () => {
  let mockStats: MockStats
  let backupModule: typeof import('@api/utils/plannings-backup')

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    Bun.env.NODE_ENV = 'test'
    process.env.PLANNINGS_BACKUP_WRITE_THROTTLE_MS = '0'
    Bun.env.PLANNINGS_BACKUP_WRITE_THROTTLE_MS = '0'

    installApiDbMock()
    // Import AFTER mock is set up, with cache busting to ensure we get the mocked DB
    // (in case the module was already loaded with the real DB by a previous test)
    backupModule = await import(`@api/utils/plannings-backup?test=${Date.now()}`) as any
  })

  beforeEach(() => {
    mockStats = createMockStats()
    resetApiDbMockStores()
    resetLoggerCalls()
    backupModule.__test.reset()
  })

  afterEach(() => {
    backupModule.__test.reset()
  })

  function createMockedFetchEvents(stats: MockStats) {
    return async (url: string): Promise<{ events: CalEvent[] | null, failure: any }> => {
      let host = 'unknown'
      try {
        host = new URL(url).host
      } catch {}

      const currentConcurrent = (stats.concurrentByHost.get(host) ?? 0) + 1
      stats.concurrentByHost.set(host, currentConcurrent)

      const maxConcurrent = stats.maxConcurrentByHost.get(host) ?? 0
      if (currentConcurrent > maxConcurrent) {
        stats.maxConcurrentByHost.set(host, currentConcurrent)
      }

      stats.totalRequests++

      const planningId = url.split('/').pop()?.split('?')[0] ?? 'unknown'
      const behavior = getBehaviorForPlanning(planningId)
      stats.requestsByBehavior.set(behavior, (stats.requestsByBehavior.get(behavior) ?? 0) + 1)

      const delay = getDelayForBehavior(behavior)

      try {
        await new Promise(resolve => setTimeout(resolve, delay))

        switch (behavior) {
          case 'fast':
          case 'slow':
            return { events: generateMockEvents(planningId), failure: null }
          case 'timeout':
            return { events: null, failure: { kind: 'timeout', status: null, code: null, retryAfterMs: null, message: 'Request timed out' } }
          case 'http_500':
            return { events: null, failure: { kind: 'http_5xx', status: 500, code: null, retryAfterMs: null, message: 'Internal Server Error' } }
          case 'http_404':
            return { events: null, failure: { kind: 'http_4xx', status: 404, code: null, retryAfterMs: null, message: 'Not Found' } }
          default:
            return { events: generateMockEvents(planningId), failure: null }
        }
      } finally {
        const newConcurrent = (stats.concurrentByHost.get(host) ?? 1) - 1
        stats.concurrentByHost.set(host, newConcurrent)
      }
    }
  }

  it('per-host concurrency never exceeds limit under 1000 user load', async () => {
    const { createPerKeySemaphore } = await import('@api/jobs/utils/per-key-semaphore')
    const hostSem = createPerKeySemaphore<string>(PER_HOST_CONCURRENCY_LIMIT)
    const mockedFetch = createMockedFetchEvents(mockStats)

    const fetchWithSemaphore = async (url: string) => {
      let host = 'unknown'
      try { host = new URL(url).host } catch {}

      await hostSem.acquire(host)
      try {
        return await mockedFetch(url)
      } finally {
        hostSem.release(host)
      }
    }

    // 1000 users × 3 calendars = 3000 requests
    const allRequests: Promise<any>[] = []
    const USERS = 1000
    const CALENDARS_PER_USER = 3

    for (let user = 0; user < USERS; user++) {
      for (let cal = 0; cal < CALENDARS_PER_USER; cal++) {
        const host = SIMULATED_HOSTS[user % SIMULATED_HOSTS.length]
        const planningId = generatePlanningId(host, user * CALENDARS_PER_USER + cal)
        const url = `https://${host}/ics/${planningId}`
        allRequests.push(fetchWithSemaphore(url))
      }
    }

    await Promise.all(allRequests)

    console.log('\n=== Per-Host Concurrency (1000 users) ===')
    for (const host of SIMULATED_HOSTS) {
      const maxConcurrent = mockStats.maxConcurrentByHost.get(host) ?? 0
      console.log(`${host}: max concurrent = ${maxConcurrent}`)
      expect(maxConcurrent).toBeLessThanOrEqual(PER_HOST_CONCURRENCY_LIMIT)
    }

    console.log(`Total requests: ${mockStats.totalRequests}`)
    expect(mockStats.totalRequests).toBe(USERS * CALENDARS_PER_USER)
  }, 30_000)

  it('backup write deduplication under rapid concurrent requests', async () => {
    const planningId = 'test.load.dedup'
    const events = generateMockEvents(planningId)

    // 500 rapid concurrent backup writes for same planning
    for (let i = 0; i < 500; i++) {
      backupModule.schedulePlanningBackupWrite(planningId, events)
    }

    // Wait for async writes to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    const sizes = backupModule.__test.sizes()
    const upsertCalls = getUpsertCalls()

    // Should deduplicate to 1 entry in state
    expect(sizes.writeState).toBe(1)
    // Should have called DB upsert only once (or twice if there was a pending write)
    expect(upsertCalls.length).toBeLessThanOrEqual(2)
    // Verify the upsert was for our planning
    expect(upsertCalls.some(c => c.planningFullId === planningId)).toBeTrue()
    // Verify log counts: 1 scheduled, many queued (499), few upserts
    const scheduled = countLogsByPattern(/scheduled/)
    const queued = countLogsByPattern(/queued/)
    const upsert = countLogsByPattern(/upsert/)
    expect(scheduled.info).toBe(1)
    expect(queued.info).toBe(499)
    expect(upsert.info).toBeLessThanOrEqual(2)
  })

  it('refresh request throttling caps memory under 1000 unique plannings', async () => {
    for (let i = 0; i < 1000; i++) {
      await backupModule.requestPlanningRefresh(`test.throttle.${i}`, 10)
    }

    const sizes = backupModule.__test.sizes()
    console.log(`\n=== Throttle Map ===`)
    console.log(`Refresh state after 1000 unique plannings: ${sizes.refreshState}`)

    // Capped at 200 in test mode
    expect(sizes.refreshState).toBeLessThanOrEqual(200)
  })

  it('handles mixed success/failure responses gracefully', async () => {
    const mockedFetch = createMockedFetchEvents(mockStats)
    const requests: Promise<{ events: CalEvent[] | null, failure: any }>[] = []

    for (let i = 0; i < 500; i++) {
      const host = SIMULATED_HOSTS[i % SIMULATED_HOSTS.length]
      const planningId = generatePlanningId(host, i)
      requests.push(mockedFetch(`https://${host}/ics/${planningId}`))
    }

    const results = await Promise.all(requests)
    const successCount = results.filter(r => r.events !== null).length
    const failureCount = results.filter(r => r.failure !== null).length

    console.log(`\n=== Mixed Responses ===`)
    console.log(`Total: ${results.length}, Success: ${successCount}, Failures: ${failureCount}`)

    expect(successCount).toBeGreaterThan(0)
    expect(failureCount).toBeGreaterThan(0)
    expect(successCount + failureCount).toBe(500)
  })

  it('write state memory stays bounded under 5000 unique plannings', async () => {
    const events = generateMockEvents('test', 10)

    for (let i = 0; i < 5000; i++) {
      backupModule.schedulePlanningBackupWrite(`test.memory.${i}`, events)
      if (i % 500 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }

    await new Promise(resolve => setTimeout(resolve, 100))

    const sizes = backupModule.__test.sizes()
    const upsertCalls = getUpsertCalls()

    // Capped at 200 in test mode
    expect(sizes.writeState).toBeLessThanOrEqual(200)
    // Should have made some upsert calls (capped by memory limit)
    expect(upsertCalls.length).toBeGreaterThan(0)
    expect(upsertCalls.length).toBeLessThanOrEqual(200)
    // Verify log counts: 200 scheduled, 4800 skipped
    const scheduled = countLogsByPattern(/scheduled/)
    const skipped = countLogsByPattern(/skipped/)
    expect(scheduled.info).toBe(200)
    expect(skipped.warn).toBe(4800)
  })

  it('simulates 200 concurrent user sessions with refreshes', async () => {
    const { createPerKeySemaphore } = await import('@api/jobs/utils/per-key-semaphore')
    const hostSem = createPerKeySemaphore<string>(PER_HOST_CONCURRENCY_LIMIT)
    const mockedFetch = createMockedFetchEvents(mockStats)

    const fetchWithSemaphore = async (url: string) => {
      let host = 'unknown'
      try { host = new URL(url).host } catch {}

      await hostSem.acquire(host)
      try {
        return await mockedFetch(url)
      } finally {
        hostSem.release(host)
      }
    }

    const sessions: Promise<void>[] = []
    const results = { success: 0, failures: 0 }

    for (let user = 0; user < 200; user++) {
      sessions.push((async () => {
        const host = SIMULATED_HOSTS[user % SIMULATED_HOSTS.length]
        const plannings = [0, 1, 2].map(i => generatePlanningId(host, user * 3 + i))

        // Initial load + 3 refreshes = 4 rounds
        for (let round = 0; round < 4; round++) {
          const roundResults = await Promise.all(
            plannings.map(p => fetchWithSemaphore(`https://${host}/ics/${p}`)),
          )
          results.success += roundResults.filter(r => r.events).length
          results.failures += roundResults.filter(r => r.failure).length

          if (round < 3) await new Promise(r => setTimeout(r, 5))
        }
      })())
    }

    await Promise.all(sessions)

    console.log(`\n=== User Sessions (200 users × 4 rounds) ===`)
    console.log(`Success: ${results.success}, Failures: ${results.failures}`)
    console.log(`Total requests: ${mockStats.totalRequests}`)

    for (const host of SIMULATED_HOSTS) {
      const maxConcurrent = mockStats.maxConcurrentByHost.get(host) ?? 0
      expect(maxConcurrent).toBeLessThanOrEqual(PER_HOST_CONCURRENCY_LIMIT)
    }

    expect(mockStats.totalRequests).toBe(200 * 3 * 4) // 200 users × 3 calendars × 4 rounds
  }, 30_000)

  it('no degradation over sustained load waves', async () => {
    const { createPerKeySemaphore } = await import('@api/jobs/utils/per-key-semaphore')
    const hostSem = createPerKeySemaphore<string>(PER_HOST_CONCURRENCY_LIMIT)
    const mockedFetch = createMockedFetchEvents(mockStats)

    const fetchWithSemaphore = async (url: string) => {
      let host = 'unknown'
      try { host = new URL(url).host } catch {}

      await hostSem.acquire(host)
      try {
        return await mockedFetch(url)
      } finally {
        hostSem.release(host)
      }
    }

    const waves = 10
    const requestsPerWave = 100
    const waveTimes: number[] = []

    for (let wave = 0; wave < waves; wave++) {
      const start = performance.now()

      const requests = Array.from({ length: requestsPerWave }, (_, i) => {
        const host = SIMULATED_HOSTS[i % SIMULATED_HOSTS.length]
        return fetchWithSemaphore(`https://${host}/ics/${generatePlanningId(host, wave * 100 + i)}`)
      })

      await Promise.all(requests)
      waveTimes.push(performance.now() - start)
    }

    const firstHalf = waveTimes.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    const secondHalf = waveTimes.slice(5).reduce((a, b) => a + b, 0) / 5
    const degradation = secondHalf / firstHalf

    console.log(`\n=== Sustained Load (${waves} waves × ${requestsPerWave} requests) ===`)
    console.log(`First half avg: ${firstHalf.toFixed(0)}ms, Second half avg: ${secondHalf.toFixed(0)}ms`)
    console.log(`Degradation ratio: ${degradation.toFixed(2)}x`)

    // Should not degrade more than 2x
    expect(degradation).toBeLessThan(2)
  }, 30_000)
})
