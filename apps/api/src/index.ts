import process from 'process'
import { client, db } from '@api/db'
import { init as initDb } from '@api/db/init'
import { jobs } from '@api/jobs'
import { defaultLogger as logger } from '@api/utils/logger'
import app from './api.js'

// Properly handle shutdown
function onExit() {
  logger.info('Shutting down server...')
  client.end()
  logger.info('Database connection closed.')
  process.exit(0)
}

process.on('SIGINT', onExit)
process.on('SIGTERM', onExit)

await initDb(db).then(() => {
  jobs.start(db)
})

const port = Bun.env.PORT ? Number(Bun.env.PORT) : 20000
app.listen(port, () => {
  logger.info(`Server started on http://localhost:${port}`)
})
