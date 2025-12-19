import { test, expect } from '@playwright/test'
import { createOptimizedHelper } from './helpers-optimized'

test.describe('Performance Smoke Tests', () => {
  test('app loads within performance budget', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    const startTime = Date.now()
    await helper.fastSetup()
    const loadTime = Date.now() - startTime

    // App should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000)

    // Basic functionality works after load
    await expect(page.locator('#planningsup-app')).toBeVisible()
    await helper.verifyCalendar()
  })

  test('UI remains responsive with slow API', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    // Simulate slow API responses
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })

    await helper.fastSetup()

    // UI should still be interactive
    await expect(page.locator('#planningsup-app')).toBeVisible()
    await helper.openPlanningPicker()
    await page.keyboard.press('Escape')

    // App remains stable
    await helper.verifyCalendar()
  })
})
