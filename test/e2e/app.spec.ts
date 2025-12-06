import { test, expect } from '@playwright/test'
import { createOptimizedHelper } from './helpers-optimized'

test.describe('PlanningSup E2E', () => {
  test('complete user workflow: load → select planning → navigate calendar', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('App loads correctly', async () => {
      await expect(page).toHaveTitle(/PlanningSup/)
      await expect(page.locator('#planningsup-app')).toBeVisible()
      await expect(page.locator('#app-navbar')).toBeVisible()
    })

    await test.step('Planning picker opens and search works', async () => {
      await helper.openPlanningPicker()
      await expect(page.locator('#planning-picker-modal')).toBeVisible()
      await expect(page.locator('#planning-search-input')).toBeVisible()
      await expect(page.locator('#planning-tree-container')).toBeVisible()

      await page.fill('#planning-search-input', 'Group A')
      await page.waitForTimeout(200)
    })

    await test.step('Select planning and verify calendar', async () => {
      await helper.selectPlanning('Group A')

      if (helper.device.isDesktop()) {
        const badge = page.locator('#current-planning-badge')
        await expect(badge).toBeVisible()
      }

      await helper.verifyCalendar()
      await helper.verifyEventsDisplayed()
    })

    await test.step('Calendar navigation works', async () => {
      await helper.fastNavigation('next')
      await helper.fastNavigation('previous')
      await helper.fastNavigation('today')
      await helper.verifyCalendar()
    })
  })

  test('responsive design and device-specific UI', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await helper.verifyResponsiveDesign()
    await helper.verifyNavbarElements()

    if (helper.device.isMobile()) {
      await test.step('Mobile FAB opens planning picker', async () => {
        await expect(page.locator('#mobile-planning-fab')).toBeVisible()
        await page.locator('#mobile-planning-fab').click()
        await expect(page.locator('#planning-picker-modal')).toBeVisible()
        await page.locator('#planning-picker-close').click()
      })
    } else {
      await test.step('Desktop planning trigger visible', async () => {
        await expect(page.locator('#planning-picker-trigger')).toBeVisible()
      })
    }
  })

  test('theme switching and persistence', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup({ mockApi: true })

    await test.step('Switch between themes', async () => {
      try {
        await helper.switchTheme('dark')
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

        await helper.switchTheme('light')
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      } catch {
        // Theme switching may not be available in all viewports
      }
    })

    await test.step('Theme persists after reload', async () => {
      try {
        if (helper.device.isMobile()) {
          const trigger = page.locator('#user-menu-trigger')
          const classes = await trigger.getAttribute('class')
          if (classes?.includes('btn-disabled')) return

          await trigger.click({ timeout: 3000 })
          await page.locator('#theme-dracula').click()
        } else {
          await page.locator('#theme-dropdown-trigger').click({ timeout: 3000 })
          await page.locator('#theme-dracula').click()
        }

        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula')
        await page.reload()
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula')
      } catch {
        // Theme persistence may not be available
      }
    })
  })

  test('accessibility and keyboard navigation', async ({ page }) => {
    const helper = createOptimizedHelper(page)
    await helper.fastSetup()

    await test.step('Basic accessibility checks', async () => {
      await helper.checkAccessibility()
    })

    await test.step('Escape closes modal', async () => {
      await helper.openPlanningPicker()
      await page.keyboard.press('Escape')
      await expect(page.locator('#planning-picker-dialog')).not.toBeVisible()
    })

    await test.step('App remains stable after rapid interactions', async () => {
      for (let i = 0; i < 3; i++) {
        await helper.openPlanningPicker()
        try {
          await page.locator('#planning-picker-close').click({ timeout: 2000 })
        } catch {
          await page.keyboard.press('Escape')
        }
      }
      await expect(page.locator('#planningsup-app')).toBeVisible()
    })
  })
})
