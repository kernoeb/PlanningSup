const { Client } = require('pg')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})
client.connect()

if (process.env.DATABASE_URL) {
  console.log('Connexion réussie à la db')
} else {
  console.log('DATABASE_URL indisponible.')
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

function shutDown () {
  console.log('Stopping client!')
  client.end()
  process.exit()
}

module.exports = client
