const { Router } = require('express')
const router = Router()

const Metric = require('../models/metric')

router.get('/analytics/today', async (req, res) => {
  const date = new Date()
  date.setHours(2, 0, 0, 0)

  const nbSession = await Metric.aggregate([
    { $match: { timestamp: date } },
    { $group: { _id: '$sessionId' } },
    { $group: { _id: null, nb: { $sum: 1 } } }
  ])

  // mongo sum of all the count of date
  const nbRequests = await Metric.aggregate([
    { $match: { timestamp: date } },
    { $group: { _id: null, nb: { $sum: '$count' } } }
  ])

  res.json({
    nbUsers: nbSession?.[0]?.nb || 0,
    nbPlanningRequests: nbRequests?.[0]?.nb || 0
  })
})

router.get('/metrics/today', async (req, res) => {
  // get all metrics
  const date = new Date()
  date.setHours(2, 0, 0, 0)

  try {
    const ret = await Metric.aggregate([
      {
        $match: {
          timestamp: date
        }
      },
      {
        $group: {
          _id: '$planning',
          distinct: { $sum: 1 },
          count: { $sum: '$count' }
        }
      },
      { $sort: { count: -1 } }
    ])
    res.json(ret)
  } catch (err) {
    res.status(500).json({
      message: err.message || err || 'Internal server error'
    })
  }
})

module.exports = router
