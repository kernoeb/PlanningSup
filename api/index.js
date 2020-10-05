const express = require('express')

// Create express instance
const app = express()

// Require API routes
const calendar = require('./routes/calendar')

// Import API Routes
app.use(calendar)

// Export express app
module.exports = app

// Start standalone server if directly running
if (require.main === module) {
  const port = process.env.PORT || 3000
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`)
  })
}
