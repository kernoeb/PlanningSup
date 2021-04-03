const ical = require('cal-parser')
const AbortController = require('abort-controller')
const fetch = require('node-fetch')
const logger = require('../signale')

const checkStatus = (res) => {
  if (res.ok) {
    return res
  } else {
    return null
  }
}

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
          distance: i.location.value.trim().includes('à distance') || undefined
        })
      }
    }
    return events
  },
  fetchData: async function fetchData (url, time) {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => {
        controller.abort()
      },
      time
    )

    let response = null
    try {
      response = await fetch(url, { signal: controller.signal })
    } catch (e) {
      if (process.env.DEBUG) {
        logger.debug(e)
      }
      return
    } finally {
      clearTimeout(timeout)
    }

    if (response && checkStatus(response)) {
      const body = await response.text()
      if (process.env.DEBUG) {
        logger.debug(body)
      }
      if (!body.includes('<!DOCTYPE html>')) {
        const ics = ical.parseString(body)
        if (ics && Object.entries(ics).length) {
          return ics
        }
      }
    }
  }
}
