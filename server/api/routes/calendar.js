const { Router } = require('express')
const logger = require('signale')
const config = require('config')
const client = require('../db')
const utils = require('../utils')

const urls = require('../../../assets/url.json')
const DURATION = config.get('durationCalendar') || 3000

const router = Router()

async function dbFallback (req, res, reqU, reqS, reqY, reqG, blocklist, name) {
  try {
    const query = await client.query({
      name: 'fetch-data',
      text: 'SELECT data, timestamp FROM public.edt WHERE univ = $1 AND spec = $2 AND year = $3 AND grp = $4;',
      values: [reqU, reqS, reqY, reqG]
    })
    if (query.rows[0]) {
      const tmp = {
        status: 'db',
        name
      }

      if (query.rows[0].data && Object.entries(query.rows[0].data).length) {
        const tmpEvents = utils.getEvents(query.rows[0].data, blocklist, req)
        if (tmpEvents.length) {
          tmp.data = tmpEvents
        } else {
          return res.status(500).send('Coup dur. Une erreur 500. Aucune sauvegarde non plus... (1)')
        }
      } else {
        return res.status(500).send('Coup dur. Une erreur 500. Aucune sauvegarde non plus... (2)')
      }

      if (query.rows[0].timestamp) {
        tmp.timestamp = new Date(query.rows[0].timestamp).getTime()
      }
      return res.json(tmp)
    } else {
      return res.status(500).send('Coup dur. Une erreur 500. Aucune sauvegarde non plus... (3)')
    }
  } catch (err) {
    logger.error(err)
    return res.status(500).send('Coup dur. Une erreur 500.')
  }
}

router.get('/calendar', async (req, res) => {
  let reqU = config.get('default.univ') || 'iutdevannes'
  let reqS = config.get('default.spec') || 'butdutinfo'
  let reqY = config.get('default.year') || '1ereannee'
  let reqG = config.get('default.grp') || 'a1'

  let blocklist = []
  if (req.cookies && req.cookies.blocklist) {
    try {
      blocklist = JSON.parse(req.cookies.blocklist).map(name => name.toUpperCase())
    } catch (e) {
      blocklist = []
    }
  }

  if (req.query && req.query.u && req.query.s && req.query.y && req.query.g) {
    reqU = req.query.u
    reqS = req.query.s
    reqY = req.query.y
    reqG = req.query.g
  }

  try {
    const univ = urls.find(u => u.id === reqU)
    const spec = univ.edts.find(u => u.id === reqS)
    const year = spec.edts.find(u => u.id === reqY)
    const grp = year.edts.find(u => u.id === reqG)
    const tmpUrl = grp ? grp.url : undefined

    if (tmpUrl) {
      const name = univ.title + ' > ' + spec.title + ' ' + year.title + ' ' + grp.title

      const data = await utils.fetchData(tmpUrl, DURATION)
      if (data) {
        const events = utils.getEvents(data, blocklist, req)

        await res.json({
          status: 'on',
          name,
          timestamp: new Date().getTime(),
          data: events
        })
      } else if (process.env.DATABASE_URL) {
        await dbFallback(req, res, reqU, reqS, reqY, reqG, blocklist, name)
      } else {
        res.status(500).send('Coup dur. Une erreur 500. Et surtout pas de DATABASE_URL.')
      }
    } else {
      res.status(500).send('Une erreur est survenue, veuillez vérifier les paramètres (1).')
    }
  } catch (err) {
    logger.error(err)
    res.status(500).send('Une erreur est survenue, veuillez vérifier les paramètres (2).')
  }
})

module.exports = router
