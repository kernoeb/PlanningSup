const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose')
const Agenda = require('agenda')
const packageJson = require('../package.json')
const logger = require('./util/signale')
const { fetchAndGetJSON } = require('./util/utils')
const { Schema } = mongoose

const agenda = new Agenda()

logger.info('Starting...')
logger.info('Version : ' + packageJson.version)
logger.info('MongoDB Url : ' + (process.env.MONGODB_URL || 'localhost:27017'))

mongoose.connect(`mongodb://${process.env.MONGODB_URL || 'localhost:27017'}/planningsup`).then(async (v) => {
  logger.info('Mongo initialized !')

  const planningSchema = new Schema({
    fullId: { type: 'String', unique: true, index: true },
    url: String,
    backup: Array,
    timestamp: Date,
    title: { type: 'String', index: true }
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

  logger.info('------------------')
  logger.info(cAdded + ' added elements')
  let cDeleted = 0

  let cEdited = 0
  for (const p of (await Planning.find({}))) {
    const newPlanning = newPlannings.find(v => v.fullId === p.fullId)
    if (!newPlanning) {
      logger.log('Deleted : ' + p.fullId)
      try {
        await Planning.deleteOne({ _id: p._id })
        cDeleted++
      } catch (err) {}
    } else if (newPlanning.title !== p.title || newPlanning.url !== p.url) {
      await Planning.updateOne({ fullId: newPlanning.fullId }, { $set: { title: newPlanning.title, url: newPlanning.url } })
      cEdited++
    }
  }
  logger.info(cDeleted + ' deleted elements')
  logger.info(cEdited + ' edited elements')
  logger.info('------------------')

  // Agenda
  logger.success('Agenda deleted', (await v.connections[0].db.collection('agenda').deleteMany({})).deletedCount)

  const VAR_PLANNING = 'BACKUP_PLANNINGS'

  agenda.define(VAR_PLANNING, {}, async () => {
    const plannings = await Planning.find({})

    logger.info('Number of plannings : ' + plannings.length)

    let c = 0

    const startTime = performance.now()

    for (const p of plannings) {
      const j = await fetchAndGetJSON(p.url)
      if (j?.events?.length) {
        p.backup = j.events
        await p.save()
      }
      c++
      logger.info(c + '/' + plannings.length + ' - ' + p.title)
      await new Promise(resolve => setTimeout(resolve, 450))
    }

    const endTime = performance.now()
    logger.info(`Took ${(endTime - startTime) / 1000} seconds`)

    logger.success('Finished backing plannings')
  })

  agenda.mongo(v.connections[0].db, 'agenda')

  agenda.on('ready', async () => {
    setTimeout(() => {
      agenda.start().then(() => {
        logger.success('Agenda started successfully')
      })
    }, 1000)

    if (!process.env.NO_UPDATE) {
      const UPDATE_CHALLENGES = agenda.create(VAR_PLANNING, {})
      await UPDATE_CHALLENGES.repeatEvery('20 minutes', {}).save()
    }
  })
}).catch(() => {
  logger.error('Error while initializing mongo')
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
