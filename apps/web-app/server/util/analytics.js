const { Metric } = require('../models/metric')

module.exports = {
  trackPlannings: async (planning, sessionId) => {
    const date = new Date()
    date.setHours(2, 0, 0, 0)
    await Metric.findOneAndUpdate(
      { timestamp: date, planning, sessionId },
      { $inc: { count: 1 } },
      { upsert: true, new: true }
    )
  }
}
