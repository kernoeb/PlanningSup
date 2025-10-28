import { beforeAll, afterAll } from 'bun:test'

// Global test setup for integration tests
beforeAll(async () => {
  // Setup global test state
  console.log('Setting up integration tests...')

  // Wait for application to be ready
  const maxAttempts = 30
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://localhost:20000/api/ping')
      if (response.ok) {
        console.log('✅ Application is ready for testing')
        return
      }
    } catch (error) {
      // Continue trying
    }

    attempts++
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Application failed to start within timeout')
})

afterAll(() => {
  console.log('Cleaning up integration tests...')
})
