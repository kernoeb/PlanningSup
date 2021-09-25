const ical = require('cal-parser')
const mongoose = require('mongoose')
const axios = require('./axios')
const logger = require('./signale')

/**
 * Get appropriate color for event
 * @param value
 * @param location
 * @returns {string}
 */
const getColor = (value, location) => {
  if (value.includes('CM') || value.includes('Amphi') || location.includes('Amphi')) {
    return '#fe463a'
  } else if (value.includes('TD') || location.includes('V-B')) {
    return 'green'
  } else if (value.includes('TP')) {
    return 'blue'
  } else {
    return 'orange'
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
  getBackedPlanning: async (id) => {
    try {
      const tmpPlanning = await mongoose.models.Planning.findOne({ fullId: id })
      return tmpPlanning && tmpPlanning.backup
    } catch (err) {
      return null
    }
  },
  /**
   * Get formatted json
   * @param j
   * @param blocklist
   * @returns {*[]}
   */
  getFormattedEvents: (j, blocklist) => {
    if (!j.events || !j) return undefined
    const events = []
    for (const i of j.events || j) {
      if (!blocklist.some(str => i.summary.value.toUpperCase().includes(str))) {
        events.push({
          name: i.summary.value.trim(),
          start: new Date(i.dtstart.value).getTime(),
          end: new Date(i.dtend.value).getTime(),
          color: getColor(i.summary.value, i.location.value),
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
   * @param url
   * @returns {Promise<*>}
   */
  fetchAndGetJSON: async (url) => {
    try {
      const response = await axios.get(url)
      const { data } = response
      if (data && data.length && !data.includes('<!DOCTYPE html>')) { // Yeah that's perfectible
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
