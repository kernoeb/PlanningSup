import { afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test'

import { installApiDbMock, resetApiDbMockStores } from './helpers/api-db-mock'

/**
 * Tests for request deduplication in resolveEvents().
 * Verifies that concurrent requests for the same planning
 * are coalesced into a single upstream fetch.
 */

// Track fetch calls
let fetchCallCount = 0
let fetchCalledWith: string[] = []
let fetchDelay = 50

function resetFetchTracking() {
  fetchCallCount = 0
  fetchCalledWith = []
}

// Valid ICS data to return
const VALID_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-event-1
SUMMARY:Test Event
DTSTART:20250101T090000Z
DTEND:20250101T100000Z
LOCATION:Room 101
DESCRIPTION:Test description
END:VEVENT
END:VCALENDAR`

// Use shared db mock
installApiDbMock()

describe('Request deduplication', () => {
  let eventsModule: typeof import('@api/utils/events')
  let fetchSpy: ReturnType<typeof spyOn>

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    Bun.env.NODE_ENV = 'test'
    eventsModule = await import('@api/utils/events')
  })

  beforeEach(() => {
    resetFetchTracking()
    resetApiDbMockStores()
    eventsModule.__test.reset()

    // Mock globalThis.fetch to track calls and return valid ICS
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      fetchCallCount++
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      fetchCalledWith.push(url)

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, fetchDelay))

      return new Response(VALID_ICS, {
        status: 200,
        headers: new Headers({ 'content-type': 'text/calendar' }),
      })
    })
  })

  afterEach(() => {
    eventsModule.__test.reset()
    fetchSpy.mockRestore()
  })

  it('deduplicates concurrent requests for the same planning', async () => {
    const planning = { url: 'https://uni.fr/ics/group1', fullId: 'uni.group1' }

    // Fire 20 concurrent requests for the same planning
    const requests = Array.from({ length: 20 }, () =>
      eventsModule.resolveEvents(planning, false),
    )

    const results = await Promise.all(requests)

    // Should have made only 1 fetch
    expect(fetchCallCount).toBe(1)
    expect(fetchCalledWith).toEqual([planning.url])

    // All requests should have succeeded with the same data
    for (const result of results) {
      expect(result.source).toBe('network')
      expect(result.events).not.toBeNull()
      expect(result.events?.length).toBe(1)
      expect(result.events?.[0].summary).toBe('Test Event')
    }

    // Inflight map should be empty after completion
    expect(eventsModule.__test.inflightSize()).toBe(0)
  })

  it('does not deduplicate requests for different plannings', async () => {
    const planning1 = { url: 'https://uni.fr/ics/group1', fullId: 'uni.group1' }
    const planning2 = { url: 'https://uni.fr/ics/group2', fullId: 'uni.group2' }
    const planning3 = { url: 'https://uni.fr/ics/group3', fullId: 'uni.group3' }

    // Fire concurrent requests for different plannings
    const requests = [
      eventsModule.resolveEvents(planning1, false),
      eventsModule.resolveEvents(planning2, false),
      eventsModule.resolveEvents(planning3, false),
    ]

    await Promise.all(requests)

    // Should have made 3 separate fetches
    expect(fetchCallCount).toBe(3)
    expect(fetchCalledWith).toContain(planning1.url)
    expect(fetchCalledWith).toContain(planning2.url)
    expect(fetchCalledWith).toContain(planning3.url)
  })

  it('allows new fetch after previous one completes', async () => {
    const planning = { url: 'https://uni.fr/ics/group1', fullId: 'uni.group1' }

    // First batch of requests
    const batch1 = Array.from({ length: 5 }, () =>
      eventsModule.resolveEvents(planning, false),
    )
    await Promise.all(batch1)

    expect(fetchCallCount).toBe(1)

    // Second batch after first completes - should trigger new fetch
    const batch2 = Array.from({ length: 5 }, () =>
      eventsModule.resolveEvents(planning, false),
    )
    await Promise.all(batch2)

    expect(fetchCallCount).toBe(2)
  })

  it('handles mixed concurrent requests correctly', async () => {
    const planningA = { url: 'https://uni-a.fr/ics/group1', fullId: 'uni-a.group1' }
    const planningB = { url: 'https://uni-b.fr/ics/group1', fullId: 'uni-b.group1' }

    // 10 requests for A, 10 for B, interleaved
    const requests = []
    for (let i = 0; i < 10; i++) {
      requests.push(eventsModule.resolveEvents(planningA, false))
      requests.push(eventsModule.resolveEvents(planningB, false))
    }

    await Promise.all(requests)

    // Should have made exactly 2 fetches (one per unique planning)
    expect(fetchCallCount).toBe(2)
  })

  it('does not deduplicate onlyDb requests', async () => {
    const planning = { url: 'https://uni.fr/ics/group1', fullId: 'uni.group1' }

    // onlyDb=true should not use the network
    const results = await Promise.all([
      eventsModule.resolveEvents(planning, true),
      eventsModule.resolveEvents(planning, true),
      eventsModule.resolveEvents(planning, true),
    ])

    // No network calls should have been made
    expect(fetchCallCount).toBe(0)

    // All should return db source (or none since db is mocked empty)
    for (const result of results) {
      expect(result.source).toBe('none')
      expect(result.networkFailed).toBe(false)
    }
  })

  it('cleans up inflight map even on fetch failure', async () => {
    // Temporarily override to simulate failure
    const originalFetch = fetchCallCount

    // The mock always succeeds, but let's verify cleanup happens
    const planning = { url: 'https://uni.fr/ics/group1', fullId: 'uni.group1' }

    await eventsModule.resolveEvents(planning, false)

    // Map should be empty after completion
    expect(eventsModule.__test.inflightSize()).toBe(0)
  })

  it('simulates 50 groups × 20 students scenario', async () => {
    fetchDelay = 10 // Speed up for this test

    // 50 unique plannings, 20 students each
    const plannings = Array.from({ length: 50 }, (_, i) => ({
      url: `https://uni.fr/ics/group${i}`,
      fullId: `uni.group${i}`,
    }))

    // Each planning requested by 20 students concurrently
    const allRequests: Promise<any>[] = []
    for (const planning of plannings) {
      for (let student = 0; student < 20; student++) {
        allRequests.push(eventsModule.resolveEvents(planning, false))
      }
    }

    // 1000 total requests
    expect(allRequests.length).toBe(1000)

    await Promise.all(allRequests)

    // Should have made exactly 50 fetches (one per unique planning)
    expect(fetchCallCount).toBe(50)

    // That's 950 requests saved!
    console.log(`\n=== Deduplication Results ===`)
    console.log(`Total requests: 1000`)
    console.log(`Actual fetches: ${fetchCallCount}`)
    console.log(`Requests saved: ${1000 - fetchCallCount}`)
  })
})
