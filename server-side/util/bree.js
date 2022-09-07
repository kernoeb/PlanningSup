const Bree = require('bree')
const Graceful = require('@ladjs/graceful')
const ms = require('ms')

module.exports = {
  initBree: () => {
    const bree = new Bree({
      jobs: [
        {
          name: 'updatePlannings',
          timeout: process.env.NODE_ENV === 'production' ? '5s' : '2s',
          interval: process.env.NODE_ENV === 'production' ? '30m' : '1m',
          closeWorkerAfterMs: ms('29m')
        }
      ]
    })

    const graceful = new Graceful({ brees: [bree] })
    graceful.listen()

    bree.start()
  }
}
