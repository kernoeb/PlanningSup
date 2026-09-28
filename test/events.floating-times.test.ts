import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { installApiDbMock } from './helpers/api-db-mock'

/**
 * Prod runs in UTC. Floating times (no Z, no known TZID) must be read in the
 * calendar timezone, not the server one, or French timetables show 1-2 hours late.
 */

const originalFetch = globalThis.fetch
const originalTz = process.env.TZ
let body = ''

function calendar(header: string[], dtstart: string, dtend: string) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...header, 'BEGIN:VEVENT', 'UID:evt', dtstart, dtend, 'SUMMARY:Cours', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}

describe('fetchEventsDetailed timezones', () => {
  let fetchEventsDetailed: typeof import('@api/utils/events').fetchEventsDetailed

  beforeAll(async () => {
    process.env.TZ = 'UTC'
    installApiDbMock()
    // @ts-expect-error bun types
    globalThis.fetch = async () => new Response(body, { status: 200 })
    ;({ fetchEventsDetailed } = await import('@api/utils/events'))
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
    process.env.TZ = originalTz
  })

  async function firstEvent(header: string[], dtstart: string, dtend: string) {
    body = calendar(header, dtstart, dtend)
    const { events } = await fetchEventsDetailed('http://localhost/__floating__')
    return events![0]!
  }

  it('reads floating times in X-WR-TIMEZONE, in summer and winter', async () => {
    const summer = await firstEvent(['X-WR-TIMEZONE:Europe/Paris'], 'DTSTART:20260928T093000', 'DTEND:20260928T123000')
    expect(summer.startDate.toISOString()).toBe('2026-09-28T07:30:00.000Z')
    expect(summer.endDate.toISOString()).toBe('2026-09-28T10:30:00.000Z')

    const winter = await firstEvent(['X-WR-TIMEZONE:Europe/Paris'], 'DTSTART:20261123T083000', 'DTEND:20261123T113000')
    expect(winter.startDate.toISOString()).toBe('2026-11-23T07:30:00.000Z')
  })

  it('reads floating times in the only VTIMEZONE, or Paris when there is no hint', async () => {
    const vtimezone = ['BEGIN:VTIMEZONE', 'TZID:America/Guadeloupe', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0400', 'END:STANDARD', 'END:VTIMEZONE']
    const guadeloupe = await firstEvent(vtimezone, 'DTSTART:20260928T093000', 'DTEND:20260928T103000')
    expect(guadeloupe.startDate.toISOString()).toBe('2026-09-28T13:30:00.000Z')

    const noHint = await firstEvent([], 'DTSTART:20260928T093000', 'DTEND:20260928T103000')
    expect(noHint.startDate.toISOString()).toBe('2026-09-28T07:30:00.000Z')
  })

  it('reads a TZID with no VTIMEZONE in that TZID', async () => {
    const event = await firstEvent([], 'DTSTART;TZID=Europe/Paris:20260928T093000', 'DTEND;TZID=Europe/Paris:20260928T103000')
    expect(event.startDate.toISOString()).toBe('2026-09-28T07:30:00.000Z')
  })

  it('keeps UTC times as they are', async () => {
    const event = await firstEvent(['X-WR-TIMEZONE:Europe/Paris'], 'DTSTART:20260928T073000Z', 'DTEND:20260928T083000Z')
    expect(event.startDate.toISOString()).toBe('2026-09-28T07:30:00.000Z')
  })
})
