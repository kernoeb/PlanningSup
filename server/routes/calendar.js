const { Router } = require('express')
const router = Router()

const urls = require('../../assets/url.json')
const logger = require('../util/signale')
const { fetchAndGetJSON, getFormattedEvents, getBackedPlanning } = require('../util/utils')

const DEBUG = process.env?.DEBUG === 'true'
const defaultPlanning = ['iutdevannes', 'butdutinfo', '2emeannee', 'a1']

// Util functions
const getChild = (parent, id) => parent && parent.find(v => v.id === id)
const bToA = s => Buffer.from(s, 'base64').toString('ascii')

/**
 * Get planning Title and URL
 * @param arr
 * @returns {{title: string, url}|null}
 */
function getPlanning (arr) {
  let obj = urls
  const title = []
  for (const v of arr) {
    obj = getChild(obj.edts || obj, v)
    if (!obj) break
    title.push(obj.title)
  }
  if (!obj || (obj && !obj.url)) return null
  return { title: title.join(' | '), url: obj.url, id: arr.join('.') }
}

/**
 * Calendars GET route
 * From `p` parameter or `plannings` cookie
 */
router.get('/calendars', async (req, res) => {
  if (req?.query?.p === 'reset') return res.json({ status: 'reset' })

  // Get blocklist courses
  let blocklist = []
  try {
    if (req.cookies?.blocklist) blocklist = JSON.parse(req.cookies.blocklist).map(name => name.toUpperCase())
  } catch (e) {}

  try {
    const p = req.query.p || req.cookies.plannings
    const calendars = p && bToA(p)

    let arr = null
    try {
      arr = calendars && JSON.parse(calendars).filter(v => typeof v === 'string').map(v => v.split('.'))
    } catch (err) {
      return res.status(400).send(DEBUG ? 'Invalid json : ' + err.message : 'Invalid json.')
    }

    // Get planning URLs
    const tmpUrls = (arr || [defaultPlanning]).map(p => getPlanning(p)).filter(m => m && m.url)
    if (!tmpUrls || (tmpUrls && !tmpUrls.length)) return res.status(400).send('No planning(s) found !')

    // Get data
    const data = await Promise.all(tmpUrls.map((m, i) => fetchAndGetJSON(m.url)))

    // Convert ICS to JSON events
    let status = 'on'
    const plannings = await Promise.all((data || []).map(async (v, i) => {
      if (!v) status = 'semi'
      let events
      if (v) events = getFormattedEvents(v, blocklist)
      else events = getFormattedEvents(await getBackedPlanning(tmpUrls?.[i]?.id), blocklist)
      return ({
        id: tmpUrls?.[i]?.id,
        title: tmpUrls?.[i]?.title,
        timestamp: new Date().getTime(),
        events
      })
    }))

    return res.json({
      status: !plannings.find(v => v.events) ? 'off' : status,
      timestamp: new Date().getTime(),
      plannings
    })
  } catch (err) {
    logger.error(err)
    res.status(500).send('Oof, the server encountered a error :\'(')
  }
})

module.exports = router