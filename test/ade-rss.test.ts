import { describe, expect, it } from 'bun:test'
import path from 'path'
import { isAdeRssUrl, parseAdeRss } from '@api/utils/ade-rss'

const fixture = await Bun.file(path.join(import.meta.dir, 'fixtures', 'ade-rss.xml')).text()

describe('isAdeRssUrl', () => {
  it('matches the ADE RSS export', () => {
    expect(isAdeRssUrl('https://ade.example.edu/jsp/rss?projectId=1&resources=430,431&nbDays=400')).toBe(true)
  })

  it('rejects ordinary calendar URLs', () => {
    expect(isAdeRssUrl('https://planning.univ-rennes.fr/jsp/custom/modules/plannings/MYzg4NnZ.shu')).toBe(false)
    expect(isAdeRssUrl('https://ade.example.edu/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=1')).toBe(false)
    expect(isAdeRssUrl('not a url')).toBe(false)
  })
})

describe('parseAdeRss', () => {
  const events = parseAdeRss(fixture)

  it('parses every item that has a date', () => {
    expect(events.length).toBe(4)
  })

  it('reads the title, and the start/end in Europe/Paris', () => {
    const cm = events[0]!
    expect(cm.summary).toBe('MOD_1234_Réseaux_CM')
    // 07/09/2026 is CEST (UTC+2), so 10h00 Paris is 08:00Z.
    expect(cm.startDate.toISOString()).toBe('2026-09-07T08:00:00.000Z')
    expect(cm.endDate.toISOString()).toBe('2026-09-07T10:00:00.000Z')
  })

  it('splits rooms into location and teachers into description', () => {
    const cm = events[0]!
    expect(cm.location).toBe('Amphi 1')
    expect(cm.description).toBe('DURAND Alice')

    const td = events[2]!
    expect(td.location).toBe('B204')
    expect(td.description).toBe('MARTIN Paul')
  })

  it('leaves location and description empty when the item lists only groups', () => {
    const groupsOnly = events[1]!
    expect(groupsOnly.summary).toContain('Sortie')
    expect(groupsOnly.location).toBe('')
    expect(groupsOnly.description).toBe('')
  })

  it('builds a stable uid from the guid and start', () => {
    expect(events[0]!.uid).toBe(`ade-rss-26-${events[0]!.startDate.getTime()}`)
  })

  it('returns nothing for a feed with no items', () => {
    expect(parseAdeRss('<rss><channel></channel></rss>')).toEqual([])
  })
})
