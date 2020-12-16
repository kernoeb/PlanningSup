const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const logger = require('signale')

logger.info('Starting...')

// Create express instance
const app = express()
app.use(cors())
app.use(cookieParser())

// Require API routes
const calendar = require('./routes/calendar')
const urls = require('./routes/urls')

// Import API Routes
app.use(calendar)
app.use(urls)

// Export express app
module.exports = app

// Start standalone server if directly running
if (require.main === module) {
  const port = process.env.PORT || 3001
  app.listen(port, () => {
    logger.info(`API server listening on port ${port}`)
  })
}
