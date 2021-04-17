const { Router } = require('express')
const router = Router()
const routeCache = require('route-cache')
const logger = require('../../signale')
const urls = require('../../../assets/url.json')

router.get('/urls', process.env.NODE_ENV === 'production' ? routeCache.cacheSeconds(60 * 60 * 24 * 7) : routeCache.cacheSeconds(0), (req, res) => {
  logger.info('Regénération des URLs')
  const tmpUrls = JSON.parse(JSON.stringify(urls))
  for (const i of tmpUrls) {
    for (const j of i.univ_edts) {
      for (const k of j.edts) {
        delete k.url
      }
    }
  }
  res.json(tmpUrls)
})

module.exports = router
