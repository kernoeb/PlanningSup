if (!process.env.VAPID_SUBJECT && process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
  if (!process.env.VAPID_SUBJECT) throw new Error('Missing PUBLIC_VAPID_SUBJECT')
}

const webpush = require('web-push')
const { Subscription } = require('../models/subscriptions')

const publicVapidKey = process.env.PUBLIC_VAPID_KEY
const privateVapidKey = process.env.PRIVATE_VAPID_KEY

webpush.setVapidDetails(process.env.VAPID_SUBJECT, publicVapidKey, privateVapidKey)

const sendNotification = async (subscription, payload, throwErrors = false) => {
  try {
    await webpush.sendNotification(subscription, payload)
  } catch (err) {
    // if gone, delete
    if (err.statusCode === 410) {
      await Subscription.deleteOne({ endpoint: subscription.endpoint })
      return console.log('Subscription deleted')
    }

    console.error(err)

    if (throwErrors) throw err
  }
}

exports.sendNotification = sendNotification
