const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose')
const packageJson = require('../package.json')
const logger = require('./util/signale')
const { Schema } = mongoose

logger.info('Starting...')
logger.info('Version : ' + packageJson.version)

mongoose.connect(`mongodb://${process.env.MONGODB_URL || 'localhost:27017'}/planningsup`).then(async () => {
  logger.info('Mongo initialized !')

  const planningSchema = new Schema({
    fullId: { type: 'String', unique: true, index: true },
    url: String,
    backup: Array,
    timestamp: Date,
    title: String
  })

  const Planning = mongoose.model('Planning', planningSchema)

  const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/assets/url.json'), 'utf8'))

  const newPlannings = []
  const idSeparator = '.'
  const titleSeparator = ' > '
  function recursiveEdts (j, id, title) {
    if (j.edts) {
      j.edts.forEach((edts) => {
        recursiveEdts(edts, id ? (id + idSeparator + j.id) : j.id, title ? (title + titleSeparator + j.title) : j.title)
      })
    } else {
      const tmp = { ...j }
      tmp.fullId = id + idSeparator + tmp.id
      tmp.title = title + titleSeparator + tmp.title
      tmp.backup = []
      tmp.timestamp = new Date()
      delete tmp.id
      newPlannings.push(tmp)
    }
  }

  j.forEach((univ) => {
    recursiveEdts(univ)
  })

  let cAdded = 0
  for (const p of newPlannings) {
    try {
      const tmpPlanning = new Planning(p)
      await tmpPlanning.save()
      logger.log('Added : ' + tmpPlanning.fullId)
      cAdded++
    } catch (err) {}
  }
  logger.info(cAdded + ' added elements')

  let cDeleted = 0
  let cEdited = 0
  for (const p of (await Planning.find({}))) {
    const newPlanning = newPlannings.find(v => v.fullId === p.fullId)
    if (!newPlanning) {
      logger.log('Deleted ' + p.fullId)
      try {
        await Planning.deleteOne({ _id: p._id })
        cDeleted++
      } catch (err) {}
    } else if (newPlanning.title !== p.title) {
      await Planning.updateOne({ fullId: newPlanning.fullId }, { $set: { title: newPlanning.title } })
      cEdited++
    }
  }
  logger.info(cDeleted + ' deleted elements')
  logger.info(cEdited + ' edited elements')
})

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
