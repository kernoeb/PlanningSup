
const { Router } = require('express')
const router = Router()

const asyncWrap = require('async-wrapper-express-ts')

const { sendNotification } = require('../util/notifications')
const { Subscription } = require('../models/subscriptions')

router.post('/subscribe', asyncWrap(async (req, res) => {
  const subscriptionBody = req.body
  if (!subscriptionBody || !subscriptionBody.endpoint) return res.status(400).json({ message: 'Invalid subscription' })
  if (!subscriptionBody.plannings) return res.status(400).json({ message: 'Missing plannings' })

  const payload = JSON.stringify({ title: `Abonnement réussi pour ${subscriptionBody.plannings.length} plannings`, body: 'Vous recevrez une notification en temps voulu :)', icon: '/favicon.ico' })
  await sendNotification(subscriptionBody, payload, true)

  const subscription = await Subscription.findOneAndUpdate({ endpoint: subscriptionBody.endpoint }, subscriptionBody, { new: true, upsert: true })

  return res.status(201).json({ message: 'Subscribed', subscription })
}))

router.post('/unsubscribe', asyncWrap(async (req, res) => {
  const subscriptionBody = req.body
  if (!subscriptionBody || !subscriptionBody.endpoint) return res.status(400).json({ message: 'Invalid subscription' })

  await Subscription.deleteOne({ endpoint: subscriptionBody.endpoint })

  return res.status(200).json({ message: 'Unsubscribed' })
}))

module.exports = router
