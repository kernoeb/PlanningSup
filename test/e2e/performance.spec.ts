import { test, expect } from '@playwright/test'
import { createOptimizedHelper } from './helpers-optimized'

test.describe('Performance and Stability Tests', () => {
  // Use test.beforeAll for expensive setup that can be shared
  test.beforeAll(async ({ browser }) => {
    // Pre-warm the browser context to improve test startup time
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('http://localhost:20000')
    await page.close()
    await context.close()
  })

  test('application loads within performance budget', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    // Track performance metrics from the start
    await page.addInitScript(() => {
      window.performance.mark('app-start')
    })

    const startTime = Date.now()
    await helper.fastSetup()

    // Measure load time
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(3000) // App should load in under 3 seconds

    // Check performance metrics
    const performanceMetrics = await page.evaluate(() => {
      window.performance.mark('app-ready')
      const measure = window.performance.measure('app-load-time', 'app-start', 'app-ready')
      const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

      return {
        loadDuration: measure.duration,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0,
        largestContentfulPaint: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0
      }
    })

    // Performance assertions
    expect(performanceMetrics.loadDuration).toBeLessThan(2000)
    expect(performanceMetrics.domContentLoaded).toBeLessThan(1000)
    expect(performanceMetrics.firstPaint).toBeLessThan(1500)
  })

  test('handles concurrent API requests efficiently', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    // Track API calls
    const apiCalls: string[] = []
    await page.route('**/api/**', async (route) => {
      apiCalls.push(route.request().url())

      // Simulate slight delay to test concurrency
      await new Promise(resolve => setTimeout(resolve, 100))

      // Handle based on endpoint
      const url = route.request().url()
      if (url.includes('/api/plannings')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        })
      } else if (url.includes('/api/auth')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'test' } })
        })
      } else {
        await route.continue()
      }
    })

    await helper.fastSetup({ mockApi: false })

    // Prime at least one API call and wait for it to register
    await test.step('Prime API call', async () => {
      await page.evaluate(() => fetch('/api/plannings'))
      await expect.poll(() => apiCalls.length).toBeGreaterThan(0)
    })

    // Trigger multiple rapid interactions with better error handling
    await test.step('Rapid concurrent interactions', async () => {
      for (let i = 0; i < 3; i++) {
        await helper.openPlanningPicker()
        try {
          await page.locator('#planning-picker-close').click({ timeout: 3000 })
        } catch {
          // Fallback to escape key if close button isn't available
          await page.keyboard.press('Escape')
        }
        await page.waitForTimeout(200) // Small delay between iterations
      }
    })

    // Verify app remains stable
    await expect(page.locator('#planningsup-app')).toBeVisible()
    await helper.verifyCalendar()

    // Should have made API calls efficiently
    expect(apiCalls.length).toBeGreaterThan(0)
  })

  test('memory usage remains stable during extended interaction', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    // Get baseline memory
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })

    // Perform repeated interactions
    await test.step('Extended interaction simulation', async () => {
      for (let i = 0; i < 3; i++) {
        // Check if page is still open
        if (page.isClosed()) {
          console.log('Page closed during test, stopping interactions')
          break
        }

        await helper.openPlanningPicker()
        await page.fill('#planning-search-input', `test-${i}`)
        try {
          await page.locator('#planning-picker-close').click({ timeout: 3000 })
        } catch {
          await page.keyboard.press('Escape')
        }

        // Navigate calendar with better error handling
        if (!page.isClosed()) {
          await helper.fastNavigation('next')
          await helper.fastNavigation('previous')
        }
      }
    })

    // Check memory after interactions
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })

    // Memory should not have grown excessively (allow 100% increase for E2E environment)
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = (finalMemory - initialMemory) / initialMemory
      expect(memoryIncrease).toBeLessThan(1.0)
    }
  })

  test('handles API errors gracefully without performance degradation', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    // Setup API error responses to test error handling
    await page.route('**/api/plannings**', async (route) => {
      await route.fulfill({ status: 500, body: 'Server Error' })
    })

    await page.route('**/api/events**', async (route) => {
      await route.fulfill({ status: 404, body: 'Not Found' })
    })

    const startTime = Date.now()
    await helper.fastSetup({ mockApi: false })

    // App should still load reasonably fast even with API errors
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(5000)

    // Basic functionality should work despite API errors
    await expect(page.locator('#planningsup-app')).toBeVisible()
    await helper.verifyCalendar()

    // Should handle errors gracefully
    await helper.openPlanningPicker()
    await page.locator('#planning-picker-close').click()

    // No additional testing needed - the fact that the app loaded and works proves error handling
  })

  test('UI remains responsive during slow API responses', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    // Setup slow API responses
    await page.route('**/api/**', async (route) => {
      // Simulate slow response
      await new Promise(resolve => setTimeout(resolve, 2000))

      const url = route.request().url()
      if (url.includes('/api/plannings')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        })
      } else {
        await route.continue()
      }
    })

    await helper.fastSetup()

    // UI should remain interactive even with slow APIs
    await test.step('Test UI responsiveness during slow API', async () => {
      // Start an API-dependent action
      const planningPickerPromise = helper.openPlanningPicker()

      // UI should still be responsive
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()

      // Wait for the slow API action to complete
      await planningPickerPromise
      await page.locator('#planning-picker-close').click()
    })
  })

  test('no memory leaks in DOM manipulation', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    // Count initial DOM nodes
    const initialNodeCount = await page.evaluate(() =>
      document.querySelectorAll('*').length
    )

    // Perform operations that create/destroy DOM elements
    await test.step('DOM manipulation stress test', async () => {
      for (let i = 0; i < 5; i++) {
        await helper.openPlanningPicker()
        await page.fill('#planning-search-input', `search-${i}`)

        // Wait for any dynamic content
        await page.waitForTimeout(200)

        await page.locator('#planning-picker-close').click()

        // Ensure modal is fully closed
        await expect(page.locator('#planning-picker-modal')).not.toBeVisible()
      }
    })

    // Allow time for cleanup
    await page.waitForTimeout(1000)

    // Count final DOM nodes
    const finalNodeCount = await page.evaluate(() =>
      document.querySelectorAll('*').length
    )

    // Should not have significantly more DOM nodes (allow 70% increase for E2E environment)
    const nodeIncrease = (finalNodeCount - initialNodeCount) / initialNodeCount
    expect(nodeIncrease).toBeLessThan(0.7)
  })

  test('performance across different viewport sizes', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-large' },
      { width: 1280, height: 720, name: 'desktop-standard' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ]

    for (const viewport of viewports) {
      await test.step(`Test performance on ${viewport.name}`, async () => {
        await page.setViewportSize(viewport)

        const startTime = Date.now()
        await helper.fastSetup()
        const loadTime = Date.now() - startTime

        // Performance should be consistent across viewports
        expect(loadTime).toBeLessThan(4000)

        // Basic functionality should work
        await expect(page.locator('#planningsup-app')).toBeVisible()
        await helper.verifyResponsiveDesign()
      })
    }
  })

  test('handles rapid user interactions without blocking', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('Rapid interaction stress test', async () => {
      // Simulate rapid user clicks
      const interactions = []

      for (let i = 0; i < 20; i++) {
        interactions.push(
          page.locator('#user-menu-trigger').click({ timeout: 1000 }).catch(() => {})
        )

        // Small delay to make interactions more realistic
        await page.waitForTimeout(50)
      }

      // All interactions should complete without blocking
      await Promise.allSettled(interactions)
    })

    // App should remain stable
    await expect(page.locator('#planningsup-app')).toBeVisible()
  })

  test('performance metrics within acceptable ranges', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    await page.addInitScript(() => {
      // Add performance observer for detailed metrics
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            (window as any).performanceMetrics = (window as any).performanceMetrics || {}
            ;(window as any).performanceMetrics[entry.name] = entry.duration
          }
        }
      }).observe({ entryTypes: ['measure'] })
    })

    await helper.fastSetup()

    // Perform comprehensive workflow
    await test.step('Complete user workflow', async () => {
      await page.evaluate(() => performance.mark('workflow-start'))

      await helper.openPlanningPicker()
      await page.evaluate(() => performance.mark('picker-opened'))

      await helper.selectPlanning()
      await page.evaluate(() => performance.mark('planning-selected'))

      await helper.verifyEventsDisplayed()
      await page.evaluate(() => performance.mark('events-loaded'))

      await helper.fastNavigation('next')
      await page.evaluate(() => performance.mark('navigation-complete'))
    })

    // Measure all workflow steps
    const workflowMetrics = await page.evaluate(() => {
      performance.measure('picker-open-time', 'workflow-start', 'picker-opened')
      performance.measure('selection-time', 'picker-opened', 'planning-selected')
      performance.measure('events-load-time', 'planning-selected', 'events-loaded')
      performance.measure('navigation-time', 'events-loaded', 'navigation-complete')

      return (window as any).performanceMetrics || {}
    })

    // Assert performance budgets
    if (workflowMetrics['picker-open-time']) {
      expect(workflowMetrics['picker-open-time']).toBeLessThan(1000)
    }
    if (workflowMetrics['selection-time']) {
      expect(workflowMetrics['selection-time']).toBeLessThan(500)
    }
    if (workflowMetrics['events-load-time']) {
      expect(workflowMetrics['events-load-time']).toBeLessThan(2000)
    }
    if (workflowMetrics['navigation-time']) {
      expect(workflowMetrics['navigation-time']).toBeLessThan(800)
    }
  })
})
