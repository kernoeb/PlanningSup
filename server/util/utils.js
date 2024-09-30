const icalJs = require('ical.js')
const { Planning } = require('../models/planning')
const { CustomEvent } = require('../models/customevent')
const http = require('./http')
const logger = require('./signale')
const { DateTime } = require('luxon')

const dateStartTemplate = '{date-start}'
const dateEndTemplate = '{date-end}'

/**
 * @typedef {Object} MyEvent
 * @property {string} summary - Event name
 * @property {Date} startDate - Event start date
 * @property {Date} endDate - Event end date
 * @property {string} location - Event location
 * @property {string} description - Event description
 */

/**
 * Check if includes template
 */
const includesTemplate = v => v && (v.includes(dateStartTemplate) || v.includes(dateEndTemplate))

/**
 * Check if event is a teacher
 * @param {string} description
 * @param {string} id
 * @param {string} value
 * @param {string} location
 * @returns {boolean}
 */
const checkHighlightTeacher = ({ description, id, value, location }) => {
  // Special case for IUT Nantes
  if (id.startsWith('iutdenantes.info')) return description.includes('Matière : ') && !description.includes('Personnel : ')
  // Special case for IUT Vannes
  if (id.startsWith('iutdevannes.butdutinfo')) {
    let slicedDescription = description
    if (description.slice(-28, -20) === 'Exported') {
      slicedDescription = description.slice(0, -29)
    }
    return !slicedDescription.match(/.*[a-z].*/) && !value.toLowerCase().includes('amphi') && !location.toLowerCase().includes('amphi')
  }

  return false
}

/**
 * Get appropriate color for event
 * @param {string} value
 * @param {string} location
 * @param {string} description
 * @param {string} id
 * @param {{customColor: {amphi?: string, tp?: string, td?: string, other?: string}, highlightTeacher?: boolean}} options
 * @returns {string}
 */
const getColor = (value, location, description, id, options = {}) => {
  if (options.highlightTeacher && checkHighlightTeacher({ description, id, value, location })) {
    return '#676767'
  } else if (/\bCM\b/.test(value) || value.toUpperCase().includes('AMPHI') || location.toUpperCase().includes('AMPHI')) {
    return options.customColor?.amphi || '#efd6d8'
  } else if (/\bTP\d*\b/.test(value) || value.includes('TPi') || value.includes('TDi') || value.trim().match(/\sG\d\.\d$/)) {
    return options.customColor?.tp || '#bbe0ff'
  } else if ((/\bTD\b/.test(value) || location.includes('V-B') || value.trim().match(/\sG\d$/)) && !/^S\d\.\d\d/.test(value) && !/contr[ôo]le/i.test(value)) {
    return options.customColor?.td || '#d4fbcc'
  } else {
    return options.customColor?.other || '#EDDD6E'
  }
}

/**
 * Sanitize description
 * @param {string} d
 * @returns {string}
 */
const cleanDescription = (d) => {
  return d && d
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

/**
 * Sanitize description
 * @param {string} l
 * @returns {string}
 */
const cleanLocation = (l) => {
  return l && l.trim()
    .replace('salle joker à distance', 'À distance')
    .replace(/(?:\.\.\. MOODLE,)?\.\.a Séance à distance asynchrone-/, 'À distance')
    .split(',').map(v => v.replace(/^V-/, '')).join(', ')
}

/**
 * Sanitize event name
 * @param {string} name
 * @returns {string}
 */
const cleanName = (name) => {
  return (name && name.replace(/([A-Za-z])\?([A-Za-z])/gi, (_, b, c) => b + "'" + c).trim()) || ''
}

/**
 * Get date
 * @param {Date} date
 * @param {{newTZ: string, oldTZ: string}|null} localeUtils
 * @returns {number}
 */
const getDate = (date, localeUtils) => {
  if (!localeUtils || !localeUtils.oldTZ || !localeUtils.newTZ) return date.getTime() // default behavior
  try {
    const tmpDate = DateTime.fromJSDate(date, { zone: localeUtils.oldTZ }).setZone(localeUtils.newTZ, { keepLocalTime: true }).toMillis()
    if (!isNaN(tmpDate)) return tmpDate
    return date.getTime()
  } catch (err) {
    return date.getTime()
  }
}

module.exports = {
  /**
   * Get custom events for a planning
   * @param name
   * @returns array custom events
   */
  getCustomEventContent: async (name) => {
    try {
      const data = await CustomEvent.findOne({ name })
      return data?.content || ''
    } catch (err) {
      logger.error(err)
      return ''
    }
  },
  /**
   * Get backed plannings
   * @returns {Promise<[]|*|{backup: ([]|*), timestamp}|null>}
   * @param fullId
   */
  getBackedPlanning: async (fullId) => {
    try {
      const tmpPlanning = await Planning.findOne({ fullId })
      return tmpPlanning && tmpPlanning.backup && { backup: tmpPlanning.backup, timestamp: tmpPlanning.timestamp }
    } catch (err) {
      return null
    }
  },
  /**
   * Get formatted json
   * @param {MyEvent[]} allEvents
   * @param {string[]} blocklist
   * @param {object} colors
   * @param {object|null} localeUtils
   * @param {boolean} highlightTeacher
   * @param {string} id
   * @returns {[]}
   */
  getFormattedEvents: ({ allEvents, blocklist, colors, localeUtils, highlightTeacher, id }) => {
    const events = []
    for (const i of allEvents) {
      if (!blocklist.some(str => i.summary.toUpperCase().includes(str))) {
        events.push({
          name: cleanName(i.summary),
          start: getDate(i.startDate, localeUtils),
          end: getDate(i.endDate, localeUtils),
          color: getColor(i.summary, i.location, i.description, id, { customColor: colors, highlightTeacher }),
          location: cleanLocation(i.location),
          description: cleanDescription(i.description),
          distance: /à distance$|EAD/.test(i.location.trim()) || undefined,
          timed: true
        })
      }
    }
    return events
  },
  /**
   * Fetch planning from URL, convert ICS to JSON
   * @param {String} url
   * @returns {Promise<MyEvent[]|undefined>}
   */
  fetchAndGetJSON: async (url) => {
    if (includesTemplate(url)) {
      url = url
        .replace(dateStartTemplate, encodeURIComponent(DateTime.now().minus({ month: 1 }).toFormat('yyyy-MM-dd')))
        .replace(dateEndTemplate, encodeURIComponent(DateTime.now().plus({ year: 2 }).toFormat('yyyy-MM-dd')))
    }

    try {
      const { data } = await http.get(url)
      if (data && data.length && !data.includes('500 Internal Server Error') && !data.includes('<!DOCTYPE ')) { // Yeah, that's perfectible
        const comp = new icalJs.Component(icalJs.parse(data))

        const vEvents = comp.getAllSubcomponents('vevent')

        /** @type {MyEvent[]} */
        const allEvents = []

        for (const vEvent of vEvents) {
          const tmpEvent = new icalJs.Event(vEvent)
          allEvents.push({
            summary: tmpEvent.summary,
            startDate: tmpEvent.startDate.toJSDate(),
            endDate: tmpEvent.endDate.toJSDate(),
            location: tmpEvent.location,
            description: tmpEvent.description
          })
        }

        return allEvents
      } else {
        logger.debug('data', data)
      }
    } catch (e) {
      console.error('Error', url)
      logger.debug(e)
    }
  }
}
