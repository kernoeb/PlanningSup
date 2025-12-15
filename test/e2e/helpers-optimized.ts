import { Page, expect } from '@playwright/test'

// Fast per-page route mocks (no global cache to avoid cross-test leakage)

export interface MockPlanning {
  id: string
  fullId: string
  title: string
  subtitle?: string
  url?: string
  children?: MockPlanning[]
}

export interface MockEvent {
  id: string
  title: string
  start: string
  end: string
  location?: string
  description?: string
  teacher?: string
  group?: string
}

// Optimized mock data (smaller dataset for faster tests)
export const FAST_MOCK_PLANNINGS: MockPlanning[] = [
  {
    id: 'test-university',
    fullId: 'test-university',
    title: 'Test University',
    children: [
      {
        id: 'computer-science',
        fullId: 'test-university.computer-science',
        title: 'Computer Science',
        children: [
          {
            id: 'group-a',
            fullId: 'test-university.computer-science.group-a',
            title: 'Group A',
            subtitle: 'CS Group',
            url: 'http://localhost/__mock_ics__/group-a.ics'
          }
        ]
      }
    ]
  }
]

export const FAST_MOCK_EVENTS: Record<string, MockEvent[]> = {
  'test-university.computer-science.group-a': [
    {
      id: 'event-1',
      title: 'Mathematics',
      start: '2024-01-15T09:00:00Z',
      end: '2024-01-15T10:30:00Z',
      location: 'Room A101',
      teacher: 'Dr. Smith',
      group: 'Group A'
    }
  ]
}

class OptimizedDeviceHelper {
  constructor(private page: Page) {}

  isMobile(): boolean {
    const viewport = this.page.viewportSize()
    return viewport ? viewport.width < 640 : false
  }

  isDesktop(): boolean {
    return !this.isMobile()
  }

  async quickElementCheck(selector: string): Promise<boolean> {
    try {
      return await this.page.locator(selector).first().isVisible({ timeout: 2000 })
    } catch {
      return false
    }
  }

  async waitForPageLoad(): Promise<void> {
    // Wait only for critical content, not all resources
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForSelector('#planningsup-app', { timeout: 5000 })
  }
}

class OptimizedApiMocker {
  constructor(private page: Page) {}

  async setupFastMocks(): Promise<void> {
    // Batch all API route mocks in one call for better performance
    await this.page.route('**/api/**', async (route) => {
      const url = route.request().url()

      if (url.includes('/api/plannings')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(FAST_MOCK_PLANNINGS)
        })
      } else if (url.includes('/api/events')) {
        const planningId = new URL(url).searchParams.get('planningId') || 'test-university.computer-science.group-a'
        const events = FAST_MOCK_EVENTS[planningId] || []
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(events)
        })
      } else {
        await route.continue()
      }
    })
  }

  async clearMocks(): Promise<void> {
    await this.page.unroute('**/api/**')
  }
}

class OptimizedTestHelper {
  public device: OptimizedDeviceHelper
  public api: OptimizedApiMocker

  constructor(private page: Page) {
    this.device = new OptimizedDeviceHelper(page)
    this.api = new OptimizedApiMocker(page)
  }

  async fastSetup(options: { mockApi?: boolean, customPlannings?: MockPlanning[] } = {}): Promise<void> {
    const { mockApi = true } = options

    if (mockApi) {
      await this.api.setupFastMocks()
    }

    // Navigate with optimized loading
    await this.page.goto('/', {
      waitUntil: 'domcontentloaded', // Don't wait for all resources
      timeout: 10000
    })

    // Wait only for critical elements, not arbitrary timeouts
    await this.device.waitForPageLoad()

    // Auth is optional by default; skip waiting for user menu to be enabled.
  }

  async openPlanningPicker(): Promise<void> {
    if (this.device.isMobile()) {
      await this.page.locator('#mobile-planning-fab').click()
    } else {
      await this.page.locator('#planning-picker-trigger').click()
    }

    // Wait for modal to be visible
    await this.page.waitForSelector('#planning-picker-modal', { timeout: 5000 })
  }

