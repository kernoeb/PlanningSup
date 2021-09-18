const fs = require('fs')
const path = require('path')
const { Router } = require('express')
const router = Router()
const routeCache = require('route-cache')
const logger = require('../../util/signale')

const PRODUCTION = process.env?.NODE_ENV === 'production'

/**
 * Get URL file without urls
 * @param child
 */
function getChildElement (child) {
  if (child.url) delete child.url
  else (child.edts || child).forEach((v) => { getChildElement(v) })
}

/**
 * GET route with plannings, without their URLs
 */
router.get('/urls', routeCache.cacheSeconds(PRODUCTION ? (60 * 60 * 24 * 7) : 0), (req, res) => {
  logger.info('Génération des URLs')
  const tmpUrls = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/assets/url.json'), 'utf-8'))
  getChildElement(tmpUrls)
  res.json(tmpUrls)
})

module.exports = router
