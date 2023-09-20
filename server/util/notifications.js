if (!process.env.VAPID_SUBJECT && process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
  if (!process.env.VAPID_SUBJECT) throw new Error('Missing PUBLIC_VAPID_SUBJECT')
}

const webpush = require('web-push')
const { Subscription } = require('../models/subscriptions')
const { Planning } = require('../models/planning')
const { cleanName, cleanLocation, cleanDescription } = require('../util/utils')
const logger = require('../util/signale')

const publicVapidKey = process.env.PUBLIC_VAPID_KEY
const privateVapidKey = process.env.PRIVATE_VAPID_KEY

webpush.setVapidDetails(process.env.VAPID_SUBJECT, publicVapidKey, privateVapidKey)

const retry = async (fn, n = 1) => {
  try {
    await fn()
  } catch (e) {
    if (n === 1) throw e
    await retry(fn, n - 1)
  }
}

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

module.exports.sendNotification = sendNotification

const updateSubscription = async (subscription, nextNotification) => {
  try {
    console.log('Updating subscription', nextNotification.id)
    await Subscription.updateOne(
      { endpoint: subscription.endpoint },
      { $push: { nextNotifications: nextNotification } }
    )
  } catch (e) {
    console.error('Error while updating nextNotifications', e)
  }
}

const removeOldNotifications = async (subscription) => {
  const nbNotifications = subscription.nextNotifications.length
  subscription.nextNotifications = subscription.nextNotifications.filter(n => n.date > new Date())
  if (nbNotifications !== subscription.nextNotifications.length) {
    await Subscription.updateOne({ endpoint: subscription.endpoint }, { $set: { nextNotifications: subscription.nextNotifications } })
  }
}

module.exports.notificationsLoop = async () => {
  try {
    // Get distinct of subscriptions plannings
    const subscriptions = await Subscription.distinct('plannings')
    logger.info('[Subscriptions] Number of active plannings', subscriptions.length)

    if (subscriptions.length) {
      for (const planning of subscriptions) {
        const p = await Planning.findOne({ fullId: planning })
        if (p.backup) {
          // find dtstart nearest to now
          const now = new Date()
          let nextEvent = null
          for (const event of p.backup) {
            const dtstart = new Date(event.dtstart.value)
            if (dtstart > now) {
              if (!nextEvent) nextEvent = event
              else if (dtstart < new Date(nextEvent.dtstart.value)) nextEvent = event
            }
          }

          if (nextEvent) {
            const now = new Date()
            const dtstart = new Date(nextEvent.dtstart.value)

            const diff = dtstart - now
            const tenMinutes = 1000 * 60 * 10
            // const thirtyMinutes = 1000 * 60 * 30
            // const twelveHours = 1000 * 60 * 60 * 12

            if (diff <= tenMinutes) {
              // if (diff <= twelveHours) {
              console.log('Event in less than 10 minutes', p.fullId)
              // console.log('Event in less than 12 hours', p.fullId)
              const payload = JSON.stringify({
                title: `Cours dans ${Math.round(diff / 1000 / 60)} minutes`,
                body: `- ${cleanName(nextEvent.summary.value)}\n- ${cleanLocation(nextEvent.location.value)}\n- ${cleanDescription(nextEvent.description.value)}`,
                icon: '/favicon.ico'
              })
              const date = new Date(dtstart)

              const id = `${p.fullId}::${date.getFullYear()}:${date.getMonth() + 1}:${date.getDate()}:${date.getHours()}:${date.getMinutes()}`

              for await (const subscription of Subscription.find({ plannings: p.fullId })) {
                await removeOldNotifications(subscription).catch(e => console.error('Error while removing old notifications', e))

                if (subscription.nextNotifications.some(n => n.id === id)) {
                  console.log('Already sent notification for this event', id)
                  continue
                }

                await retry(async () => await sendNotification(subscription, payload, true), 2) // Retry 2 times
                  .then(() => updateSubscription(subscription, { id, date, status: 'sent' }))
                  .catch(() => updateSubscription(subscription, { id, date, status: 'error' }))
              }
            }
          }
        }
      }
    }
  } catch (e) {
    logger.error('Error while sending notification', e)
  }
}
