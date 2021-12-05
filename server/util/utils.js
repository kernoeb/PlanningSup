const ical = require('cal-parser')
const mongoose = require('mongoose')
const axios = require('./axios')
const logger = require('./signale')

/**
 * Get appropriate color for event
 * @param value
 * @param location
 * @param customColor
 * @returns {string}
 */
const getColor = (value, location, customColor) => {
  if (value.includes('CM') || value.includes('Amphi') || location.includes('Amphi')) {
    return customColor?.amphi || '#fe463a'
  } else if (value.includes('TP') || value.includes('TDi')) {
    return customColor?.tp || 'blue'
  } else if ((value.includes('TD') || location.includes('V-B')) && !/^S[0-9]\.[0-9][0-9]/.test(value) && !/contr[ôo]le/i.test(value)) {
    return customColor?.td || 'green'
  } else {
    return customColor?.other || 'orange'
  }
}

/**
 * Sanitize description
 * @param d
 * @returns {string}
 */
const cleanDescription = d => d && d
  .replace(/Grp \d/g, '')
  .replace(/GR \d.?\d?/g, '')
  .replace(/LP (DLIS|CYBER)/g, '')
  .replace(/\(Exporté.*\)/, '')
  .replace(/\(Exported :.*\)/, '')
  .replace(/\(Updated :.*\)/, '')
  .trim()

/**
 * Sanitize description
 * @param l
 * @returns {string}
 */
const cleanLocation = l => l && l
  .trim().replace('salle joker à distance', 'À distance')
  .split(',').map(v => v.replace(/^V-/, '')).join(', ')

module.exports = {
  /**
   * Get custom events for a planning
   * @param name
   * @returns array custom events
   */
  getCustomEventContent: async (name) => {
    try {
      const data = await mongoose.models.CustomEvents.findOne({ name })
      return data && data.content && data.content.length ? data.content : ''
    } catch (err) {
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
      const tmpPlanning = await mongoose.models.Planning.findOne({ fullId })
      return tmpPlanning && tmpPlanning.backup && { backup: tmpPlanning.backup, timestamp: tmpPlanning.timestamp }
    } catch (err) {
      return null
    }
  },
  /**
   * Get formatted json
   * @param j
   * @param blocklist
   * @param colors
   * @returns {*[]}
   */
  getFormattedEvents: (j, blocklist, colors) => {
    const events = []
    for (const i of j.events || j) {
      if (!blocklist.some(str => i.summary.value.toUpperCase().includes(str))) {
        events.push({
          name: i.summary.value.trim(),
          start: new Date(i.dtstart.value).getTime(),
          end: new Date(i.dtend.value).getTime(),
          color: getColor(i.summary.value, i.location.value, colors),
          location: cleanLocation(i.location.value),
          description: cleanDescription(i.description.value),
          distance: /à distance$|EAD/.test(i.location.value.trim()) || undefined,
          timed: true
        })
      }
    }
    return events
  },
  /**
   * Fetch planning from URL, convert ICS to JSON
   * @param {String} url
   * @param instance
   * @returns {Promise<*>}
   */
  fetchAndGetJSON: async (url, instance) => {
    try {
      const response = instance ? await instance.get(url) : await axios.get(url)
      const { data } = response
      if (data && data.length && !data.includes('500 Internal Server Error') && !data.includes('<!DOCTYPE ')) { // Yeah that's perfectible
        const ics = ical.parseString(data)
        if (ics && Object.entries(ics).length) {
          return ics
        }
      }
    } catch (e) {
      logger.debug(e)
    }
  }
}
