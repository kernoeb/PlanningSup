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

          // Remove old jobs
          await mongoose.connection.db.collection('notifications').deleteMany({ nextRunAt: { $lt: new Date() } })

          await agenda.mongo(mongoose.connection.db, 'notifications')

          agenda.define('send notification', async () => {
            logger.info('[Subscriptions] Sending notifications...')
            await require('./util/notifications').notificationsLoop()
            logger.info('[Subscriptions] Notifications sent !')
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
