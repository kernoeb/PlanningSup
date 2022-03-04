const logger = require('../util/signale')
const Metrics = require('../models/metric')

module.exports = {
  trackPlannings: (planning, sessionId) => {
    const date = new Date()
    date.setHours(2, 0, 0, 0)
    Metrics.findOneAndUpdate({ timestamp: date, planning, sessionId }, { $inc: { count: 1 } }, { upsert: true, new: true })
      .then(() => {
        logger.success('Tracked planning')
      })
      .catch((err) => {
        logger.error(err)
      })
  }
}
