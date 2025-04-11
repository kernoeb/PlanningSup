const asyncWrapper = require('async-wrapper-express-ts')
const { Router } = require('express')
const router = Router()

const { planningsPerFullId } = require('../util/plannings')
const logger = require('../util/signale')
const { fetchAndGetJSON, getFormattedEvents, getBackedPlanning, getCustomEventContent } = require('../util/utils')
const { trackPlannings } = require('../util/analytics')

/**
 * Calendars GET route
 * From `p` parameter or `plannings` cookie
 */
router.get('/calendars', asyncWrapper(async (req, res) => {
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
    if (Object.keys(customColorList).length === 0) customColorList = null
  } catch (e) {}

  // Get custom timezone and locale
  let localeUtils = null
  try {
    const browser = req.headers['x-timezone'] || req.headers['x-browser-timezone'] || req.query['browser-timezone']
    const target = req.headers['x-target-timezone'] || req.query['target-timezone'] || req.cookies.timezone
    if (browser && target && typeof browser === 'string' && typeof target === 'string') {
      localeUtils = { target, browser }
    }
  } catch (e) {
  }

  // Highlight courses with teachers
  let highlightTeacher = false
  try {
    if (req.cookies?.highlightTeacher === 'true') highlightTeacher = true
  } catch (e) {
  }

  try {
    const calendars = ((req.__fixedCookie && req.__fixedCookie.split(',')) || (req.query?.p && req.query.p.split(',')) || (req.cookies?.plannings && req.cookies.plannings.split(',')) || null)
    if (calendars == null) return res.status(400).send('No cookie or no parameter found')

    // Get planning URLs
    const tmpIds = calendars.filter(p => planningsPerFullId[p]?.url)
    if (!tmpIds?.length) return res.sendStatus(404)

    const plannings = await Promise.all(tmpIds.map(async (id) => {
      const fetched = await fetchAndGetJSON(planningsPerFullId[id].url)
      if (fetched) {
        return {
          id,
          status: 'ok',
          title: planningsPerFullId[id].title,
          timestamp: new Date().toISOString(),
          events: getFormattedEvents({ allEvents: fetched, blocklist, colors: customColorList, localeUtils, highlightTeacher, id })
        }
      } else {
        const backed = await getBackedPlanning(id)
        if (backed?.backup) {
          return {
            id,
            status: 'backup',
            title: allPlanningsplanningsPerFullId[id].title,
            timestamp: backed.timestamp || undefined,
            events: getFormattedEvents({ allEvents: backed.backup, blocklist, colors: customColorList, localeUtils, highlightTeacher, id })
          }
        } else {
          return { id, title: planningsPerFullId[id].title, status: 'off' }
        }
      }
    }))

    // Analytics and session management

    if (req.header('ignore-statistics') !== 'true') {
      req.session.plannings = tmpIds
      tmpIds.forEach((id) => {
        trackPlannings(id, req.session.id).catch((err) => logger.error(err))
      })
    } else {
      logger.log('Ignoring statistics', new Date().toISOString(), req.session.id, req.ip, req.headers['user-agent'])
    }

    return res.json({
      timestamp: new Date().toISOString(),
      status: plannings.every(p => p.status === 'ok') ? 'ok' : 'partial',
      plannings
    })
  } catch (err) {
    logger.error(err)
    res.status(500).send('Oof, the server encountered a error :\'(')
  }
}))

router.get('/calendars/info', asyncWrapper(async (req, res) => {
  if (!req.query.p) return res.status(400).send('No parameter found')
  try {
    return res.json(req.query.p.split(',').map(planning => ({ planning, title: planningsPerFullId[planning]?.title?.replace(/ \| /gi, ' ') })))
  } catch (err) {
    logger.error(err)
    return res.status(500).send('Oof, the server encountered a error :\'(')
  }
}))

router.get('/custom-event-content', asyncWrapper(async (req, res) => {
  if (req.query.name) return res.send(await getCustomEventContent(req.query.name) || '')
  else return res.send('')
}))

module.exports = router
