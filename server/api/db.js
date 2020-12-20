const { Client } = require('pg')
const logger = require('../signale')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_SSL && process.env.DATABASE_SSL === 'true')
    ? {
        rejectUnauthorized: false
      }
    : false
})
client.connect()

if (process.env.DATABASE_URL) {
  logger.success('Variable DATABASE_URL -> OK.')
} else {
  logger.warn('DATABASE_URL -> indisponible.')
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

function shutDown () {
  logger.info('Stopping client!')
  client.end()
  process.exit()
}

module.exports = client
