const Bree = require('bree')
const urls = require('../assets/url.json')
const logger = require('./signale')

const edt = []
for (const univ of urls) {
  for (const spec of univ.edts) {
    for (const year of spec.edts) {
      for (const grp of year.edts) {
        edt.push({ univ: univ.univ, spec: spec.id, year: year.id, grp: grp.id, url: grp.url })
      }
    }
  }
}

const bree = new Bree({
  jobs: [
    {
      name: 'fetchWorker',
      closeWorkerAfterMs: 570000,
      interval: '10m',
      worker: {
        workerData: {
          data: edt
        }
      }
    }
  ]
})

logger.info('Starting workers')
bree.start()

export default function (req, res, next) {
  next()
}
