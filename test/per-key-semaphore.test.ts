import { describe, expect, it } from 'bun:test'

import { createPerKeySemaphore } from '@api/jobs/utils/per-key-semaphore'

describe('per-key semaphore', () => {
  it('limits concurrency per key', async () => {
    const sem = createPerKeySemaphore<string>(2)

    let active = 0
    let maxActive = 0

    const run = async () => {
      await sem.acquire('a')
      try {
        active++
        maxActive = Math.max(maxActive, active)
        // Yield to let other tasks attempt to enter.
        await new Promise(resolve => setTimeout(resolve, 10))
      } finally {
        active--
        sem.release('a')
      }
    }

    await Promise.all([run(), run(), run(), run(), run()])

    expect(maxActive).toBe(2)
  })
})

