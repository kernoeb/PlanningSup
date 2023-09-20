
const { Router } = require('express')
const router = Router()

const asyncWrap = require('async-wrapper-express-ts')

const { sendNotification } = require('../util/notifications')
const { Subscription } = require('../models/subscriptions')

const checkPayload = (req, res, next) => {
  if (!req.body || !req.body.plannings) return res.status(400).json({ message: 'Missing plannings' })
  if (!Array.isArray(req.body.plannings) || !req.body.plannings.every(p => typeof p === 'string')) return res.status(400).json({ message: 'Invalid plannings' })
  next()
}

router.post('/subscribe', checkPayload, asyncWrap(async (req, res) => {
  const subscription = req.body
  if (!subscription || !subscription.endpoint || typeof subscription.endpoint !== 'string') return res.status(400).json({ message: 'Invalid subscription' })

  const payload = JSON.stringify({ title: `Abonnement réussi pour ${subscription.plannings.length} planning(s)`, body: 'Vous recevrez une notification en temps voulu :)', icon: '/favicon.ico' })
  await sendNotification(subscription, payload, true)

  const result = await Subscription.findOneAndUpdate({ endpoint: subscription.endpoint }, subscription, { new: true, upsert: true, runValidators: true })

  return res.status(201).json({ message: 'Subscribed', subscription: result })
}))

router.post('/unsubscribe', asyncWrap(async (req, res) => {
  const subscription = req.body
  if (!subscription || !subscription.endpoint || typeof subscription.endpoint !== 'string') return res.status(400).json({ message: 'Invalid subscription' })

  await Subscription.deleteOne({ endpoint: subscription.endpoint }, { runValidators: true })

  return res.status(200).json({ message: 'Unsubscribed' })
}))

router.put('/update-plannings', checkPayload, asyncWrap(async (req, res) => {
  const { subscription, plannings } = req.body
  if (!subscription || !subscription.endpoint || typeof subscription.endpoint !== 'string') return res.status(400).json({ message: 'Invalid subscription' })

  await Subscription.updateOne({ endpoint: subscription.endpoint }, { $set: { plannings } })

  return res.status(201) // do not leak
}))

module.exports = router
