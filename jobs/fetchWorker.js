const { workerData } = require('worker_threads')
const delay = require('delay')
const logger = require('../server/util/signale')
const utils = require('../server/util/utils')
const client = require('../server/util/db');

(async () => {
  logger.info('Fetch EDT for backup')
  for (const i of workerData.data) {
    try {
      const data = await utils.fetchAndGetJSON(i.url)
      if (data && client) {
        try {
          client.query({
            name: 'fetch-data',
            text: 'INSERT INTO public.edt (univ, spec, year, grp, data, timestamp) VALUES($1, $2, $3, $4, $5, $6) ON CONFLICT(univ, spec, year, grp) DO UPDATE SET data = EXCLUDED.data, timestamp = EXCLUDED.timestamp;',
            values: [i.univ, i.spec, i.year, i.grp, JSON.stringify(data), new Date()]
          }, (err) => {
            if (err) {
              logger.error(err)
              logger.error(i.univ + '|' + i.spec + '|' + i.year + '|' + i.grp + ' > Erreur de l\'enregistrement!')
            }
          })
        } catch (err) {
          logger.error(i.univ + '|' + i.spec + '|' + i.year + '|' + i.grp + ' > Erreur d\'insertion des données')
        }
        await delay(500)
      }
    } catch (err) {
      logger.error(i.univ + '|' + i.spec + '|' + i.year + '|' + i.grp + ' : Too late (' + DURATION + ' ms) ')
    }
  }
  logger.info('End DB connection')
  if (client) {
    client.end()
  }
})()
