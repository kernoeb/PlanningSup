import fetch from 'node-fetch'
import ical from 'cal-parser'
import AbortController from 'abort-controller'

const { Client } = require('pg')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})
client.connect()

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

function cleanDescription (d) {
  return d.split(' (Exporté')[0].split('LP DLIS ')[1]
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

  const controller = new AbortController()
  const timeout = setTimeout(
    () => {
      controller.abort()
    },
    2500
  )

  try {
    const univ = urls.find(u => u.univ === reqU)
    const univ2 = univ.univ_edts.find(u => u.id === reqN)
    const univ3 = univ2.edts.find(u => u.id === reqT)
    const tmpUrl = univ3.url

    let response = null
    try {
      response = await fetch(tmpUrl, { signal: controller.signal })
    } catch (e) {
    } finally {
      clearTimeout(timeout)
    }

    if (response && checkStatus(response) !== 'err') {
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
          description: cleanDescription(i.description.value)
        })
      }

      if (process.env.DATABASE_URL) {
        try {
          client.query({
            name: 'fetch-data',
            text: 'INSERT INTO public.edt (univ, spec, grp, "data") VALUES($1, $2, $3, $4) ON CONFLICT(univ, spec, grp) DO UPDATE SET data = EXCLUDED.data;',
            values: [reqU, reqN, reqT, JSON.stringify(events)]
          }, (err) => {
            if (err) {
              console.log(err)
              console.log('Erreur de l\'enregistrement!')
            }
          })
        } catch (err) {
          console.log('Erreur d\'insertion des données')
        }
      }
      await res.json(events)
    } else if (process.env.DATABASE_URL) {
      try {
        const query = await client.query({
          name: 'fetch-data',
          text: 'SELECT data FROM public.edt WHERE univ = $1 AND spec = $2 AND grp = $3;',
          values: [reqU, reqN, reqT]
        })
        if (query.rows[0]) {
          await res.json(query.rows[0])
        } else {
          res.status(500).send('Coup dur. Une erreur 500. Aucune sauvegarde non plus...')
        }
      } catch (err) {
        res.status(500).send('Coup dur. Une erreur 500.')
      }
    } else {
      res.status(500).send('Coup dur. Une erreur 500. Et surtout pas de DATABASE_URL.')
    }
  } catch (err) {
    console.log(err)
    res.status(500).send('Une erreur est survenue, veuillez vérifier les paramètres.')
  }
})

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

function shutDown () {
  console.log('Stopping client!')
  client.end()
}

module.exports = router
