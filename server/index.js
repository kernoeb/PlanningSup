const express = require('express')
const cors = require('cors')
const config = require('config')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const mongoose = require('mongoose')
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const packageJson = require('../package.json')
const logger = require('./util/signale')
const { initDB } = require('./util/db')
const { initBree } = require('./util/bree')

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

if (!process.env.SESSION_SECRET) {
  logger.error('SESSION_SECRET is not set')
  process.exit(1)
}

logger.info('Starting...')
logger.info('Version : ' + packageJson.version)
logger.info('MongoDB Url : ' + (process.env.MONGODB_URL || 'localhost:27017'))
logger.info('Duration : ' + (process.env.DURATION_CALENDAR || config.get('duration')))
logger.info('BREE : ' + (process.env.NO_BREE ? 'disabled' : 'enabled'))

// Connect to MongoDB first
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
  })
}).catch((err) => {
  logger.error('Error while initializing mongo', err)
})

// Initialize the server
// Create express instance
const app = express()

app.use(cors())
app.use(cookieParser())
app.use(bodyParser.json())
app.use(helmet())

// Create session store for express-session
const store = new MongoDBStore({
  uri: `mongodb://${process.env.MONGODB_URL || 'localhost:27017'}/planningsup`,
  collection: 'sessions'
})

// Catch errors
store.on('error', function (error) {
  logger.error(error)
})

const sess = {
  secret: process.env.SESSION_SECRET,
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
app.use('/sync', require('./routes/sync'))

// Export express app
module.exports = app

// Start standalone server if directly running
if (require.main === module) {
  const port = process.env.PORT || 3001
  app.listen(port, () => {
    logger.info(`API server listening on port ${port}`)
  })
}
