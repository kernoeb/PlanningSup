const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const packageJson = require('../../package.json')
const logger = require('../util/signale')

logger.info('Starting...')
logger.info('Version : ' + packageJson.version)

// Create express instance
const app = express()
app.use(cors())
app.use(cookieParser())

// Import API Routes
app.use(require('./routes/calendar'))
app.use(require('./routes/urls'))
app.use(require('./routes/crous'))

// Export express app
module.exports = app

// Start standalone server if directly running
if (require.main === module) {
  const port = process.env.PORT || 3001
  app.listen(port, () => {
    logger.info(`API server listening on port ${port}`)
  })
}
