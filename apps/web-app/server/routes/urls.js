const { Router } = require('express')
const router = Router()

const { cleanedPlannings } = require('../util/plannings')

/**
 * GET route with plannings, without their URLs
 */
router.get('/urls', (req, res) => {
  return res.json(cleanedPlannings)
})

module.exports = router
