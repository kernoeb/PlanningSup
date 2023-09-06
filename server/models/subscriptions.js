const { Schema, model } = require('mongoose')

const schemaSubscription = new Schema({
  endpoint: {
    type: String,
    unique: true,
    required: true
  },
  expirationTime: String,
  keys: {
    p256dh: String,
    auth: String
  },
  plannings: [String]
})

schemaSubscription.index({ endpoint: 1 }, { unique: true })

schemaSubscription.methods.updatePlannings = async function (plannings) {
  this.plannings = plannings
  await this.save()
}

const Subscription = model('Subscription', schemaSubscription)
module.exports = { Subscription }
