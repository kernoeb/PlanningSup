const { Router } = require('express')
const router = Router()

const urls = require('../../assets/url.json')
const logger = require('../util/signale')
const { fetchAndGetJSON, getFormattedEvents, getBackedPlanning, getCustomEventContent } = require('../util/utils')

const allPlannings = []
const idSeparator = '.'
const titleSeparator = ' | '
function recursiveEdts (j, id, title) {
  if (j.edts) {
    j.edts.forEach((edts) => {
      recursiveEdts(edts, id ? (id + idSeparator + j.id) : j.id, title ? (title + titleSeparator + j.title) : j.title)
    })
  } else {
    allPlannings[id + idSeparator + j.id] = { title: title + titleSeparator + j.title, url: j.url }
  }
}

urls.forEach((univ) => {
  recursiveEdts(univ)
})

/**
 * Calendars GET route
 * From `p` parameter or `plannings` cookie
 */
router.get('/calendars', async (req, res) => {
  // Get blocklist courses
  let blocklist = []
  try {
    if (req.cookies?.blocklist) blocklist = JSON.parse(req.cookies.blocklist).map(name => name.toUpperCase())
  } catch (e) {}

  // Get custom color courses
  let customColorList = null
  try {
    if (req.cookies?.customColorList) customColorList = JSON.parse(req.cookies.customColorList)
    for (const c in customColorList) {
      if (typeof customColorList[c] !== 'string') delete customColorList[c]
    }
    if (Object.keys(customColorList)?.length === 0) customColorList = null
  } catch (e) {}

  try {
    const calendars = (req.query?.p && req.query.p.split(',')) || (req.cookies?.plannings && req.cookies.plannings.split(',')) || null
    if (calendars == null) return res.status(400).send('No cookie or no parameter found')

    // Get planning URLs
    const tmpIds = calendars.filter(p => allPlannings[p]?.url)
    if (!tmpIds?.length) return res.status(404).send('No plannings found !')

    const plannings = await Promise.all(tmpIds.map(async (id) => {
      const fetched = await fetchAndGetJSON(allPlannings[id].url, null)
      if (fetched) return { id, status: 'ok', title: allPlannings[id].title, timestamp: new Date().toISOString(), events: getFormattedEvents(fetched, blocklist, customColorList) }
      const backed = await getBackedPlanning(id)
      if (backed?.backup) return { id, status: 'backup', title: allPlannings[id].title, timestamp: backed?.timestamp || undefined, events: getFormattedEvents(backed.backup, blocklist, customColorList) }
      else return { id, title: allPlannings[id].title, status: 'off' }
    }))

    return res.json({
      timestamp: new Date().toISOString(),
      status: plannings.every(p => p.status === 'ok') ? 'ok' : 'partial',
      plannings
    })
  } catch (err) {
    logger.error(err)
    res.status(500).send('Oof, the server encountered a error :\'(')
  }
})

router.get('/calendars/info', (req, res) => {
  if (!req.query.p) return res.status(400).send('No parameter found')
  try {
    return res.json(req.query.p.split(',').map(planning => ({ planning, title: allPlannings[planning]?.title?.replace(/ \| /gi, ' ') })))
  } catch (err) {
    logger.error(err)
    return res.status(500).send('Oof, the server encountered a error :\'(')
  }
})

router.get('/custom-event-content', async (req, res) => {
  if (req.query.name) return res.send(await getCustomEventContent(req.query.name) || '')
  else return res.send('')
})

module.exports = router
