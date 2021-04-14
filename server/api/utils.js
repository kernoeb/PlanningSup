const ical = require('cal-parser')
const axios = require('axios')
const logger = require('../signale')

module.exports = {
  getColor: function getColor (n, l, m) {
    if (m) {
      if (n.startsWith('UE1')) {
        return '#f3352d'
      } else if (n.startsWith('UE2')) {
        return '#ffaa00'
      } else if (n.match(/^UE3.*android/)) {
        return 'rgb(94, 168, 212)'
      } else if (n.startsWith('UE3')) {
        return 'rgb(3, 119, 186)'
      } else if (n.match(/^UE4.*NoSQL/)) {
        return 'rgba(241, 79, 174, 0.616)'
      } else if (n.startsWith('UE4')) {
        return 'rgb(241, 79, 174)'
      } else if (n.startsWith('UE5')) {
        return '#00998a'
      } else if (n.startsWith('UE6')) {
        return '#3c4082'
      } else if (n.startsWith('UE7')) {
        return '#01a156'
      } else if (n.startsWith('UE8')) {
        return '#571a4e'
      } else if (n.startsWith('UE9')) {
        return '#607b8a'
      }
    }
    if (n.includes('CM') || n.includes('Amphi') || l.includes('Amphi')) {
      return '#fe463a'
    } else if (n.includes('TD') || l.includes('V-B')) {
      return 'green'
    } else if (n.includes('TP')) {
      return 'blue'
    } else {
      return 'orange'
    }
  },
  cleanDescription: function cleanDescription (d) {
    return d.replace(/Grp \d/g, '').replace(/GR \d.?\d?/g, '').replace(/LP (DLIS|CYBER)/g, '').replace(/\(Exporté.*\)/, '').trim()
  },
  getEvents: function getEvents (ics, blocklist, req) {
    const events = []
    for (const i of ics.events) {
      if (!blocklist.some(str => i.summary.value.toUpperCase().includes(str))) {
        events.push({
          name: i.summary.value.trim(),
          start: new Date(i.dtstart.value).getTime(),
          end: new Date(i.dtend.value).getTime(),
          color: this.getColor(i.summary.value, i.location.value, req.cookies && ((req.cookies.colorMode && req.cookies.colorMode === 'true') || !req.cookies.colorMode)),
          timed: true,
          location: i.location.value.trim(),
          description: this.cleanDescription(i.description.value),
          distance: i.location.value.trim().match(/à distance|EAD/) || undefined
        })
      }
    }
    return events
  },
  fetchData: async function fetchData (url, time) {
    let response
    try {
      response = await axios({
        method: 'GET',
        url,
        timeout: time
      })
      const { data } = response
      if (process.env.DEBUG) {
        logger.debug(data)
      }
      if (data && data.length && !data.includes('<!DOCTYPE html>')) {
        const ics = ical.parseString(data)
        if (ics && Object.entries(ics).length) {
          return ics
        }
      }
    } catch (e) {
      if (process.env.DEBUG) {
        logger.debug(e)
      }
    }
  }
}
