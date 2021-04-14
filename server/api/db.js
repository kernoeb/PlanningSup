const { Client } = require('pg')
const logger = require('../signale')

let client
if (process.env.DATABASE_URL) {
  client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: (process.env.DATABASE_SSL && process.env.DATABASE_SSL === 'true')
      ? {
          rejectUnauthorized: false
        }
      : false
  })

  try {
    client.connect()
  } catch (e) {
    logger.error('Erreur de connexion à la base de données')
  }

  logger.success('Variable DATABASE_URL -> OK.')
} else {
  logger.warn('DATABASE_URL -> indisponible.')
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

function shutDown () {
  logger.info('Stopping client!')
  if (client) {
    client.end()
  }
  process.exit()
}

module.exports = client
