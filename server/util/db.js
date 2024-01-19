const fs = require('fs')
const path = require('path')
const logger = require('../util/signale')

module.exports = {
  initDB: async () => {
    const { Planning } = require('../models/planning')

    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/assets/plannings.json'), { encoding: 'utf8' }))

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
      } catch (err) {
      }
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
        } catch (err) {
        }
      } else if (newPlanning.title !== p.title || newPlanning.url !== p.url) {
        await Planning.updateOne({ fullId: newPlanning.fullId }, {
          $set: {
            title: newPlanning.title,
            url: newPlanning.url
          }
        })
        cEdited++
      }
    }
    logger.info(cDeleted + ' deleted elements')
    logger.info(cEdited + ' edited elements')
    logger.info('------------------')
  }
}
