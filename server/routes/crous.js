const { Router } = require('express')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const sanitizeHtml = require('sanitize-html')
const { DateTime } = require('luxon')
const routeCache = require('route-cache')
const xml2js = require('xml2js')
const logger = require('../util/signale')
const http = require('../util/http')
const asyncWrapper = require('async-wrapper-express-ts')

const router = Router()

const villes = ['versailles', 'toulouse', 'starsbourg', 'normandie', 'reunion', 'rennes', 'reims', 'poitiers', 'paris', 'orleans.tours', 'nice', 'nantes', 'nancy.metz', 'montpellier', 'lyon', 'limoges', 'lille', 'grenoble', 'creteil', 'corte', 'clermont.ferrand', 'bordeaux', 'bfc', 'antilles.guyane', 'amiens', 'aix.marseille']

router.get('/crous', (req, res) => {
  return res.json(villes)
})

router.get('/crous/:ville', routeCache.cacheSeconds(process.env.NODE_ENV === 'production' ? 60 * 10 : 0), asyncWrapper(async (req, res) => {
  try {
    if (!villes.includes(req.params.ville)) {
      return res.status(400).json({ title: 'Nope! Are U tryna hak PlanningSup???!!' })
    }
    const d = await http.get(`http://webservices-v2.crous-mobile.fr/feed/${encodeURIComponent(req.params.ville)}/externe/resto.xml`)
    const d2 = await http.get(`http://webservices-v2.crous-mobile.fr/feed/${encodeURIComponent(req.params.ville)}/externe/menu.xml`)

    const json = {}
    xml2js.parseString(d.data, (err, result) => {
      if (err) {
        throw err
      }
      for (const elem of result.root.resto) {
        const id = (elem.$.id)
        json[id] = ({
          description: elem.$,
          infos: sanitizeHtml(elem.infos[0]),
          contact: sanitizeHtml(elem.contact[0])
        })
      }
      xml2js.parseString(d2.data, (err, result) => {
        if (err) {
          throw err
        }
        for (const elem of result.root.resto) {
          const id = (elem.$.id)

          json[id].menu = []
          if (elem.menu != null) {
            for (const repas of elem.menu) {
              json[id].menu.push({
                data: sanitizeHtml(repas.$.date),
                repas: sanitizeHtml(repas._)
              })
            }
          }
        }
        return res.json(json)
      })
    })
  } catch (err) {
    return res.json({ title: err })
  }
}))

// Cache 10 minutes
router.get('/crous_menu', routeCache.cacheSeconds(process.env.NODE_ENV === 'production' ? 600 : 0), asyncWrapper(async (req, res) => {
  try {
    const d = await http.get('https://www.crous-rennes.fr/restaurant/restou-et-cafet-kercado/')
    const dom = new JSDOM(d.data)
    const el = dom.window.document.getElementById('menu-repas').childNodes
    const allEls = []

    Array.from(el[1].childNodes).forEach((b) => {
      const tmp = Array.from(b.childNodes).filter(v => v.innerHTML)
      if (tmp[0] && tmp[0].textContent && tmp[1] && tmp[1].innerHTML) {
        const dej = sanitizeHtml(tmp[1].innerHTML.trim())
        allEls.push({
          title: tmp[0].textContent,
          content: dej.split('\n'),
          date: DateTime.fromFormat(tmp[0].textContent.split(' ').slice(-3).join(' '), 'd LLLL yyyy', { locale: 'fr' }).toISO()
        })
      }
    })
    return res.json(allEls)
  } catch (err) {
    logger.error('crous_menu : ' + err)
    return res.status(500).json([])
  }
}))

module.exports = router
