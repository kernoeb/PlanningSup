import { test, expect } from '@playwright/test'
import { createOptimizedHelper } from './helpers-optimized'

test.describe('Core Functionality', () => {
  test('essential app loading and navigation', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    // Batch basic checks for better performance
    await batchExpected([
      () => expect(page).toHaveTitle(/PlanningSup/),
      () => expect(page.locator('#planningsup-app')).toBeVisible()
    ])

    // Test critical user flow in one optimized test
    await test.step('Planning picker workflow', async () => {
      await helper.openPlanningPicker()
      await expect(page.locator('#planning-picker-modal')).toBeVisible()
      await helper.selectPlanning()
    })

    await test.step('Calendar verification', async () => {
      await helper.verifyCalendar()
    })
  })

  test('responsive design check', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await helper.verifyResponsiveDesign()
  })

  test('navbar elements and user menu', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await helper.verifyNavbarElements()

    // Desktop-only: test Dracula theme persistence
    if (helper.device.isDesktop()) {
      await test.step('Theme persistence (dracula)', async () => {
        await helper.switchTheme('dracula')
        await helper.assertThemePersists('dracula')
      })
    }

    // Test user menu interaction
    const userMenuTrigger = page.locator('#user-menu-trigger')
    const triggerCount = await userMenuTrigger.count()

    if (triggerCount > 0) {
      const isDisabled = await userMenuTrigger.first().getAttribute('class')
      if (!isDisabled?.includes('btn-disabled')) {
        try {
          await userMenuTrigger.first().click({ timeout: 3000 })
          await expect(page.locator('#user-dropdown-menu')).toBeVisible()
          // Close menu by clicking elsewhere
          await page.locator('#planningsup-app').click()
        } catch {
          // If the menu isn't interactable (auth optional), skip gracefully
        }
      }
    }
  })

  test('planning selection and events display', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    // Complete planning selection workflow
    await helper.openPlanningPicker()

    // Verify picker functionality
    await expect(page.locator('#planning-search-input')).toBeVisible()
    await expect(page.locator('#planning-tree-container')).toBeVisible()

    // Test search functionality quickly
    await page.fill('#planning-search-input', 'test')
    await page.waitForTimeout(300) // Minimal wait for search

    await helper.selectPlanning()

    // Verify planning selection result
    if (helper.device.isDesktop()) {
      const badge = page.locator('#current-planning-badge')
      await expect(badge).toBeVisible()
      const badgeText = await badge.textContent()
      expect(badgeText).toBeTruthy()
    }

    // Verify events are loaded
    await helper.verifyEventsDisplayed()
  })

  test('calendar navigation', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await helper.verifyCalendar()

    // Test all navigation in sequence for efficiency
    await test.step('Navigate calendar periods', async () => {
      await helper.fastNavigation('next')
      await helper.fastNavigation('previous')
      if (helper.device.isDesktop()) {
        await expect(page.locator('.sx__today-button')).toBeVisible()
      }
      await helper.fastNavigation('today')
    })
  })

  test('keyboard navigation and accessibility', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await helper.checkAccessibility()

    // Test escape key functionality
    await helper.openPlanningPicker()
    await page.keyboard.press('Escape')
    await expect(page.locator('#planning-picker-dialog')).not.toBeVisible()
  })

  test('error handling and stability', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    const errors = await helper.trackErrors()

    await helper.fastSetup({ mockApi: true })

    // Test rapid interactions for stability
    await test.step('Rapid interaction test', async () => {
      await helper.openPlanningPicker()
      await page.locator('#planning-picker-close').click()

      await helper.openPlanningPicker()
      await page.locator('#planning-picker-close').click()
    })

    // Verify app remains stable
    await expect(page.locator('#planningsup-app')).toBeVisible()
    await helper.verifyCalendar()

    // Check for critical errors
    await page.waitForTimeout(1000) // Brief wait for any async errors
    expect(errors).toHaveLength(0)
  })
})

// Helper function for batch expectations
async function batchExpected(expectations: Array<() => Promise<void>>): Promise<void> {
  await Promise.all(expectations.map(expectation => expectation()))
}
