const Bree = require('bree')
const urls = require('../static/url.json')
const logger = require('./signale')

const edt = []
for (const univ of urls) {
  for (const spec of univ.univ_edts) {
    for (const grp of spec.edts) {
      edt.push({ univ: univ.univ, spec: spec.id, grp: grp.id, url: grp.url })
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
