const { Client } = require('pg')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})
client.connect()

console.log('Connexion réussie à la db')

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

function shutDown () {
  console.log('Stopping client!')
  client.end()
}

module.exports = client
