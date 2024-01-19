const logger = require('../util/signale')
const { Metric } = require('../models/metric')

module.exports = {
  trackPlannings: (planning, sessionId) => {
    const date = new Date()
    date.setHours(2, 0, 0, 0)
    Metric.findOneAndUpdate({ timestamp: date, planning, sessionId }, { $inc: { count: 1 } }, { upsert: true, new: true })
      .catch((err) => {
        logger.error(err)
      })
  }
}
