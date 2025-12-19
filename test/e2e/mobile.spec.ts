import { test, expect } from '@playwright/test'
import { createOptimizedHelper } from './helpers-optimized'

test.describe('Mobile-Specific Functionality', () => {
  test.beforeEach(async ({ page }) => {
    const viewport = page.viewportSize()
    if (!viewport || viewport.width >= 640) {
      test.skip(true, 'Mobile tests only run on mobile viewports')
    }
  })

  test('mobile FAB and planning picker workflow', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('FAB is visible, desktop trigger is not', async () => {
      await expect(page.locator('#mobile-planning-fab')).toBeVisible()
      await expect(page.locator('#planning-picker-trigger')).not.toBeVisible()
    })

    await test.step('FAB opens planning picker', async () => {
      await page.locator('#mobile-planning-fab').click()
      await expect(page.locator('#planning-picker-modal')).toBeVisible()

      await page.fill('#planning-search-input', 'Group A')
      await page.waitForTimeout(200)

      await helper.selectPlanning()
      await helper.verifyCalendar()
    })
  })

  test('mobile theme switching via user menu', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup({ mockApi: true })

    const userMenuTrigger = page.locator('#user-menu-trigger')
    const classes = await userMenuTrigger.getAttribute('class')

    if (classes?.includes('btn-disabled')) {
      test.skip(true, 'User menu not available')
      return
    }

    await test.step('Theme options in user menu', async () => {
      await userMenuTrigger.click()
      await expect(page.locator('#user-dropdown-menu')).toBeVisible()
      await expect(page.locator('#theme-light')).toBeVisible()
      await expect(page.locator('#theme-dark')).toBeVisible()
      await expect(page.locator('#theme-auto')).toBeVisible()
    })

    await test.step('Theme switching works', async () => {
      await page.locator('#theme-dark').click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    })
  })

  test('mobile touch and accessibility', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('FAB has correct touch target size', async () => {
      const fab = page.locator('#mobile-planning-fab')
      const fabBox = await fab.boundingBox()
      expect(fabBox).toBeTruthy()
      expect(fabBox!.width).toBeGreaterThanOrEqual(44)
      expect(fabBox!.height).toBeGreaterThanOrEqual(44)
    })

    await test.step('Touch gestures work', async () => {
      await page.locator('#mobile-planning-fab').tap()
      await expect(page.locator('#planning-picker-modal')).toBeVisible()
      await page.locator('#planning-picker-close').tap()
      await expect(page.locator('#planning-picker-modal')).not.toBeVisible()
    })

    await test.step('FAB has ARIA label', async () => {
      const ariaLabel = await page.locator('#mobile-planning-fab').getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
    })
  })
})
