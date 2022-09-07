const { Schema, model } = require('mongoose')

const metricSchema = new Schema({
  timestamp: { type: Date, required: true },
  planning: { type: String, required: true },
  sessionId: { type: String, required: true },
  count: {
    type: Number,
    default: 0,
    required: true
  }
})

metricSchema.index({ timestamp: 1, planning: 1, sessionId: 1 }, { unique: true })
metricSchema.index({ timestamp: 1, planning: 1, count: 1 })
metricSchema.index({ timestamp: 1, count: 1 })
metricSchema.index({ timestamp: 1, planning: 1 })
metricSchema.index({ timestamp: 1, sessionId: 1 })
metricSchema.index({ planning: 1 })
metricSchema.index({ timestamp: 1 })

const Metric = model('Metric', metricSchema)
module.exports = { Metric }
