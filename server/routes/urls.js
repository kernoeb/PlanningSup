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
  } else {
    (child.edts || child).forEach((v) => {
      v.fullId = child.id ? ((id ? (id + '.') : '') + child.id + idSeparator + v.id) : v.id
      getChildElement(v, id ? (id + idSeparator + child.id) : child.id)
    })
  }
}

/**
 * Remove ids
 * @param obj
 * @param match
 */
function deleteIds (obj, match) {
  delete obj[match]
  for (const v of Object.values(obj)) {
    if (v instanceof Object) {
      deleteIds(v, match)
    }
  }
}

const tmpUrls = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/assets/plannings.json'), 'utf-8'))
getChildElement(tmpUrls)
tmpUrls.forEach((v) => {
  deleteIds(v, 'id')
})

/**
 * GET route with plannings, without their URLs
 */
router.get('/urls', (req, res) => {
  return res.json(tmpUrls)
})

module.exports = router