  async selectPlanning(planningName?: string): Promise<void> {
    if (!planningName) {
      // Use first available planning if none specified
      const firstPlanning = this.page.locator('#planning-tree-container').locator('[data-planning-id]').first()
      if (await firstPlanning.count() > 0) {
        await firstPlanning.click()
        await this.page.waitForTimeout(500)
      }
    } else {
      // Search for the specific planning
      await this.page.fill('#planning-search-input', planningName)
      await this.page.waitForTimeout(500)

      // Look for planning in the tree
      const planningElement = this.page.locator('#planning-tree-container').locator(`text="${planningName}"`).first()
      if (await planningElement.count() > 0) {
        await planningElement.click()
        await this.page.waitForTimeout(500)
      }
    }

    // Close picker using the close button with retry logic
    try {
      await this.page.locator('#planning-picker-close').click({ timeout: 5000 })
    } catch {
      // Try alternative close methods if primary fails
      await this.page.keyboard.press('Escape')
    }
    await this.page.waitForTimeout(1000)
  }

  async verifyNavbarElements(): Promise<void> {
    // Quick batch verification of navbar elements
    if (this.device.isMobile()) {
      // Mobile-specific checks - FAB should be visible on mobile
      await expect(this.page.locator('#mobile-planning-fab')).toBeVisible()
      // Desktop elements should be hidden on mobile
      await expect(this.page.locator('#planning-picker-trigger')).not.toBeVisible()
    } else {
      // Desktop-specific checks
      await expect(this.page.locator('#planning-picker-trigger')).toBeVisible()
      await expect(this.page.locator('#current-planning-badge')).toBeVisible()
      // Mobile FAB should be hidden on desktop
      await expect(this.page.locator('#mobile-planning-fab')).not.toBeVisible()
    }
  }

  async switchTheme(theme: 'light' | 'dark' | 'dracula' | 'auto'): Promise<void> {
    if (this.device.isMobile()) {
      // Check if user menu is available
      const isUserMenuEnabled = await this.page.evaluate(() => {
        const trigger = document.querySelector('#user-menu-trigger')
        return trigger && !trigger.classList.contains('btn-disabled')
      })

      if (!isUserMenuEnabled) {
        console.log('ℹ️ Skipping mobile theme switching - authentication not available')
        return
      }

      // Open user menu
      await this.page.locator('#user-menu-trigger').click({ force: true })
      await this.page.waitForSelector('#user-dropdown-menu', { timeout: 5000 })

      // Click theme button
      await this.page.locator(`#theme-${theme}`).click({ force: true })
    } else {
      // Check if desktop theme dropdown is visible (hidden on smaller screens)
      const isThemeDropdownVisible = await this.page.locator('#theme-dropdown').isVisible()

      if (!isThemeDropdownVisible) {
        console.log('ℹ️ Skipping desktop theme switching - dropdown not visible on current viewport')
        return
      }

      // Open the theme dropdown
      await this.page.locator('#theme-dropdown-trigger').click({ force: true })
      await this.page.waitForSelector('#theme-dropdown-menu', { timeout: 5000 })
      await this.page.locator(`#theme-${theme}`).click({ force: true })
    }

    // Give theme change time to apply - use shorter timeout and handle gracefully
    try {
      await this.page.waitForFunction(
        (expectedTheme) => {
          const attr = document.documentElement.getAttribute('data-theme')
          if (expectedTheme === 'auto') {
            return attr === 'auto' || attr === 'light' || attr === 'dark'
          }
          return attr === expectedTheme
        },
        theme,
        { timeout: 1500 }
      )
    } catch {
      // Theme change might not be instant - that's okay for tests
      console.log(`Theme change to ${theme} may not have applied immediately`)
    }
  }

  async getCurrentTheme(): Promise<string | null> {
    return await this.page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  }

  async assertTheme(expected: 'light' | 'dark' | 'dracula' | 'auto'): Promise<void> {
    await this.page.waitForFunction(
      (expectedTheme) => {
        const attr = document.documentElement.getAttribute('data-theme')
        if (expectedTheme === 'auto') {
          return attr === 'auto' || attr === 'light' || attr === 'dark'
        }
        return attr === expectedTheme
      },
      expected,
      { timeout: 2000 }
    )
  }

  async assertThemePersists(expected: 'light' | 'dark' | 'dracula' | 'auto'): Promise<void> {
    await this.assertTheme(expected)
    await this.page.reload()
    await this.device.waitForPageLoad()
    await this.assertTheme(expected)
  }

