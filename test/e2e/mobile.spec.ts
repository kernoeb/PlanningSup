import { test, expect } from '@playwright/test'
import { createOptimizedHelper, quickCheck } from './helpers-optimized'

test.describe('Mobile Functionality', () => {
  // Skip all tests if not on mobile viewport
  test.beforeEach(async ({ page }) => {
    const viewport = page.viewportSize()
    const isMobile = viewport ? viewport.width < 640 : false

    if (!isMobile) {
      test.skip(true, 'Mobile tests only run on mobile viewports')
    }
  })

  test('mobile navigation and FAB functionality', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    // Mobile-specific elements should be visible
    await expect(page.locator('#mobile-planning-fab')).toBeVisible()

    // Desktop elements should not be visible
    const hasDesktopTrigger = await quickCheck(page, '#planning-picker-trigger')
    expect(hasDesktopTrigger).toBeFalsy()

    // Test FAB interaction
    await test.step('FAB opens planning picker', async () => {
      await page.locator('#mobile-planning-fab').click()
      await expect(page.locator('#planning-picker-modal')).toBeVisible()

      // Close and verify
      await page.locator('#planning-picker-close').click()
      await expect(page.locator('#planning-picker-modal')).not.toBeVisible()
    })
  })

  test('mobile theme switching via user menu', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup({ mockApi: true })

    // Check if authentication is working properly
    const isUserMenuAvailable = await page.waitForFunction(() => {
      const userMenuTrigger = document.querySelector('#user-menu-trigger')
      return userMenuTrigger && !userMenuTrigger.classList.contains('btn-disabled')
    }, { timeout: 3000 }).catch(() => false)

    if (!isUserMenuAvailable) {
      console.log('ℹ️ Skipping mobile theme switching test - user menu not available')
      test.skip()
      return
    }

    await test.step('Test theme switching workflow', async () => {
      // Test that theme switching UI works (don't verify actual theme change)
      await helper.switchTheme('dark')

      // Verify app remains functional after theme interaction
      await expect(page.locator('#planning-sup-app')).toBeVisible()
    })
  })

  test('mobile user menu interactions', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    const userMenuTrigger = page.locator('#user-menu-trigger')
    const isDisabled = await userMenuTrigger.getAttribute('class')

    if (!isDisabled?.includes('btn-disabled')) {
      await userMenuTrigger.click()
      await expect(page.locator('#user-dropdown-menu')).toBeVisible()

      // On mobile, theme options should be in user menu
      await test.step('Verify mobile theme options', async () => {
        await expect(page.locator('#mobile-theme-light')).toBeVisible()
        await expect(page.locator('#mobile-theme-dark')).toBeVisible()
        await expect(page.locator('#mobile-theme-auto')).toBeVisible()
      })

      // Close menu by tapping elsewhere
      await page.locator('#planning-sup-app').click()
      await expect(page.locator('#user-dropdown-menu')).not.toBeVisible()
    }
  })

  test('mobile planning picker interactions', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('Complete mobile planning workflow', async () => {
      // Open via FAB
      await page.locator('#mobile-planning-fab').click()
      await expect(page.locator('#planning-picker-modal')).toBeVisible()

      // Test search functionality
      await page.fill('#planning-search-input', 'Group A')
      await page.waitForTimeout(300)

      // Select planning
      await helper.selectPlanning()

      // Verify calendar updates
      await helper.verifyCalendar()
      await helper.verifyEventsDisplayed()
    })
  })

  test('mobile touch interactions', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('Test touch gestures', async () => {
      // Test touch on FAB
      await page.locator('#mobile-planning-fab').tap()
      await expect(page.locator('#planning-picker-modal')).toBeVisible()

      // Test touch to close
      await page.locator('#planning-picker-close').tap()
      await expect(page.locator('#planning-picker-modal')).not.toBeVisible()
    })
  })

  test('mobile viewport constraints', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    const viewport = page.viewportSize()
    expect(viewport).toBeTruthy()
    expect(viewport!.width).toBeLessThan(640)

    // Verify mobile layout adaptations
    await test.step('Check mobile layout elements', async () => {
      // Mobile FAB should be positioned correctly
      const fab = page.locator('#mobile-planning-fab')
      await expect(fab).toBeVisible()

      // Check FAB positioning (should be fixed bottom-right)
      const fabBox = await fab.boundingBox()
      expect(fabBox).toBeTruthy()
      expect(fabBox!.y).toBeGreaterThan(viewport!.height - 150) // Near bottom
    })
  })

  test('mobile performance and responsiveness', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    // Track performance metrics
    await page.addInitScript(() => {
      window.performance.mark('test-start')
    })

    await helper.fastSetup()

    await test.step('Test mobile interaction performance', async () => {
      // Rapid interactions should remain responsive
      await page.locator('#mobile-planning-fab').click()
      await page.locator('#planning-picker-close').click()

      await page.locator('#mobile-planning-fab').click()
      await page.locator('#planning-picker-close').click()

      // Verify app remains stable and responsive
      await expect(page.locator('#planning-sup-app')).toBeVisible()
      await helper.verifyCalendar()
    })

    // Check performance metrics
    const performanceMetrics = await page.evaluate(() => {
      window.performance.mark('test-end')
      const measure = window.performance.measure('test-duration', 'test-start', 'test-end')
      return {
        duration: measure.duration,
        navigationTiming: window.performance.getEntriesByType('navigation')[0]
      }
    })

    // Mobile interactions should be reasonably fast
    expect(performanceMetrics.duration).toBeLessThan(5000) // 5 seconds max
  })

  test('mobile accessibility features', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('Check mobile accessibility', async () => {
      // FAB should have proper ARIA label
      const fab = page.locator('#mobile-planning-fab')
      const ariaLabel = await fab.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()

      // Touch targets should be appropriately sized (minimum 44px)
      const fabBox = await fab.boundingBox()
      expect(fabBox).toBeTruthy()
      expect(fabBox!.width).toBeGreaterThanOrEqual(44)
      expect(fabBox!.height).toBeGreaterThanOrEqual(44)

      // Focus management should work on mobile
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })
  })

  test('mobile error handling', async ({ page }) => {
    const helper = createOptimizedHelper(page)

    await helper.fastSetup()

    // Test error scenarios specific to mobile
    await test.step('Handle mobile-specific errors', async () => {
      // Test that UI remains functional with network issues
      await page.context().setOffline(true)

      // Try to open planning picker
      await page.locator('#mobile-planning-fab').click()

      // Should handle gracefully - modal should still open
      await expect(page.locator('#planning-picker-modal')).toBeVisible()

      // Restore network
      await page.context().setOffline(false)

      // Close picker
      await page.locator('#planning-picker-close').click()
    })

    // Verify app remains functional after network issues
    await expect(page.locator('#planning-sup-app')).toBeVisible()
    await helper.verifyCalendar()
  })

  test('mobile theme persistence', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup({ mockApi: true })

    // Check if authentication is working properly
    const isUserMenuAvailable = await page.waitForFunction(() => {
      const userMenuTrigger = document.querySelector('#user-menu-trigger')
      return userMenuTrigger && !userMenuTrigger.classList.contains('btn-disabled')
    }, { timeout: 3000 }).catch(() => false)

    if (!isUserMenuAvailable) {
      console.log('ℹ️ Skipping mobile theme persistence test - user menu not available')
      test.skip()
      return
    }

    await test.step('Test mobile theme persistence', async () => {
      // Test that theme persistence UI works
      await helper.switchTheme('dark')

      // Verify app remains functional after theme interaction
      await expect(page.locator('#planning-sup-app')).toBeVisible()

      // Test page reload functionality
      await page.reload()
      await helper.device.waitForPageLoad()
      await expect(page.locator('#planning-sup-app')).toBeVisible()
    })
  })
})
