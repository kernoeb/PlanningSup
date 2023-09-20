const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const packageJson = require('../package.json')
const logger = require('./util/signale')
const { initDB } = require('./util/db')
const { initBree } = require('./util/bree')

logger.info('Starting...')
logger.info('Version : ' + packageJson.version)
logger.info('MongoDB Url : ' + (process.env.MONGODB_URL || 'localhost:27017'))
logger.info('BREE : ' + (process.env.NO_BREE ? 'disabled' : 'enabled'))

const retry = async (fn, n = 1) => {
  try {
    await fn()
  } catch (e) {
    if (n === 1) throw e
    await retry(fn, n - 1)
  }
}

// Connect to MongoDB first
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(`mongodb://${process.env.MONGODB_URL || 'localhost:27017'}/planningsup`).then(() => {
    logger.info('Mongo initialized !')

    const t1 = Date.now()

    // Non-blocking database initialization
    initDB().then(() => {
      const t2 = Date.now()
      logger.info('Database initialized !')
      logger.info('Database initialization time : ' + (t2 - t1) / 1000 + 's')

      // Initialize Bree.js when the database is ready
      if (!process.env.NO_BREE) {
        logger.info('Initializing Bree.js...')
        initBree()
      }

      setTimeout(async () => {
        try {
          const { Agenda } = require('@hokify/agenda')
          const agenda = new Agenda({ name: 'notifications' })
          const { sendNotification } = require('./util/notifications')
          const { cleanName, cleanLocation, cleanDescription } = require('./util/utils')

          // Remove old jobs
          await mongoose.connection.db.collection('notifications').deleteMany({
            nextRunAt: { $lt: new Date() }
          })

          await agenda.mongo(mongoose.connection.db, 'notifications')

          agenda.define('send notification', async () => {
            try {
              const { Subscription } = require('./models/subscriptions')
              const { Planning } = require('./models/planning')

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
          })

          await agenda.every('1 minute', 'send notification', {}, { skipImmediate: false })
          await agenda.start()

          logger.info('Agenda initialized !')
        } catch (e) {
          logger.error('Error while initializing agenda', e)
        }
      }, 10)
    })
  }).catch((err) => {
    logger.error('Error while initializing mongo', err)
  })
}

// Initialize the server
// Create express instance
const app = express()

app.use(cors())
app.use(cookieParser())
app.use(bodyParser.json())

// Create session store for express-session
const store = new MongoDBStore({
  uri: `mongodb://${process.env.MONGODB_URL || 'localhost:27017'}/planningsup`, collection: 'sessions'
})

// Catch errors
store.on('error', function (error) {
  logger.error(error)
})

const sess = {
  secret: app.get('env') === 'production' ? process.env.SESSION_SECRET : 'secret',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10 // 10 years
  },
  store,
  resave: true,
  saveUninitialized: true
}

// D0n't h4ck me bro
if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess))

// Import API Routes
app.use(require('./routes/calendar'))
app.use(require('./routes/urls'))
app.use(require('./routes/crous'))
app.use(require('./routes/metrics'))
app.use('/subscriptions', require('./routes/subscriptions'))

// Export express app
module.exports = app

// Start standalone server if directly running
if (require.main === module) {
  const port = process.env.PORT || 3001
  app.listen(port, () => {
    logger.info(`API server listening on port ${port}`)
  })
}
