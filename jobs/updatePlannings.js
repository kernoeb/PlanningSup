const https = require('https')
const mongoose = require('mongoose')
const axios = require('axios')
const logger = require('../server/util/signale')
const { fetchAndGetJSON } = require('../server/util/utils')

const { Planning } = require('../server/models/planning')

mongoose.set('strictQuery', true)

mongoose.connect(`mongodb://${process.env.MONGODB_URL || 'localhost:27017'}/planningsup`).then(async (v) => {
  logger.info('BREE Mongo initialized !')

  const num = await Planning.countDocuments()
  logger.info('Number of plannings : ' + num)

  const startTime = performance.now()

  // Here we fetch all the plannings
  // We only show error if there is a problem with the fetching, to avoid massive logs
  for await (const p of Planning.find({})) {
    const j = await fetchAndGetJSON(p.url)
    if (j?.events?.length) {
      p.timestamp = new Date()
      p.backup = j.events
      await p.save()
    }
    await new Promise(resolve => setTimeout(resolve, 600))
  }

  const endTime = performance.now()
  logger.info(`Took ${(endTime - startTime) / 1000} seconds`)

  logger.success(`Finished backing ${num} plannings`)

  await mongoose.disconnect()
  logger.info('BREE Mongo disconnected !')

  process.exit(0)
}).catch((e) => {
  logger.error(e)
})
