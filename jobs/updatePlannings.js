const mongoose = require('mongoose')
const logger = require('../server/util/signale')
const { fetchAndGetJSON } = require('../server/util/utils')

const { Planning } = require('../server/models/planning')

mongoose.connect(`mongodb://${process.env.MONGODB_URL || 'localhost:27017'}/planningsup`).then(async (v) => {
  logger.info('BREE Mongo initialized !')

  const num = await Planning.countDocuments()
  logger.info('Number of plannings : ' + num)

  let c = 0

  const startTime = performance.now()

  for await (const p of Planning.find({})) {
    const j = await fetchAndGetJSON(p.url)
    if (j?.events?.length) {
      p.timestamp = new Date()
      p.backup = j.events
      await p.save()
    }
    c++
    logger.info(c + '/' + num + ' - ' + p.title)
    await new Promise(resolve => setTimeout(resolve, 450))
  }

  const endTime = performance.now()
  logger.info(`Took ${(endTime - startTime) / 1000} seconds`)

  logger.success('Finished backing plannings')

  await mongoose.disconnect()
  logger.info('BREE Mongo disconnected !')

  process.exit(0)
}).catch((e) => {
  logger.error(e)
})
