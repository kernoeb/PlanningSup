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

const tmpUrls = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/assets/url.json'), 'utf-8'))
getChildElement(tmpUrls)

/**
 * GET route with plannings, without their URLs
 */
router.get('/urls', (req, res) => {
  res.json(tmpUrls.filter(v => req.query.q && req.query.q.length ? v.title.toUpperCase().includes(req.query.q.toUpperCase()) : true))
})

module.exports = router
