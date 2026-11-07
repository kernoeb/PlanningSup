import { expect, test } from '@playwright/test'

/**
 * Regression guard: events must actually render in the calendar grid.
 *
 * This exists because bumping `temporal-polyfill` to 1.x (which delegates to
 * native `Temporal` when the browser has it) silently broke Schedule X event
 * rendering — every event failed Schedule X's `instanceof Temporal.ZonedDateTime`
 * check and nothing appeared, while typecheck/build/unit tests all passed. The bug
 * only reproduces in a browser that ships native Temporal, which the default
 * Playwright Chromium does — so this test catches exactly that class of failure.
 *
 * The mock mirrors the real API shape: GET /api/plannings/:fullId?events=true
 * returns `{ ..., status: 'ok', events: [{ uid, summary, startDate, endDate,
 * categoryId, ... }], nbEvents }`, with startDate/endDate as ISO strings (Eden
 * revives them to Date on the client, exactly like production).
 */

const FULL_ID = 'test-university.computer-science.group-a'

const TREE = [
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
            fullId: FULL_ID,
            title: 'Group A',
            subtitle: 'CS Group',
            url: 'http://localhost/__mock_ics__/group-a.ics',
          },
        ],
      },
    ],
  },
]

// Build one event per day across a 2-week window centred on "now" (UTC), at
// 09:00–10:30, so whichever week the calendar lands on (incl. the weekend →
// Monday shift when weekends are hidden) contains several visible weekday events.
function buildEvents(nowMs: number) {
  const events = []
  const base = new Date(nowMs)
  for (let offset = -3; offset <= 10; offset++) {
    const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offset, 9, 0, 0))
    const dow = day.getUTCDay()
    if (dow === 0 || dow === 6) continue // weekdays only
    const end = new Date(day.getTime() + 90 * 60 * 1000)
    events.push({
      uid: `e2e-${offset}`,
      summary: `E2E Lecture ${offset}`,
      startDate: day.toISOString(),
      endDate: end.toISOString(),
      categoryId: 'other',
      location: 'Room 42',
      description: 'E2E regression event',
      remoteLocation: false,
    })
  }
  return events
}

test.use({ timezoneId: 'UTC' })

test.describe('calendar event rendering (temporal-polyfill × Schedule X regression guard)', () => {
  test('selected planning renders its events in the grid', async ({ page }) => {
    const events = buildEvents(Date.now())

    // Fail loudly on the exact console error this regression produced.
    const scheduleXErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('[Schedule-X error]')) {
        scheduleXErrors.push(msg.text())
      }
    })

    // Preselect the planning + week view before the app boots.
    await page.addInitScript(({ fullId }) => {
      localStorage.setItem('plannings', JSON.stringify([fullId]))
      localStorage.setItem('planning.calendar.view', 'week')
      localStorage.setItem('settings.showWeekends', 'false')
    }, { fullId: FULL_ID })

    // Mock the plannings tree + the events endpoint; let everything else through.
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname
      const leaf = pathname.match(/\/api\/plannings\/([^/]+)$/)
      if (leaf) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'group-a',
            fullId: FULL_ID,
            title: 'Group A',
            refreshedAt: Date.now(),
            backupUpdatedAt: Date.now(),
            status: 'ok',
            source: 'network',
            reason: null,
            events,
            nbEvents: events.length,
          }),
        })
      }
      else if (/\/api\/plannings\b/.test(pathname)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TREE) })
      }
      else {
        await route.continue()
      }
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#planningsup-app', { timeout: 10000 })

    // The calendar must render actual event blocks — not just the hours badge.
    const eventBlocks = page.locator('.sx__event')
    await expect(eventBlocks.first()).toBeVisible({ timeout: 10000 })
    expect(await eventBlocks.count()).toBeGreaterThan(0)
    await expect(page.locator('.sx__event', { hasText: 'E2E Lecture' }).first()).toBeVisible()

    // And Schedule X must not have rejected the events' Temporal types.
    expect(scheduleXErrors, `Schedule-X errors: ${scheduleXErrors.join(' | ')}`).toEqual([])
  })
})
