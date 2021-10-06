const fs = require('fs')
const path = require('path')
const { Router } = require('express')
const router = Router()

const idSeparator = '.'
/**
 * Get URL file without urls
 * @param child
 * @param id
 */
function getChildElement (child, id) {
  if (child.url) {
    child.fullId = id + idSeparator + child.id
    delete child.url
  } else (child.edts || child).forEach((v) => {
    v.fullId = child.id ? (child.id + '.' + v.id) : v.id
    getChildElement(v, id ? (id + idSeparator + child.id) : child.id)
  })
}

const tmpUrls = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/assets/url.json'), 'utf-8'))
getChildElement(tmpUrls)

/**
 * GET route with plannings, without their URLs
 */
router.get('/urls', (req, res) => {
  return res.json(tmpUrls)
})

module.exports = router
