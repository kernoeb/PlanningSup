import { db } from '@api/db'
import { planningsBackupTable } from '@api/db/schemas/plannings'
import { fetchWithTimeout } from '@api/utils/http'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { eq } from 'drizzle-orm'
import icalJs from 'ical.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const dateStartTemplate = '{date-start}'
const dateEndTemplate = '{date-end}'

const includesTemplate = (v: string) => v && (v.includes(dateStartTemplate) || v.includes(dateEndTemplate))

const randomString = () => crypto.randomUUID()

export interface CalEvent {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

export async function fetchEvents(url: string): Promise<CalEvent[] | null> {
  if (includesTemplate(url)) {
    url = url
      .replace(
        dateStartTemplate,
        encodeURIComponent(dayjs().subtract(1, 'month').format('YYYY-MM-DD')),
      )
      .replace(
        dateEndTemplate,
        encodeURIComponent(dayjs().add(2, 'year').format('YYYY-MM-DD')),
      )
  }

  const { data, ok } = await fetchWithTimeout(url)

  if (ok && data && data.length && !data.includes('500 Internal Server Error') && !data.includes('<!DOCTYPE ')) { // Yeah, that's perfectible
    const comp = new icalJs.Component(icalJs.parse(data))

    const vEvents = comp.getAllSubcomponents('vevent')

    const allEvents: CalEvent[] = []

    for (const vEvent of vEvents) {
      const tmpEvent = new icalJs.Event(vEvent)
      allEvents.push({
        uid: tmpEvent.uid || randomString(),
        summary: tmpEvent.summary || '',
        startDate: tmpEvent.startDate.toJSDate(),
        endDate: tmpEvent.endDate.toJSDate(),
        location: tmpEvent.location || '',
        description: tmpEvent.description || '',
      })
    }

    return allEvents
  }

  return null
}

export async function getBackupEvents(planningFullId: string): Promise<CalEvent[] | null> {
  return db.query.planningsBackupTable
    .findFirst({
      where: eq(planningsBackupTable.planningFullId, planningFullId),
    })
    .then(r => r ? r.events : null)
    .catch(() => null)
}

function getDate(date: Date, localeUtils: { target: string, browser: string } | null) {
  if (!localeUtils || !localeUtils.target || !localeUtils.browser) return date

  try {
    const tmpDate = dayjs(date) // from JS Date
      .tz(localeUtils.target) // interpret in target zone
      .tz(localeUtils.browser, true) // true = keepLocalTime

    return tmpDate.toDate()
  } catch {
    return date
  }
}

function checkHighlightTeacher(id: string, event: CalEvent) {
  // Special case for IUT Nantes
  if (id.startsWith('iut-de-nantes.info')) return event.description.includes('Matière : ') && !event.description.includes('Personnel : ')

  // Special case for IUT Vannes
  if (id.startsWith('iut-de-vannes.butdutinfo')) {
    let slicedDescription = event.description
    if (event.description.slice(-28, -20) === 'Exported') {
      slicedDescription = event.description.slice(0, -29)
    }
    return !slicedDescription.match(/.*[a-z].*/) && !event.summary.toLowerCase().includes('amphi') && !event.location.toLowerCase().includes('amphi')
  }

  return false
}

function cleanName(name: string) {
  return (name && name.replace(/([A-Z])\?([A-Z])/gi, (_, b, c) => `${b}'${c}`).trim()) || ''
}
function getCategoryId(id: string, event: CalEvent, options: {
  highlightTeacher?: boolean
}) {
  if (options.highlightTeacher && checkHighlightTeacher(id, event)) {
    return 'no-teacher'
  } else if (/\bCM\b/.test(event.summary) || event.summary.toUpperCase().includes('AMPHI') || event.location.toUpperCase().includes('AMPHI')) {
    return 'lecture'
  } else if (/\bTP\d*\b/.test(event.summary) || event.summary.includes('TPi') || event.summary.includes('TDi') || event.summary.trim().match(/\sG\d\.\d$/)) {
    return 'lab'
  } else if ((/\bTD\b/.test(event.summary) || event.location.includes('V-B') || event.summary.trim().match(/\sG\d$/)) && !/^S\d\.\d\d/.test(event.summary) && !/contr[ôo]le/i.test(event.summary)) {
    return 'tutorial'
  } else {
    return 'other'
  }
}

function cleanLocation(l: string) {
  return l.trim()
    .replace('salle joker à distance', 'À distance')
    .replace(/(?:\.\.\. MOODLE,)?\.\.a Séance à distance asynchrone-/, 'À distance')
    .split(',')
    .map(v => v.replace(/^V-/, ''))
    .join(', ')
}

function cleanDescription(d: string) {
  return d
    .replace(/Grp \d/g, '')
    .replace(/GR \d.?\d?/g, '')
    .replace(/LP (DLIS|CYBER)/g, '')
    .replace(/\(Exporté.*\)/, '')
    .replace(/\(Exported :.*\)/, '')
    .replace(/\(Updated :.*\)/, '')
    .replace(/\(Modifié le:.*\)/, '')
    .replace(/^\s+-/, '')
    .trim()
}

function isRemoteLocation(location: string) {
  return /à distance$|EAD/.test(location.trim())
}

export function getFormattedEvents(id: string, eventsList: CalEvent[], options: {
  localeUtils: { target: string, browser: string } | null
  blocklist: string[]
  highlightTeacher: boolean
}) {
  const events: (CalEvent & {
    categoryId: string
    remoteLocation: boolean
  })[] = []

  for (const event of eventsList) {
    if (!options.blocklist.some(str => event.summary.toLowerCase().includes(str))) {
      events.push({
        uid: event.uid,
        summary: cleanName(event.summary),
        startDate: getDate(event.startDate, options.localeUtils),
        endDate: getDate(event.endDate, options.localeUtils),
        categoryId: getCategoryId(id, event, { highlightTeacher: options.highlightTeacher }),
        location: cleanLocation(event.location),
        description: cleanDescription(event.description),
        remoteLocation: isRemoteLocation(event.location),
      })
    }
  }

  return events
}
