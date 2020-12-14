const { workerData } = require('worker_threads')
const delay = require('delay')
const logger = require('signale')
const config = require('config')
const utils = require('../server/api/utils')
const client = require('../server/api/db')

const DURATION = config.get('durationWorker') || 5000;

(async () => {
  logger.info('Fetch EDT for backup')
  for (const i of workerData.data) {
    try {
      const data = await utils.fetchData(i.url, DURATION)
      if (data) {
        try {
          client.query({
            name: 'fetch-data',
            text: 'INSERT INTO public.edt (univ, spec, grp, data, timestamp) VALUES($1, $2, $3, $4, $5) ON CONFLICT(univ, spec, grp) DO UPDATE SET data = EXCLUDED.data, timestamp = EXCLUDED.timestamp;',
            values: [i.univ, i.spec, i.grp, JSON.stringify(data), new Date()]
          }, (err) => {
            if (err) {
              logger.error(err)
              logger.error(i.univ + '|' + i.spec + '|' + i.grp + 'Erreur de l\'enregistrement!')
            }
          })
        } catch (err) {
          logger.error(i.univ + '|' + i.spec + '|' + i.grp + 'Erreur d\'insertion des données')
        }
        await delay(500)
      }
    } catch (err) {
      logger.error(i.univ + '|' + i.spec + '|' + i.grp + ': Too late (' + DURATION + ' ms) ')
    }
  }
  logger.info('End DB connection')
  client.end()
})()
