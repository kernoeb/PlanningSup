const mongoose = require('mongoose')
const logger = require('../util/signale')

module.exports = {
  trackPlannings: (planning, sessionId) => {
    const date = new Date()
    date.setHours(2, 0, 0, 0)
    mongoose.models.Metrics.findOneAndUpdate({ timestamp: date, planning, sessionId }, { $inc: { count: 1 } }, { upsert: true, new: true })
      .catch((err) => {
        logger.error(err)
      })
  }
}
