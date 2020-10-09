import fetch from 'node-fetch'
import ical from 'cal-parser'

const { Router } = require('express')
const urls = require('../../static/url.json')

const router = Router()

function getColor (n, l) {
  if (n.includes('CM') || n.includes('Amphi') || l.includes('Amphi')) {
    return '#fe463a'
  } else if (n.includes('TD') || l.includes('V-B')) {
    return 'green'
  } else if (n.includes('TP')) {
    return 'blue'
  } else {
    return 'orange'
  }
}

const checkStatus = (res) => {
  if (res.ok) {
    return res
  } else {
    return 'err'
  }
}

router.use('/getCalendar', async (req, res) => {
  let reqU = 'iutvannes'
  let reqN = 'lp'
  let reqT = 'dlis'
  if (req.query && req.query.u && req.query.n && req.query.t) {
    reqU = req.query.u
    reqN = req.query.n
    reqT = req.query.t
  }
  const univ = urls.filter(u => u.univ === reqU)
  const univ2 = univ[0].univ_edts.filter(u => u.name === reqN)
  const tmpUrl = univ2[0].edts.filter(u => u.name === reqT)[0].url
  try {
    const response = await fetch(tmpUrl)
    if (checkStatus(response) !== 'err') {
      const body = await response.text()
      const ics = ical.parseString(body)

      const events = []
      for (const i of ics.events) {
        events.push({
          name: i.summary.value,
          start: new Date(i.dtstart.value).getTime(),
          end: new Date(i.dtend.value).getTime(),
          color: getColor(i.summary.value, i.location.value),
          timed: true,
          location: i.location.value,
          description: i.description.value
        })
      }
      res.json(events)
    } else {
      // TODO Take saved json (Heroku PostgreSQL ?)
      res.status(500).send('oof!')
    }
  } catch (err) {
    // TODO Take saved json (Heroku PostgreSQL ?)
    res.status(500).send('oof! (2)')
  }
})

module.exports = router
