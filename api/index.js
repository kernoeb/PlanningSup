const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')

// Create express instance
const app = express()
app.use(cors())
app.use(cookieParser())

// Require API routes
const calendar = require('./routes/calendar')

// Import API Routes
app.use(calendar)

// Export express app
module.exports = app

// Start standalone server if directly running
if (require.main === module) {
  const port = process.env.PORT || 3001
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`)
  })
}