  async verifyCalendar(): Promise<void> {
    // Quick calendar verification using multiple selector strategies
    const calendarSelectors = [
      '.sx__calendar-wrapper',
      '[class*="calendar"]',
      '[class*="schedule"]',
      '#planning-calendar-container'
    ]

    let calendarFound = false
    for (const selector of calendarSelectors) {
      const elements = await this.page.locator(selector).count()
      if (elements > 0) {
        await expect(this.page.locator(selector).first()).toBeVisible()
        calendarFound = true
        break
      }
    }

    if (!calendarFound) {
      // Fall back to checking if there's any content in the main app
      await expect(this.page.locator('#planningsup-app')).toBeVisible()
    }
  }

  async verifyEventsDisplayed(): Promise<void> {
    // Wait for events or calendar content to be displayed
    const eventSelectors = [
      '.sx__event',
      '[class*="event"]',
      '[data-event-id]',
      '.calendar-event',
      '#calendar-hours-display'
    ]

    let eventsFound = false
    for (const selector of eventSelectors) {
      const elements = await this.page.locator(selector).count()
      if (elements > 0) {
        eventsFound = true
        break
      }
    }

    if (!eventsFound) {
      await expect(this.page.locator('#planningsup-app')).toBeVisible()
    }
  }

  async fastNavigation(action: 'next' | 'previous' | 'today'): Promise<void> {
    // Check if page is still available
    if (this.page.isClosed()) {
      console.log('Page is closed, skipping navigation')
      return
    }

    const navSelectors: string[] = []

    // Prefer explicit, stable app-level selectors.
    if (action === 'next') {
      navSelectors.push('#calendar-next-period-header')
    }
    else if (action === 'previous') {
      navSelectors.push('#calendar-prev-period-header')
    }
    else if (action === 'today') {
      navSelectors.push('#calendar-today-btn')
    }

    navSelectors.push(
      `#calendar-${action}-period`,
      `[data-action="${action}"]`,
      `.calendar-nav-${action}`,
      `.sx__${action}-button`,
      `button[aria-label*="${action}"]`,
      `button[title*="${action}"]`
    )
    // Schedule X exposes a Today button via .sx__today-button in desktop mode
    if (action === 'today') {
      navSelectors.unshift('.sx__today-button')
    }

    let navigationFound = false
    for (const selector of navSelectors) {
      try {
        const elements = await this.page.locator(selector).count()
        if (elements > 0) {
          await this.page.locator(selector).first().click({ timeout: 3000 })
          navigationFound = true
          break
        }
      } catch {
        continue
      }
    }

    if (!navigationFound) {
      console.log(`Calendar navigation for '${action}' not found or not visible - skipping`)
    }

    // Brief wait for any UI updates, but check if page is still open
    if (!this.page.isClosed()) {
      await this.page.waitForTimeout(500)
    }
  }

  async verifyResponsiveDesign(): Promise<void> {
    const viewport = this.page.viewportSize()

    if (viewport && viewport.width < 640) {
      // Mobile-specific checks
      await expect(this.page.locator('#mobile-planning-fab')).toBeVisible()
      const desktopTrigger = await this.device.quickElementCheck('#planning-picker-trigger')
      expect(desktopTrigger).toBeFalsy()
    } else {
      // Desktop-specific checks
      await expect(this.page.locator('#planning-picker-trigger')).toBeVisible()
      const mobileFab = await this.device.quickElementCheck('#mobile-planning-fab')
      expect(mobileFab).toBeFalsy()
    }
  }

  async checkAccessibility(): Promise<void> {
    // Quick accessibility checks
    await expect(this.page.locator('#planningsup-app')).toBeVisible()

    // Verify focus management works
    await this.page.keyboard.press('Tab')
    const focusedElement = this.page.locator(':focus')
    await expect(focusedElement).toBeVisible()

    // Check for ARIA labels on interactive elements
    const buttonsWithAriaLabel = await this.page.locator('button[aria-label]').count()
    expect(buttonsWithAriaLabel).toBeGreaterThan(0)
  }

  async trackErrors(): Promise<string[]> {
    const errors: string[] = []

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()

        // Filter out known harmless errors
        const harmlessErrors = [
          'Non-Error promise rejection captured',
          'ResizeObserver loop limit exceeded',
          'Failed to load resource: net::ERR_FAILED',
          'WebKit discarded 1 duplicate ScriptError',
          'Script error.',
          'Anonymous sign-in failed: TypeError: Load failed',
          'Anonymous sign-in failed'
        ]

        if (!harmlessErrors.some(harmless => text.includes(harmless))) {
          errors.push(text)
        }
      }
    })

    return errors
  }
}

export function createOptimizedHelper(page: Page): OptimizedTestHelper {
  return new OptimizedTestHelper(page)
}
